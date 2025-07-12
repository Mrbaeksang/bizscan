import { NextRequest, NextResponse } from 'next/server'
import { getClientIP, isAllowedIP } from '@/lib/ip-check'
import sharp from 'sharp'

// 시스템 프롬프트 정의
const SYSTEM_PROMPT = `당신은 대한민국 사업자등록증 이미지 분석 전문가입니다.

당신의 임무:
사업자등록증 이미지에서 정확히 다음 3가지 정보만 추출하세요:
1. "상호명" - 사업체 이름
2. "사업자주소" - 사업장 소재지 전체 주소
3. "사업자등록번호" - 10자리 사업자번호

중요 규칙:
- 반드시 JSON 형식으로만 응답하세요
- 다른 설명이나 추가 텍스트 없이 JSON만 반환하세요
- 찾을 수 없는 정보는 빈 문자열("")로 표시하세요
- 사업자등록번호는 반드시 "XXX-XX-XXXXX" 형식으로 변환하세요
- 주소는 발견된 전체 주소를 그대로 포함하세요

응답 예시:
{
  "상호명": "주식회사 샘플",
  "사업자주소": "서울특별시 강남구 테헤란로 123 샘플빌딩 5층",
  "사업자등록번호": "123-45-67890"
}`

interface ExtractedData {
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

  // 이미지 크기 최적화 (1MB 이상이면 압축)
  let optimizedBuffer = imageBuffer
  if (imageBuffer.length > 1024 * 1024) {
    try {
      optimizedBuffer = await sharp(imageBuffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer()
      console.log(`🖼️ [BIZSCAN] 이미지 압축: ${imageBuffer.length} → ${optimizedBuffer.length} bytes`)
    } catch (error) {
      console.log(`🖼️ [BIZSCAN] 이미지 압축 실패, 원본 사용:`, error)
      optimizedBuffer = imageBuffer
    }
  }

  const base64Image = optimizedBuffer.toString('base64')

  // 더 빠른 모델 우선 사용
  const models = ['google/gemini-2.0-flash-lite-001', 'anthropic/claude-3-haiku']
  
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
        // AbortController로 타임아웃 설정 (8초)
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000)

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://bizscan.vercel.app',
            'X-Title': 'BizScan'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

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
        
        // AbortError (타임아웃)인 경우 다음 모델로 빠르게 이동
        if (error instanceof Error && error.name === 'AbortError') {
          console.log(`⏱️ [BIZSCAN] ${model} 타임아웃, 다음 모델 시도`)
          continue
        }
        
        // 429 에러인 경우 다음 모델 시도 (대기시간 단축)
        if (error instanceof Error && error.message.includes('429')) {
          console.log(`🔄 [BIZSCAN] ${model} 요청 제한, 다음 모델 시도`)
          await new Promise(resolve => setTimeout(resolve, 500))
          continue
        }
        
        console.log(`❌ [BIZSCAN] ${model} 실패:`, error instanceof Error ? error.message : error)
        continue
      }
    }
  }
  
  throw lastError || new Error('All API keys and models failed')
}

// 배달앱 입점 여부 확인 타입
interface DeliveryStatus {
  ddangyo: 'registered' | 'available' | 'unknown'
  yogiyo: 'registered' | 'available' | 'unknown'
  coupangeats: 'registered' | 'available' | 'unknown'
}

// 땡겨요 입점 확인
async function checkDdangyo(bizRegNo: string): Promise<'registered' | 'available' | 'unknown'> {
  try {
    const response = await fetch('https://boss.ddangyo.com/o2o/shop/cm/requestIsBizRegNoTemp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Origin': 'https://boss.ddangyo.com',
        'Referer': 'https://boss.ddangyo.com/join',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        dma_onlineApply04: {
          biz_reg_no: bizRegNo.replace(/-/g, ''),
          sotid: "0000"
        }
      })
    })
    
    const data = await response.json()
    console.log(`🚚 [DDANGYO] ${bizRegNo} 응답:`, JSON.stringify(data))
    
    // 실제 응답 구조에 맞춰 수정
    if (data.dma_result?.result === "1000") {
      console.log(`🚚 [DDANGYO] ${bizRegNo} 판정: 이미 입점 (result: ${data.dma_result.result})`)
      return 'registered' // 이미 입점 (result: "1000")
    } else if (data.dma_error?.resultCode === "000") {
      console.log(`🚚 [DDANGYO] ${bizRegNo} 판정: 입점 가능 (error.resultCode: ${data.dma_error.resultCode})`)
      return 'available' // 입점 가능 (error의 resultCode가 "000")
    } else {
      console.log(`🚚 [DDANGYO] ${bizRegNo} 판정: 알 수 없음 - dma_result:`, data.dma_result, 'dma_error:', data.dma_error)
      return 'unknown'
    }
  } catch (error) {
    console.log(`🚚 [DDANGYO] ${bizRegNo} 에러:`, error)
    return 'unknown'
  }
}

