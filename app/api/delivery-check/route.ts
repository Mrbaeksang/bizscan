import { NextRequest, NextResponse } from 'next/server'

// 배달앱 입점 여부 확인 타입
interface DeliveryStatus {
  ddangyo: 'registered' | 'available' | 'unknown'
  yogiyo: 'registered' | 'available' | 'unknown'
  coupangeats: 'registered' | 'available' | 'unknown'
}

// 땡겨요 입점 확인
async function checkDdangyo(bizRegNo: string): Promise<'registered' | 'available' | 'unknown'> {
  try {
    // AbortController로 타임아웃 설정 (5초)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
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
          biz_reg_no: bizRegNo,
          sotid: "0000"
        }
      }),
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
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
    // AbortController로 타임아웃 설정 (5초)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(`https://ceo-api.yogiyo.co.kr/join/validate-company-number/?company_number=${bizRegNo}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://ceo.yogiyo.co.kr',
        'Referer': 'https://ceo.yogiyo.co.kr/'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
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
    // AbortController로 타임아웃 설정 (5초)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(`https://store.coupangeats.com/api/v1/merchant/web/businessregistration/verify?bizNo=${bizRegNo}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
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

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  console.log(`🚀 [DELIVERY CHECK] API 시작: ${new Date().toISOString()}`)
  
  try {
    const { businessNumber } = await req.json()
    console.log(`📥 [DELIVERY CHECK] 요청 받음: ${businessNumber}`)
    
    if (!businessNumber) {
      return NextResponse.json(
        { error: '사업자번호를 입력해주세요.' },
        { status: 400 }
      )
    }
    
    // 사업자번호 형식 검증 (10자리 숫자)
    const cleanNumber = businessNumber.replace(/-/g, '')
    if (!/^\d{10}$/.test(cleanNumber)) {
      return NextResponse.json(
        { error: '올바른 사업자번호 형식이 아닙니다.' },
        { status: 400 }
      )
    }
    
    console.log(`🔍 [DELIVERY CHECK] ${cleanNumber} 배달앱 입점 확인 시작`)
    
    // 병렬로 3개 플랫폼 확인 - 하이픈 없는 숫자만 전달
    const [ddangyo, yogiyo, coupangeats] = await Promise.all([
      checkDdangyo(cleanNumber),
      checkYogiyo(cleanNumber),
      checkCoupangEats(cleanNumber)
    ])
    
    const result: DeliveryStatus = { ddangyo, yogiyo, coupangeats }
    
    // 하이픈 포맷팅 (응답용)
    const formattedNumber = `${cleanNumber.slice(0, 3)}-${cleanNumber.slice(3, 5)}-${cleanNumber.slice(5)}`
    
    console.log(`📋 [DELIVERY CHECK] ${formattedNumber} 결과:`, result)
    
    const totalTime = Date.now() - startTime
    console.log(`✅ [DELIVERY CHECK] API 완료: ${totalTime}ms`)
    
    return NextResponse.json({
      success: true,
      businessNumber: formattedNumber,
      status: result,
      timestamp: new Date().toISOString(),
      executionTime: `${totalTime}ms`
    })
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error(`❌ [DELIVERY CHECK] API 실패 (${totalTime}ms):`, error)
    console.error(`❌ [DELIVERY CHECK] 에러 스택:`, error instanceof Error ? error.stack : 'No stack trace')
    
    return NextResponse.json(
      { 
        error: '확인 중 오류가 발생했습니다.', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}