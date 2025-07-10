import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { getClientIP, isAllowedIP } from '@/lib/ip-check'

// 시스템 프롬프트 정의
const SYSTEM_PROMPT = `당신은 대한민국 사업자등록증 이미지 분석 전문가입니다.

당신의 임무:
사업자등록증 이미지에서 정확히 다음 4가지 정보만 추출하세요:
1. "대표자명" - 대표자 성명
2. "상호명" - 사업체 이름
3. "사업자주소" - 사업장 소재지 전체 주소
4. "사업자등록번호" - 10자리 사업자번호

중요 규칙:
- 반드시 JSON 형식으로만 응답하세요
- 다른 설명이나 추가 텍스트 없이 JSON만 반환하세요
- 찾을 수 없는 정보는 빈 문자열("")로 표시하세요
- 사업자등록번호는 반드시 "XXX-XX-XXXXX" 형식으로 변환하세요
- 주소는 발견된 전체 주소를 그대로 포함하세요

응답 예시:
{
  "대표자명": "홍길동",
  "상호명": "주식회사 샘플",
  "사업자주소": "서울특별시 강남구 테헤란로 123 샘플빌딩 5층",
  "사업자등록번호": "123-45-67890"
}`

interface ExtractedData {
  대표자명: string
  상호명: string
  사업자주소: string
  사업자등록번호: string
}

async function extractInfoFromImage(imageBuffer: Buffer): Promise<ExtractedData> {
  // 여러 API 키를 시도할 수 있도록 설정 (환경변수에서 콤마로 구분)
  const apiKeys = process.env.OPENROUTER_API_KEY?.split(',').map(key => key.trim()) || []
  const primaryApiKey = apiKeys[0] || process.env.OPENROUTER_API_KEY
  
  console.log('Number of API keys:', apiKeys.length || 1)
  if (!primaryApiKey) {
    throw new Error('OPENROUTER_API_KEY is not set')
  }

  const base64Image = imageBuffer.toString('base64')
  console.log('Image buffer size:', imageBuffer.length, 'Base64 length:', base64Image.length)

  // 여러 모델을 시도할 수 있도록 배열로 관리 (error.md 순서대로)
  const models = [
    'google/gemini-2.0-flash-exp:free',           // 1순위
    'qwen/qwen2.5-vl-72b-instruct:free',         // 2순위
    'mistralai/mistral-small-3.2-24b-instruct:free', // 3순위 (이미지 지원 확인 필요)
    'google/gemma-3-27b-it:free'                 // 4순위 (이미지 지원 확인 필요)
  ]

  let lastError: any = null
  
  // API 키와 모델 조합을 시도
  const apiKeysToTry = apiKeys.length > 0 ? apiKeys : [primaryApiKey]
  
  for (const apiKey of apiKeysToTry) {
    console.log(`Trying with API key ${apiKeysToTry.indexOf(apiKey) + 1}/${apiKeysToTry.length}`)
    
    // 각 모델을 순서대로 시도
    for (const model of models) {
      console.log(`🔄 Trying model: ${model} with API key ${apiKeysToTry.indexOf(apiKey) + 1}`)
      
      const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: SYSTEM_PROMPT + '\n\n이 사업자등록증 이미지를 분석해주세요.'
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    }

    console.log('Request URL:', 'https://openrouter.ai/api/v1/chat/completions')
    console.log('Request model:', requestBody.model)

    try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bizscan.vercel.app',
        'X-Title': 'BizScan'
      },
      body: JSON.stringify(requestBody)
    })

    console.log('Response status:', response.status)
    console.log('Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorData = await response.text()
      console.error('OpenRouter API error:', errorData)
      console.error('Response status:', response.status)
      throw new Error(`API request failed: ${response.status} - ${errorData}`)
    }

    const data = await response.json()
    console.log('API Response:', JSON.stringify(data, null, 2))
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('Invalid response structure:', data)
      throw new Error('Invalid API response structure')
    }
    
    const content = data.choices[0].message.content
    console.log('Extracted content:', content)
    
    // JSON 파싱 (마크다운 코드 블록 제거)
    let extractedData: ExtractedData
    let cleanContent = content
    try {
      // ```json ... ``` 형식 제거
      if (content.includes('```json')) {
        cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      } else if (content.includes('```')) {
        cleanContent = content.replace(/```\s*/g, '').trim()
      }
      
      extractedData = JSON.parse(cleanContent) as ExtractedData
      console.log('Parsed data:', extractedData)
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      console.error('Content that failed to parse:', content)
      console.error('Cleaned content:', cleanContent)
      throw new Error('Failed to parse AI response as JSON')
    }

    // 사업자등록번호 형식 정규화
    if (extractedData.사업자등록번호) {
      const cleaned = extractedData.사업자등록번호.replace(/[^0-9]/g, '')
      console.log('Cleaned business number:', cleaned)
      if (cleaned.length === 10) {
        extractedData.사업자등록번호 = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`
        console.log('Formatted business number:', extractedData.사업자등록번호)
      }
    }

      return extractedData
    } catch (error) {
      console.error(`❌ Error with model ${model}:`, error)
      lastError = error
      
      // 429 에러인 경우 다음 모델 시도
      if (error instanceof Error && error.message.includes('429')) {
        console.log(`⚠️ Model ${model} is rate limited, trying next model...`)
        // 잠시 대기 후 다음 모델 시도
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
      
      // 다른 에러인 경우에도 다음 모델 시도
      console.log(`⚠️ Model ${model} failed, trying next model...`)
      continue
    }
    }
  }
  
  // 모든 API 키와 모델 조합이 실패한 경우
  console.error('All API keys and models failed. Last error:', lastError)
  throw lastError || new Error('All API keys and models failed')
}

