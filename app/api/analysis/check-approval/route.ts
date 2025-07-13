import { NextRequest, NextResponse } from 'next/server'
import { sessionStore } from '@/lib/auth/session-store'

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sid')
    
    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다.' },
        { status: 400 }
      )
    }
    
    const session = sessionStore.get(sessionId)
    
    if (!session) {
      return NextResponse.json(
        { error: '유효하지 않거나 만료된 세션입니다.' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      status: session.status,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt
    })
    
  } catch (error) {
    console.error('🔐 [ANALYSIS] 승인 상태 확인 중 오류:', error)
    return NextResponse.json(
      { error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}