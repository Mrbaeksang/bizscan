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
    
    if (data.dma_result?.result === "1000") {
      return 'registered' // 이미 입점
    } else if (data.dma_error?.resultCode === "000") {
      return 'available' // 입점 가능
    } else {
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
      return 'registered' // 이미 입점
    } else if (data.message?.includes('입점신청 가능')) {
      return 'available' // 입점 가능
    } else {
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
    
    if (data.error?.message?.includes('이미 등록된 사업자등록번호')) {
      return 'registered' // 이미 입점
    } else if (data.error?.message?.includes('유효하지 않습니다')) {
      return 'unknown' // 유효하지 않은 사업자번호
    } else if (data.data === true && data.code === "SUCCESS") {
      return 'available' // 입점 가능
    } else if (data.data === null && !data.error) {
      return 'available' // 입점 가능
    } else {
      return 'unknown'
    }
  } catch (error) {
    console.log(`🥘 [COUPANG] ${bizRegNo} 에러:`, error)
    return 'unknown'
  }
}

export async function POST(req: NextRequest) {
  try {
    const { businessNumber } = await req.json()
    
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
    
    // 하이픈 포맷팅
    const formattedNumber = `${cleanNumber.slice(0, 3)}-${cleanNumber.slice(3, 5)}-${cleanNumber.slice(5)}`
    
    console.log(`🔍 [DELIVERY CHECK] ${formattedNumber} 배달앱 입점 확인 시작`)
    
    // 병렬로 3개 플랫폼 확인
    const [ddangyo, yogiyo, coupangeats] = await Promise.all([
      checkDdangyo(formattedNumber),
      checkYogiyo(formattedNumber),
      checkCoupangEats(formattedNumber)
    ])
    
    const result: DeliveryStatus = { ddangyo, yogiyo, coupangeats }
    
    console.log(`📋 [DELIVERY CHECK] ${formattedNumber} 결과:`, result)
    
    return NextResponse.json({
      success: true,
      businessNumber: formattedNumber,
      status: result,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('배달앱 확인 중 오류:', error)
    return NextResponse.json(
      { error: '확인 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}