export async function POST(req: NextRequest) {
  console.log('POST /api/extract called')
  
  // IP 체크 (선택사항)
  const clientIP = getClientIP(req)
  if (!isAllowedIP(clientIP)) {
    console.log('Access denied for IP:', clientIP)
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    )
  }
  
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    console.log('Number of files received:', files.length)

    if (files.length === 0) {
      console.error('No files provided')
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const allExtractedData: any[] = []
    const failedFiles: string[] = [] // 실패한 파일 목록

    // *** FIX: 순차 처리 로직만 남기고, 재시도 로직을 적용 ***
    const MAX_RETRIES = 3 // 파일당 최대 재시도 횟수
    
    // 각 파일을 순차적으로 처리
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`\n=== Processing file ${i + 1}/${files.length}: ${file.name} ===`)
      
      let success = false
      let retryCount = 0
      
      // 재시도 로직
      while (!success && retryCount < MAX_RETRIES) {
        try {
          console.log(`Attempt ${retryCount + 1}/${MAX_RETRIES} for ${file.name}`)
          const buffer = Buffer.from(await file.arrayBuffer())
          const data = await extractInfoFromImage(buffer)
          
          console.log(`✅ Successfully extracted data from ${file.name}:`, data)
          
          // 성공한 데이터 변환
          const mappedData = {
            companyAndRepresentative: `${data.상호명 || ''}(${data.대표자명 || ''})`,
            openTime: '',
            memo: '',
            address: data.사업자주소 || '',
            businessRegistrationNumber: data.사업자등록번호 || '',
            phoneNumber: '',
            isOperational: ''
          }
          
          allExtractedData.push(mappedData)
          success = true
          
        } catch (error) {
          console.error(`❌ Attempt ${retryCount + 1} failed for ${file.name}:`, error)
          retryCount++
          
          if (retryCount < MAX_RETRIES) {
            console.log(`⏳ Waiting 2 seconds before retry...`)
            await new Promise(resolve => setTimeout(resolve, 2000))
          }
        }
      }
      
      // 모든 재시도 실패 시 - 실패 목록에 추가
      if (!success) {
        console.error(`❌❌ All attempts failed for ${file.name}`)
        failedFiles.push(file.name)
      }
    }
    
    // *** FIX: 불필요한 if(false) 블록과 중복되는 else 블록 전체 제거 ***

    // 성공한 데이터가 하나도 없으면 에러 반환
    if (allExtractedData.length === 0) {
      return NextResponse.json(
        { 
          error: '모든 파일 처리에 실패했습니다.',
          failedFiles: failedFiles 
        },
        { status: 400 }
      )
    }

    // 엑셀 파일 생성
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('사업자등록증 데이터')

    // 열 정의
    worksheet.columns = [
      { header: '상호명(대표자명)', key: 'companyAndRepresentative', width: 40 },
      { header: '오픈시간', key: 'openTime', width: 20 },
      { header: '메모', key: 'memo', width: 30 },
      { header: '주소', key: 'address', width: 60 },
      { header: '사업자번호', key: 'businessRegistrationNumber', width: 25 },
      { header: '전화번호', key: 'phoneNumber', width: 20 },
      { header: '영업가능', key: 'isOperational', width: 15 },
    ]

    // 헤더 스타일링
    worksheet.getRow(1).font = { bold: true }
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    }

    // 데이터 추가 (성공한 데이터만)
    allExtractedData.forEach(data => {
      worksheet.addRow(data)
    })

    // 엑셀 파일을 버퍼로 변환
    const buffer = await workbook.xlsx.writeBuffer()

    // 실패한 파일 정보를 헤더에 포함
    const headers: HeadersInit = {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="bizscan_results.xlsx"'
    }
    
    if (failedFiles.length > 0) {
      headers['X-Failed-Files'] = JSON.stringify(failedFiles)
    }

    // 응답 반환
    return new NextResponse(buffer, { headers })
  } catch (error) {
    console.error('Error processing request:', error)
    return NextResponse.json(
      { error: 'Failed to process images' },
      { status: 500 }
    )
  }
}