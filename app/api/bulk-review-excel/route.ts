import { NextRequest, NextResponse } from 'next/server'
import { generateExcelFromData } from '@/lib/excel-generator'
import type { ExcelRowData } from '@/lib/excel-generator'

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json()
    const rawData: ExcelRowData[] = requestData.rawData
    
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '검수할 데이터가 없습니다.' 
      })
    }

    console.log(`🔍 [BIZSCAN] 엑셀 생성 시작 - ${rawData.length}개 데이터`)

    // 텍스트 검수 건너뛰고 바로 중복 제거 및 엑셀 생성
    const { uniqueData, duplicatesRemoved } = removeDuplicates(rawData)
    
    const excelBlob = await generateExcelFromData(uniqueData)
    const buffer = await excelBlob.arrayBuffer()
    
    console.log(`✅ [BIZSCAN] 엑셀 생성 완료 - 원본 ${rawData.length}개 → 최종 ${uniqueData.length}개`)
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=bizscan_${uniqueData.length}개.xlsx`,
        'X-Review-Results': JSON.stringify({
          originalCount: rawData.length,
          afterDeduplication: uniqueData.length,
          duplicatesRemoved: duplicatesRemoved,
          textCorrections: [],
          totalCorrections: 0
        })
      }
    })

  } catch (error) {
    console.error('엑셀 생성 중 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '엑셀 생성 중 오류가 발생했습니다.' 
    })
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