import { NextRequest, NextResponse } from 'next/server'
import { sessionStore } from '@/lib/auth/session-store-file'

// Discord 웹훅으로 승인 요청
async function sendApprovalRequest(sessionId: string, ip: string, fileCount?: number) {
  const currentTime = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL
  
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bizscan-git-main-baeksangs-projects.vercel.app'
  const approveUrl = `${baseUrl}/api/auth/approve?sid=${sessionId}`
  const denyUrl = `${baseUrl}/api/auth/deny?sid=${sessionId}`
  
  if (!discordWebhookUrl) {
    console.log(`
🔐 [분석 승인 요청]
==================
요청 시간: ${currentTime}
접속 IP: ${ip}
세션 ID: ${sessionId}
파일 수: ${fileCount || 0}개

✅ 승인: ${approveUrl}
❌ 거부: ${denyUrl}
==================
Discord 웹훅이 설정되지 않아 콘솔에만 출력
`)
    return true
  }

  try {
    const response = await fetch(discordWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: '@everyone',
        embeds: [{
          title: '🚨 BizScan 분석 승인 요청',
          color: 0xFF6B6B,
          fields: [
            {
              name: '📍 접속 IP',
              value: ip,
              inline: true
            },
            {
              name: '🕐 요청 시간',
              value: currentTime,
              inline: true
            },
            {
              name: '📊 파일 수',
              value: `${fileCount || 0}개`,
              inline: true
            }
          ],
          description: `**승인 또는 거부를 선택하세요:**\n\n✅ **[승인하기](${approveUrl})**\n\n❌ **[거부하기](${denyUrl})**\n\n⏰ **5분 내 응답 필요**`,
          timestamp: new Date().toISOString(),
          footer: {
            text: 'BizScan OCR Service'
          }
        }]
      })
    })

    if (response.ok) {
      console.log(`💬 [DISCORD] 승인 요청 발송 성공 - Session: ${sessionId}`)
      return true
    } else {
      console.error('💬 [DISCORD] Discord 발송 실패:', await response.text())
      return false
    }
  } catch (error) {
    console.error('💬 [DISCORD] Discord 발송 오류:', error)
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const { fileCount } = await req.json()
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    
    // 세션 생성
    const session = sessionStore.create(ip)
    
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://bizscan-git-main-baeksangs-projects.vercel.app'
    
    console.log(`🔐 [ANALYSIS] 분석 승인 요청 - IP: ${ip}, Session: ${session.id}, Files: ${fileCount}`)
    console.log(`🔗 [ANALYSIS] 승인 URL: ${baseUrl}/api/auth/approve?sid=${session.id}`)
    
    // Discord로 승인 요청 발송
    const messageSent = await sendApprovalRequest(session.id, ip, fileCount)
    
    if (!messageSent) {
      return NextResponse.json(
        { error: 'Discord 알림 발송 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      message: '관리자에게 승인 요청을 보냈습니다. Discord를 확인해주세요.',
      expiresAt: session.expiresAt
    })
    
  } catch (error) {
    console.error('🔐 [ANALYSIS] 승인 요청 처리 중 오류:', error)
    return NextResponse.json(
      { error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}