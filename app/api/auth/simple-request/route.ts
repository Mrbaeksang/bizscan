import { NextRequest, NextResponse } from 'next/server'

// 6자리 숫자 코드 생성 (무작위)
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// 카카오톡 나에게 보내기
async function sendKakaoMessage(userId: string, code: string, ip: string) {
  const currentTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  
  // 사용자 토큰이 필요함 (처음 한번만 설정)
  const kakaoAccessToken = process.env.KAKAO_ACCESS_TOKEN
  
  if (!kakaoAccessToken) {
    console.log(`
🔐 [BizScan 인증 번호]
==================
요청 시간: ${currentTime}
접속 IP: ${ip}
인증 번호: ${code}
==================
카카오톡 토큰이 없어서 콘솔에만 출력
`)
    return true
  }

  try {
    const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${kakaoAccessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        template_object: JSON.stringify({
          object_type: 'text',
          text: `🔐 BizScan 인증번호\n\n${code}\n\n요청시간: ${currentTime}\nIP: ${ip}`,
          link: {
            web_url: 'https://bizscan.vercel.app',
            mobile_web_url: 'https://bizscan.vercel.app'
          }
        })
      })
    })

    if (response.ok) {
      console.log(`📱 [KAKAO] 카카오톡 발송 성공: ${code}`)
      return true
    } else {
      console.error('📱 [KAKAO] 카카오톡 발송 실패:', await response.text())
      return false
    }
  } catch (error) {
    console.error('📱 [KAKAO] 카카오톡 발송 오류:', error)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return NextResponse.json(
        { error: '유효한 아이디를 입력해주세요.' },
        { status: 400 }
      )
    }

    // 인증 코드 생성 (서버 메모리에 저장 안함)
    const code = generateCode()
    
    console.log(`🔐 [AUTH] 인증 코드 요청 - User: ${userId}, IP: ${ip}, Code: ${code}`)
    
    // 카카오톡으로 코드 발송
    const messageSent = await sendKakaoMessage(userId.trim(), code, ip)
    
    if (!messageSent) {
      return NextResponse.json(
        { error: '카카오톡 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: '카카오톡으로 인증 코드가 발송되었습니다. 휴대폰을 확인해주세요.',
      // 코드는 클라이언트에 보내지 않음 (보안)
    })
    
  } catch (error) {
    console.error('🔐 [AUTH] 인증 코드 요청 처리 중 오류:', error)
    return NextResponse.json(
      { error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}