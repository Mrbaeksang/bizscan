import { NextRequest, NextResponse } from 'next/server'
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
  const apiKeys = process.env.OPENROUTER_API_KEY?.split(',').map(key => key.trim()) || []
  const primaryApiKey = apiKeys[0] || process.env.OPENROUTER_API_KEY
  
  if (!primaryApiKey) {
    throw new Error('OPENROUTER_API_KEY is not set')
  }

  const base64Image = imageBuffer.toString('base64')

  // 단일 모델 사용
  const models = ['google/gemini-2.0-flash-lite-001']
  
  console.log(`🎯 [BIZSCAN] 사용할 모델 순위: ${models.join(' → ')}`)

  let lastError: Error | null = null
  const apiKeysToTry = apiKeys.length > 0 ? apiKeys : [primaryApiKey]
  
  for (const apiKey of apiKeysToTry) {
    for (const model of models) {
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

        if (!response.ok) {
          const errorData = await response.text()
          throw new Error(`API request failed: ${response.status} - ${errorData}`)
        }

        const data = await response.json()
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
          throw new Error('Invalid API response structure')
        }
        
        const content = data.choices[0].message.content
        console.log('🔍 [BIZSCAN] 제미나이 원본 응답:', content)
        
        // JSON 파싱 (마크다운 코드 블록 제거)
        let cleanContent = content
        
        if (content.includes('```json')) {
          cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        } else if (content.includes('```')) {
          cleanContent = content.replace(/```\s*/g, '').trim()
        }
        
        console.log('🧹 [BIZSCAN] 정리된 JSON:', cleanContent)
        
        // eslint-disable-next-line prefer-const
        let extractedData = JSON.parse(cleanContent) as ExtractedData
        console.log('📝 [BIZSCAN] 파싱된 데이터:', extractedData)

        // 사업자등록번호 형식 정규화
        if (extractedData.사업자등록번호) {
          const cleaned = extractedData.사업자등록번호.replace(/[^0-9]/g, '')
          if (cleaned.length === 10) {
            extractedData.사업자등록번호 = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5)}`
          }
        }

        return extractedData
      } catch (error) {
        lastError = error as Error
        
        // 429 에러인 경우 다음 모델 시도 (대기시간 단축)
        if (error instanceof Error && error.message.includes('429')) {
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        }
        
        continue
      }
    }
  }
  
  throw lastError || new Error('All API keys and models failed')
}

export async function POST(req: NextRequest) {
  // IP 체크 (선택사항)
  const clientIP = getClientIP(req)
  if (!isAllowedIP(clientIP)) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    )
  }
  
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const data = await extractInfoFromImage(buffer)
    
    // 성공한 데이터 변환
    const mappedData = {
      companyAndRepresentative: `${data.상호명 || ''}(${data.대표자명 || ''})`,
      openTime: '',
      memo: '',
      address: data.사업자주소 || '',
      businessRegistrationNumber: data.사업자등록번호 || '',
      phoneNumber: '',
      isOperational: '',
      대표자명: data.대표자명,
      상호명: data.상호명,
      사업자주소: data.사업자주소,
      사업자등록번호: data.사업자등록번호
    }
    
    return NextResponse.json({
      success: true,
      data: mappedData
    })
    
  } catch (error) {
    console.error('Error processing single file:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process image' 
      },
      { status: 500 }
    )
  }
}