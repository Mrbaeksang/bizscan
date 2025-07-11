import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { data } = await request.json()
    
    if (!data || !data.상호명 || !data.대표자명) {
      return NextResponse.json({ 
        success: false, 
        error: '검수할 데이터가 부족합니다.' 
      })
    }

    const reviewPrompt = `
아래는 사업자등록증에서 OCR로 추출한 데이터입니다. 다음 사항을 검토하고 수정사항을 제안해주세요:

1. 상호명: ${data.상호명}
2. 대표자명: ${data.대표자명}  
3. 사업자주소: ${data.사업자주소}
4. 사업자등록번호: ${data.사업자등록번호}

검토 사항:
- 오타나 잘못된 문자 (예: ㅣ → l, ㅇ → o, 0 → O 등)
- 누락된 문자나 불완전한 단어
- 사업자등록번호 형식 (xxx-xx-xxxxx)
- 주소 정보의 완성도

응답 형식:
{
  "needsCorrection": true/false,
  "correctedData": {
    "상호명": "수정된 상호명",
    "대표자명": "수정된 대표자명", 
    "사업자주소": "수정된 주소",
    "사업자등록번호": "수정된 등록번호"
  },
  "corrections": [
    {
      "field": "필드명",
      "original": "원본 데이터",
      "corrected": "수정된 데이터",
      "reason": "수정 이유"
    }
  ]
}
`

    // 텍스트 검수 모델 순위 (1순위 → 2순위 → 3순위)
    const textModels = [
      'deepseek/deepseek-chat-v3-0324:free',  // 1순위
      'deepseek/deepseek-r1-0528:free',       // 2순위
      'deepseek/deepseek-r1:free'             // 3순위
    ]

    let lastError: Error | null = null
    
    for (const model of textModels) {
      try {
        console.log(`🔍 [BIZSCAN] 텍스트 검수 시도 중: ${model}`)
        
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://bizscan.vercel.app',
            'X-Title': 'BizScan Text Review'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              {
                role: 'system',
                content: '당신은 사업자등록증 OCR 데이터를 검토하는 전문가입니다. 정확한 한국어 처리와 사업자등록증 형식을 잘 알고 있습니다.'
              },
              {
                role: 'user',
                content: reviewPrompt
              }
            ],
            temperature: 0.1,
            max_tokens: 1000
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
          const reviewData = JSON.parse(reviewContent)
          
          console.log(`✅ [BIZSCAN] 텍스트 검수 성공: ${model}`)
          return NextResponse.json({
            success: true,
            data: reviewData,
            originalData: data,
            usage: result.usage,
            modelUsed: model
          })
        } catch {
          // JSON 파싱 실패 시 텍스트로 반환
          console.log(`⚠️ [BIZSCAN] JSON 파싱 실패, 원본 반환: ${model}`)
          return NextResponse.json({
            success: true,
            data: {
              needsCorrection: false,
              correctedData: data,
              corrections: [],
              rawResponse: reviewContent
            },
            originalData: data,
            modelUsed: model
          })
        }
      } catch (error) {
        lastError = error as Error
        console.error(`❌ [BIZSCAN] 텍스트 검수 실패: ${model}`, error)
        continue
      }
    }
    
    // 모든 모델 실패 시
    console.error(`❌ [BIZSCAN] 모든 텍스트 검수 모델 실패`)
    return NextResponse.json({ 
      success: false, 
      error: `텍스트 검수 실패: ${lastError?.message || '알 수 없는 오류'}` 
    })

  } catch (error) {
    console.error('텍스트 검수 중 오류:', error)
    return NextResponse.json({ 
      success: false, 
      error: '텍스트 검수 중 오류가 발생했습니다.' 
    })
  }
}