// 요기요 입점 확인
async function checkYogiyo(bizRegNo: string): Promise<'registered' | 'available' | 'unknown'> {
  try {
    const cleanBizNo = bizRegNo.replace(/-/g, '')
    const response = await fetch(`https://ceo-api.yogiyo.co.kr/join/validate-company-number/?company_number=${cleanBizNo}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://ceo.yogiyo.co.kr',
        'Referer': 'https://ceo.yogiyo.co.kr/'
      }
    })
    
    const data = await response.json()
    console.log(`🍕 [YOGIYO] ${bizRegNo} 응답:`, JSON.stringify(data))
    
    if (data.message?.includes('이미 등록된') || 
        data.context?.company_number?.[0]?.includes('이미 등록된')) {
      console.log(`🍕 [YOGIYO] ${bizRegNo} 판정: 이미 입점 (${data.message || data.context?.company_number?.[0]})`)
      return 'registered' // 이미 입점
    } else if (data.message?.includes('입점신청 가능')) {
      console.log(`🍕 [YOGIYO] ${bizRegNo} 판정: 입점 가능 (${data.message})`)
      return 'available' // 입점 가능
    } else {
      console.log(`🍕 [YOGIYO] ${bizRegNo} 판정: 알 수 없음 (${data.message})`)
      return 'unknown'
    }
  } catch (error) {
    console.log(`🍕 [YOGIYO] ${bizRegNo} 에러:`, error)
    return 'unknown'
  }
}

// 쿠팡이츠 입점 확인
async function checkCoupangEats(bizRegNo: string): Promise<'registered' | 'available' | 'unknown'> {
  try {
    const cleanBizNo = bizRegNo.replace(/-/g, '')
    const response = await fetch(`https://store.coupangeats.com/api/v1/merchant/web/businessregistration/verify?bizNo=${cleanBizNo}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    
    const data = await response.json()
    console.log(`🥘 [COUPANG] ${bizRegNo} 응답:`, JSON.stringify(data))
    
    // 실제 응답 구조에 맞춰 수정
    if (data.error?.message?.includes('이미 등록된 사업자등록번호')) {
      console.log(`🥘 [COUPANG] ${bizRegNo} 판정: 이미 입점 (${data.error.message})`)
      return 'registered' // 이미 입점
    } else if (data.error?.message?.includes('유효하지 않습니다')) {
      console.log(`🥘 [COUPANG] ${bizRegNo} 판정: 알 수 없음 (${data.error.message})`)
      return 'unknown' // 유효하지 않은 사업자번호
    } else if (data.data === true && data.code === "SUCCESS") {
      console.log(`🥘 [COUPANG] ${bizRegNo} 판정: 입점 가능 (data: true, code: SUCCESS)`)
      return 'available' // 입점 가능
    } else if (data.data === null && !data.error) {
      console.log(`🥘 [COUPANG] ${bizRegNo} 판정: 입점 가능 (data: null, no error)`)
      return 'available' // 입점 가능
    } else {
      console.log(`🥘 [COUPANG] ${bizRegNo} 판정: 알 수 없음 - data:`, data.data, 'error:', data.error, 'code:', data.code)
      return 'unknown'
    }
  } catch (error) {
    console.log(`🥘 [COUPANG] ${bizRegNo} 에러:`, error)
    return 'unknown'
  }
}

// 배달앱 입점 여부 종합 확인
async function checkDeliveryApps(bizRegNo: string): Promise<DeliveryStatus> {
  if (!bizRegNo || bizRegNo.trim() === '') {
    return {
      ddangyo: 'unknown',
      yogiyo: 'unknown',
      coupangeats: 'unknown'
    }
  }
  
  console.log(`🔍 [DELIVERY] ${bizRegNo} 배달앱 입점 확인 시작`)
  
  const [ddangyo, yogiyo, coupangeats] = await Promise.all([
    checkDdangyo(bizRegNo),
    checkYogiyo(bizRegNo),
    checkCoupangEats(bizRegNo)
  ])
  
  return { ddangyo, yogiyo, coupangeats }
}

// 모든 배달앱에 입점되어 있는지 확인
function isAllRegistered(status: DeliveryStatus): boolean {
  return status.ddangyo === 'registered' && 
         status.yogiyo === 'registered' && 
         status.coupangeats === 'registered'
}

// 배달앱 상태를 문자열로 포맷팅 (엄격한 기준: 확실한 가능만 가능, 나머지는 모두 불가)
function formatDeliveryStatus(status: DeliveryStatus): string {
  const formatStatus = (platform: string, state: string) => {
    switch (state) {
      case 'available': return `${platform}(가능)` // 100% 확실한 입점 가능만
      default: return `${platform}(불가)` // registered, unknown 등 모든 경우
    }
  }
  
  return [
    formatStatus('땡겨요', status.ddangyo),
    formatStatus('요기요', status.yogiyo),
    formatStatus('쿠팡이츠', status.coupangeats)
  ].join(' / ')
}

// AI가 웹 검색으로 업체 정보 수집
async function searchBusinessInfo(companyName: string, address: string): Promise<{phoneNumber: string, openTime: string}> {
  try {
    const apiKeys = process.env.OPENROUTER_API_KEY?.split(',').map(key => key.trim()) || []
    const primaryApiKey = apiKeys[0] || process.env.OPENROUTER_API_KEY
    
    if (!primaryApiKey) {
      console.log(`🔍 [AI SEARCH] OpenRouter API 키가 설정되지 않음`)
      return { phoneNumber: '미확인', openTime: '미확인' }
    }

    // 지역명 추출하여 검색 프롬프트 구성
    const region = extractRegionFromAddress(address)
    const searchPrompt = `다음 업체의 전화번호와 영업시간을 네이버나 구글에서 검색해서 찾아주세요:

업체명: ${companyName}
주소: ${address}
지역: ${region}

중요한 규칙:
1. 반드시 정확한 정보만 제공하세요
2. 검색 결과에서 해당 업체와 정확히 일치하는 정보만 사용하세요
3. 불확실하거나 다른 업체의 정보일 가능성이 있으면 "미확인"으로 응답하세요
4. 전화번호는 반드시 해당 업체의 것이어야 합니다
5. 영업시간도 반드시 해당 업체의 것이어야 합니다

다음 정보를 JSON 형식으로 제공해주세요:
- phoneNumber: 전화번호 (확실하지 않으면 "미확인")
- openTime: 영업시간 (확실하지 않으면 "미확인")

응답 예시:
{
  "phoneNumber": "031-123-4567",
  "openTime": "09:00-22:00"
}

또는 불확실한 경우:
{
  "phoneNumber": "미확인",
  "openTime": "미확인"
}

반드시 JSON 형식으로만 응답하고, 다른 설명은 포함하지 마세요.`
    
    console.log(`🔍 [AI SEARCH] AI에게 검색 요청: ${companyName} (${region})`)
    
    const requestBody = {
      model: 'google/gemini-2.0-flash-lite-001',
      messages: [
        {
          role: 'user',
          content: searchPrompt
        }
      ],
      temperature: 0.1 // 더 일관성 있는 응답을 위해 낮은 temperature
    }

    // AbortController로 타임아웃 설정 (5초)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${primaryApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bizscan.vercel.app',
        'X-Title': 'BizScan'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorData = await response.text()
      console.log(`🔍 [AI SEARCH] API 요청 실패: ${response.status} - ${errorData}`)
      return { phoneNumber: '미확인', openTime: '미확인' }
    }

    const data = await response.json()
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.log(`🔍 [AI SEARCH] 잘못된 API 응답 구조`)
      return { phoneNumber: '미확인', openTime: '미확인' }
    }
    
    const content = data.choices[0].message.content
    console.log('🔍 [AI SEARCH] AI 원본 응답:', content)
    
    // JSON 파싱 (마크다운 코드 블록 제거)
    let cleanContent = content
    
    if (content.includes('```json')) {
      cleanContent = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
    } else if (content.includes('```')) {
      cleanContent = content.replace(/```\s*/g, '').trim()
    }
    
    console.log('🔍 [AI SEARCH] 정리된 JSON:', cleanContent)
    
    const businessInfo = JSON.parse(cleanContent)
    console.log('🔍 [AI SEARCH] 파싱된 정보:', businessInfo)

    // 응답 검증 및 정리
    const phoneNumber = String(businessInfo.phoneNumber || '').trim()
    const openTime = String(businessInfo.openTime || '').trim()
    
    // 빈 문자열은 "미확인"으로 변경
    const finalPhoneNumber = phoneNumber === '' ? '미확인' : phoneNumber
    const finalOpenTime = openTime === '' ? '미확인' : openTime
    
    // 전화번호 형식 간단 검증 (한국 전화번호 패턴이 아니면 미확인)
    const phonePattern = /^(0\d{1,2}-?\d{3,4}-?\d{4}|1\d{3}-?\d{4}|050\d-?\d{4}-?\d{4})$/
    const isValidPhone = finalPhoneNumber === '미확인' || phonePattern.test(finalPhoneNumber.replace(/[^0-9-]/g, ''))
    
    console.log('🔍 [AI SEARCH] 검증 결과:', {
      phoneNumber: finalPhoneNumber,
      openTime: finalOpenTime,
      phoneValid: isValidPhone
    })

    return {
      phoneNumber: isValidPhone ? finalPhoneNumber : '미확인',
      openTime: finalOpenTime
    }
    
  } catch (error) {
    console.log(`🔍 [AI SEARCH] 검색 에러:`, error)
    return { phoneNumber: '미확인', openTime: '미확인' }
  }
}

// 주소에서 지역명 추출
function extractRegionFromAddress(address: string): string {
  if (!address) return ''
  
  const parts = address.split(' ')
  // "충청북도 진천군 진천읍" -> "진천군" 또는 "진천"
  if (parts.length >= 3) {
    return parts[2].replace(/읍|면|동$/g, '') // 읍면동 제거
  } else if (parts.length >= 2) {
    return parts[1].replace(/군|시|구$/g, '') // 군시구 제거  
  }
  return parts[0] || ''
}

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  console.log(`🚀 [BIZSCAN] API 시작: ${new Date().toISOString()}`)
  console.log(`🔑 [BIZSCAN] API 키 설정됨:`, !!process.env.OPENROUTER_API_KEY)
  console.log(`⚙️ [BIZSCAN] 환경:`, process.env.NODE_ENV)
  
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
    
    // 배달앱 입점 여부 확인
    console.log(`📋 [BIZSCAN] 사업자번호로 배달앱 확인 시작: ${data.사업자등록번호}`)
    const deliveryStatus = await checkDeliveryApps(data.사업자등록번호)
    console.log(`📋 [BIZSCAN] 배달앱 확인 결과:`, JSON.stringify(deliveryStatus))
    
    // AI 웹 검색으로 업체 정보 수집
    console.log(`📋 [BIZSCAN] AI 웹 검색으로 업체 정보 수집 시작`)
    const businessInfo = await searchBusinessInfo(data.상호명, data.사업자주소)
    console.log(`📋 [BIZSCAN] AI 검색 결과:`, businessInfo)
    
    // 모든 배달앱에 이미 입점된 경우 필터링
    if (isAllRegistered(deliveryStatus)) {
      console.log(`📋 [BIZSCAN] 모든 배달앱 입점으로 필터링됨: ${data.사업자등록번호}`)
      return NextResponse.json({
        success: false,
        error: '모든 배달앱에 이미 입점된 업체입니다.'
      })
    }
    
    // 성공한 데이터 변환
    const mappedData = {
      companyAndRepresentative: data.상호명 || '',
      openTime: businessInfo.openTime,
      memo: '',
      address: data.사업자주소 || '',
      businessRegistrationNumber: data.사업자등록번호 || '',
      phoneNumber: businessInfo.phoneNumber,
      isOperational: formatDeliveryStatus(deliveryStatus),
      상호명: data.상호명,
      사업자주소: data.사업자주소,
      사업자등록번호: data.사업자등록번호
    }
    
    const totalTime = Date.now() - startTime
    console.log(`✅ [BIZSCAN] API 완료: ${totalTime}ms`)
    
    return NextResponse.json({
      success: true,
      data: mappedData
    })
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error(`❌ [BIZSCAN] API 실패 (${totalTime}ms):`, error)
    
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process image' 
      },
      { status: 500 }
    )
  }
}