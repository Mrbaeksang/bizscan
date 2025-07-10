// IP 체크 유틸리티
export const ALLOWED_IPS = process.env.ALLOWED_IPS?.split(',') || []

export function isAllowedIP(ip: string | null): boolean {
  if (!ip) return false
  if (process.env.NODE_ENV === 'development') return true
  if (ALLOWED_IPS.length === 0) return true // IP 제한 없음
  
  const clientIP = ip.split(',')[0].trim()
  return ALLOWED_IPS.includes(clientIP)
}

export function getClientIP(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  
  return realIP
}