import fs from 'fs'
import path from 'path'

// 파일 기반 세션 저장소 (개발/테스트용)
interface Session {
  id: string
  ip: string
  status: 'pending' | 'approved' | 'denied'
  createdAt: Date
  expiresAt: Date
}

class FileSessionStore {
  private sessionDir: string

  constructor() {
    // temp 디렉토리 사용
    this.sessionDir = path.join(process.cwd(), '.sessions')
    
    // 디렉토리 생성
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true })
    }
    
    // 시작 시 만료된 세션 정리
    this.cleanup()
  }

  private getFilePath(id: string): string {
    return path.join(this.sessionDir, `${id}.json`)
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
    
    // 파일로 저장
    fs.writeFileSync(this.getFilePath(id), JSON.stringify(session))
    console.log(`📁 [SESSION] 세션 생성: ${id}`)
    
    return session
  }

  get(id: string): Session | null {
    try {
      const filePath = this.getFilePath(id)
      if (!fs.existsSync(filePath)) {
        console.log(`❌ [SESSION] 세션 없음: ${id}`)
        return null
      }
      
      const data = fs.readFileSync(filePath, 'utf-8')
      const session = JSON.parse(data)
      
      // Date 객체로 변환
      session.createdAt = new Date(session.createdAt)
      session.expiresAt = new Date(session.expiresAt)
      
      // 만료 체크
      if (new Date() > session.expiresAt) {
        console.log(`⏰ [SESSION] 세션 만료: ${id}`)
        fs.unlinkSync(filePath)
        return null
      }
      
      console.log(`✅ [SESSION] 세션 조회: ${id}, 상태: ${session.status}`)
      return session
    } catch (error) {
      console.error(`❌ [SESSION] 세션 읽기 실패: ${id}`, error)
      return null
    }
  }

  approve(id: string): boolean {
    const session = this.get(id)
    if (!session || session.status !== 'pending') {
      console.log(`❌ [SESSION] 승인 실패: ${id}, 상태: ${session?.status || 'null'}`)
      return false
    }
    
    session.status = 'approved'
    fs.writeFileSync(this.getFilePath(id), JSON.stringify(session))
    console.log(`✅ [SESSION] 승인 완료: ${id}`)
    return true
  }

  deny(id: string): boolean {
    const session = this.get(id)
    if (!session || session.status !== 'pending') {
      console.log(`❌ [SESSION] 거부 실패: ${id}, 상태: ${session?.status || 'null'}`)
      return false
    }
    
    session.status = 'denied'
    fs.writeFileSync(this.getFilePath(id), JSON.stringify(session))
    console.log(`❌ [SESSION] 거부 완료: ${id}`)
    return true
  }

  private cleanup() {
    try {
      const files = fs.readdirSync(this.sessionDir)
      const now = new Date()
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.sessionDir, file)
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            const expiresAt = new Date(data.expiresAt)
            
            if (now > expiresAt) {
              fs.unlinkSync(filePath)
              console.log(`🧹 [SESSION] 만료된 세션 삭제: ${file}`)
            }
          } catch {
            // 잘못된 파일 삭제
            fs.unlinkSync(filePath)
          }
        }
      }
    } catch (error) {
      console.error('🧹 [SESSION] 정리 중 오류:', error)
    }
  }

  destroy() {
    // 모든 세션 파일 삭제
    try {
      if (fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true })
      }
    } catch (error) {
      console.error('❌ [SESSION] 삭제 중 오류:', error)
    }
  }
}

// 싱글톤 인스턴스
export const sessionStore = new FileSessionStore()