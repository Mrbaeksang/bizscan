import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 허용할 IP 주소 목록 (환경변수 또는 기본값)
const ALLOWED_IPS = process.env.ALLOWED_IPS 
  ? process.env.ALLOWED_IPS.split(',').map(ip => ip.trim())
  : [
      '14.43.219.252',  // 당신의 IP
      '::1',            // localhost IPv6
      '127.0.0.1',      // localhost IPv4
    ]

export function middleware(request: NextRequest) {
  // IP 주소 가져오기
  const ip = request.ip || request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
  
  console.log('Incoming IP:', ip)
  
  // 개발 환경에서는 허용
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }
  
  // IP 확인
  if (ip && !ALLOWED_IPS.includes(ip.split(',')[0].trim())) {
    return new NextResponse('Access Denied', {
      status: 403,
      statusText: 'Forbidden',
    })
  }
  
  return NextResponse.next()
}

// 모든 경로에 적용
export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}