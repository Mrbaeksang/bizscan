import { NextRequest, NextResponse } from 'next/server'
import { generateExcelFromData } from '@/lib/excel-generator'
import type { ExcelRowData } from '@/lib/excel-generator'

export async function POST(request: NextRequest) {
  let rawData: ExcelRowData[] = []
  
  try {
    const requestData = await request.json()
    rawData = requestData.rawData
    
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '검수할 데이터가 없습니다.' 
      })
    }

    console.log(`🔍 [BIZSCAN] 일괄 검수 시작 - ${rawData.length}개 데이터`)

    // 1. 라마 텍스트 검수 (일괄 처리)
    const reviewedData = await performBulkTextReview(rawData)
    
    // 2. 중복 제거
    const { uniqueData, duplicatesRemoved } = removeDuplicates(reviewedData.correctedData)
    
    // 3. 엑셀 생성
    const excelBlob = await generateExcelFromData(uniqueData)
    const buffer = await excelBlob.arrayBuffer()
    
    console.log(`✅ [BIZSCAN] 일괄 검수 완료 - 원본 ${rawData.length}개 → 최종 ${uniqueData.length}개`)
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=bizscan_reviewed_${uniqueData.length}.xlsx`,
        'X-Review-Results': JSON.stringify({
          originalCount: rawData.length,
          afterDeduplication: uniqueData.length,
          duplicatesRemoved: duplicatesRemoved,
          textCorrections: reviewedData.corrections,
          totalCorrections: reviewedData.corrections.length
        })
      }
    })

  } catch (error) {
    console.error('일괄 검수 중 오류:', error)
    
    // 에러 발생 시에도 원본 데이터로 엑셀 생성
    try {
      console.log('⚠️ [BIZSCAN] 에러 발생, 원본 데이터로 엑셀 생성')
      // rawData가 정의되지 않은 경우 빈 배열 사용
      const dataToProcess = rawData || []
      const { uniqueData, duplicatesRemoved } = removeDuplicates(dataToProcess)
      const excelBlob = await generateExcelFromData(uniqueData)
      const buffer = await excelBlob.arrayBuffer()
      
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename=bizscan_original_${uniqueData.length}.xlsx`,
          'X-Review-Results': JSON.stringify({
            originalCount: dataToProcess.length,
            afterDeduplication: uniqueData.length,
            duplicatesRemoved: duplicatesRemoved,
            textCorrections: [],
            totalCorrections: 0
          })
        }
      })
    } catch (fallbackError) {
      console.error('엑셀 생성 완전 실패:', fallbackError)
      return NextResponse.json({ 
        success: false, 
        error: '엑셀 생성 중 오류가 발생했습니다.' 
      })
    }
  }
}

