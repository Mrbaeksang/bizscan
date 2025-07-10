import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // 로그인 페이지와 API는 인증 없이 접근 가능
  const isPublicPath = path === '/login' || path === '/api/auth/login'
  
  // 쿠키에서 토큰 확인
  const token = request.cookies.get('auth_token')?.value || ''
  
  // 로그인하지 않은 상태에서 보호된 페이지 접근 시 로그인 페이지로 리다이렉트
  if (!isPublicPath && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // 로그인한 상태에서 로그인 페이지 접근 시 메인 페이지로 리다이렉트
  if (isPublicPath && token && path === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }
  
  return NextResponse.next()
}

// 인증이 필요한 경로 설정
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
}