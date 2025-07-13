// 메모리 기반 세션 저장소 (프로덕션에서는 Redis 권장)
interface Session {
  id: string
  ip: string
  status: 'pending' | 'approved' | 'denied'
  createdAt: Date
  expiresAt: Date
}

class SessionStore {
  private sessions: Map<string, Session> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // 5분마다 만료된 세션 정리
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  create(ip: string): Session {
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36)
    const session: Session = {
      id,
      ip,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5분 만료
    }
    
    this.sessions.set(id, session)
    return session
  }

  get(id: string): Session | null {
    const session = this.sessions.get(id)
    if (!session) return null
    
    // 만료 체크
    if (new Date() > session.expiresAt) {
      this.sessions.delete(id)
      return null
    }
    
    return session
  }

  approve(id: string): boolean {
    const session = this.get(id)
    if (!session || session.status !== 'pending') return false
    
    session.status = 'approved'
    return true
  }

  deny(id: string): boolean {
    const session = this.get(id)
    if (!session || session.status !== 'pending') return false
    
    session.status = 'denied'
    return true
  }

  private cleanup() {
    const now = new Date()
    const entries = Array.from(this.sessions.entries())
    for (const [id, session] of entries) {
      if (now > session.expiresAt) {
        this.sessions.delete(id)
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval)
  }
}

// 싱글톤 인스턴스
export const sessionStore = new SessionStore()