async function performBulkTextReview(rawData: ExcelRowData[]) {
  const reviewPrompt = `
아래는 사업자등록증에서 OCR로 추출한 ${rawData.length}개의 데이터입니다. 
모든 데이터를 한 번에 검토하고 수정사항을 제안해주세요:

${rawData.map((data, index) => `
${index + 1}. 상호명: ${data.companyAndRepresentative}
   사업자주소: ${data.address}
   사업자등록번호: ${data.businessRegistrationNumber}
`).join('\n')}

검토 사항:
- 오타나 잘못된 문자 (예: ㅣ → l, ㅇ → o, 0 → O 등)
- 누락된 문자나 불완전한 단어
- 사업자등록번호 형식 (xxx-xx-xxxxx)
- 주소 정보의 완성도

응답 형식:
{
  "correctedData": [
    {
      "companyAndRepresentative": "수정된 상호명",
      "address": "수정된 주소",
      "businessRegistrationNumber": "수정된 등록번호",
      "openTime": "",
      "memo": "",
      "phoneNumber": "",
      "isOperational": ""
    }
  ],
  "corrections": [
    {
      "index": 0,
      "field": "필드명",
      "original": "원본 데이터",
      "corrected": "수정된 데이터",
      "reason": "수정 이유"
    }
  ]
}
`

  // 단일 텍스트 모델 사용
  const textModels = ['meta-llama/llama-3.2-3b-instruct']

  for (const model of textModels) {
    try {
      console.log(`🔍 [BIZSCAN] 일괄 텍스트 검수 시도 중: ${model}`)
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://bizscan.vercel.app',
          'X-Title': 'BizScan Bulk Review'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'system',
              content: '당신은 사업자등록증 OCR 데이터를 일괄 검토하는 전문가입니다. 정확한 한국어 처리와 사업자등록증 형식을 잘 알고 있습니다.'
            },
            {
              role: 'user',
              content: reviewPrompt
            }
          ],
          temperature: 0.1,
          max_tokens: 4000
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API 오류: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      
      if (!result.choices || result.choices.length === 0) {
        throw new Error('텍스트 검수 결과가 없습니다.')
      }

      const reviewContent = result.choices[0].message.content
      
      try {
        // JSON 형식으로 파싱 시도
        let cleanContent = reviewContent
        
        // 마크다운 코드 블록 제거
        if (reviewContent.includes('```json')) {
          cleanContent = reviewContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        } else if (reviewContent.includes('```')) {
          cleanContent = reviewContent.replace(/```\s*/g, '').trim()
        }
        
        const reviewData = JSON.parse(cleanContent)
        
        console.log(`✅ [BIZSCAN] 일괄 텍스트 검수 성공: ${model}`)
        return {
          correctedData: reviewData.correctedData || rawData,
          corrections: reviewData.corrections || []
        }
      } catch (parseError) {
        // JSON 파싱 실패 시 원본 데이터 반환
        console.log(`⚠️ [BIZSCAN] JSON 파싱 실패, 원본 반환: ${model}`)
        console.log(`파싱 에러:`, parseError)
        console.log(`응답 내용:`, reviewContent)
        return {
          correctedData: rawData,
          corrections: []
        }
      }
    } catch (error) {
      console.error(`❌ [BIZSCAN] 일괄 텍스트 검수 실패: ${model}`, error)
      continue
    }
  }
  
  // 모든 모델 실패 시 원본 데이터 반환 (에러 발생시키지 않음)
  console.log(`⚠️ [BIZSCAN] 텍스트 검수 실패, 원본 데이터 사용`)
  return {
    correctedData: rawData,
    corrections: []
  }
}

function removeDuplicates(data: ExcelRowData[]) {
  const seen = new Map<string, ExcelRowData>()
  const uniqueData: ExcelRowData[] = []
  const duplicatesRemoved: Array<{companyName: string, businessNumber: string}> = []
  
  for (const item of data) {
    const businessNumber = item.businessRegistrationNumber?.trim()
    
    if (businessNumber && businessNumber !== '') {
      // 사업자등록번호가 있는 경우
      if (seen.has(businessNumber)) {
        const existingItem = seen.get(businessNumber)!
        // 상호명까지 비교하여 완전히 같은 경우만 중복으로 처리
        if (existingItem.companyAndRepresentative === item.companyAndRepresentative) {
          console.log(`🔄 [BIZSCAN] 중복 제거: ${item.companyAndRepresentative} (${item.businessRegistrationNumber})`)
          duplicatesRemoved.push({
            companyName: item.companyAndRepresentative,
            businessNumber: item.businessRegistrationNumber
          })
          continue // 중복이므로 추가하지 않음
        }
      }
      
      seen.set(businessNumber, item)
      uniqueData.push(item)
    } else {
      // 사업자등록번호가 없는 경우 상호명으로만 비교
      const companyKey = item.companyAndRepresentative?.trim()
      if (companyKey && !seen.has(companyKey)) {
        seen.set(companyKey, item)
        uniqueData.push(item)
      } else if (companyKey && seen.has(companyKey)) {
        console.log(`🔄 [BIZSCAN] 중복 제거 (상호명 기준): ${item.companyAndRepresentative}`)
        duplicatesRemoved.push({
          companyName: item.companyAndRepresentative,
          businessNumber: item.businessRegistrationNumber || '없음'
        })
      } else {
        // 사업자등록번호도 상호명도 없는 경우 그냥 추가
        uniqueData.push(item)
      }
    }
  }
  
  return { uniqueData, duplicatesRemoved }
}