import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json()

    // 환경변수에서 인증 정보 가져오기
    const validUsername = process.env.AUTH_USERNAME || 'admin'
    const validPassword = process.env.AUTH_PASSWORD || 'password123'

    // 인증 확인
    if (username === validUsername && password === validPassword) {
      // 간단한 토큰 생성 (실제로는 JWT 등을 사용하는 것이 좋음)
      const token = crypto.randomBytes(32).toString('hex')
      
      // 쿠키 설정
      const response = NextResponse.json({ 
        success: true,
        token 
      })
      
      response.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7일
        path: '/'
      })
      
      return response
    } else {
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      )
    }
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}