// 클라이언트 전용 저장소 (브라우저 메모리 + localStorage)

export interface StoredResult {
  id: string;
  fileName: string;
  data: {
    대표자명: string;
    상호명: string;
    사업자주소: string;
    사업자등록번호: string;
  };
  confidence: number;
  processedAt: Date;
  status: 'success' | 'failed';
  error?: string;
}

class ClientStorage {
  private results: StoredResult[] = [];

  // OCR 결과 저장 (브라우저 메모리)
  async saveResult(result: StoredResult): Promise<void> {
    this.results.push(result);
    console.log(`💾 [CLIENT] 결과 저장: ${result.fileName} (${result.status})`);
    
    // 중요한 데이터만 localStorage에 백업 (선택사항)
    this.backupToLocalStorage();
  }

  async getResults(status?: 'success' | 'failed'): Promise<StoredResult[]> {
    if (status) {
      return this.results.filter(r => r.status === status);
    }
    return this.results;
  }

  async clearAll(): Promise<void> {
    this.results = [];
    localStorage.removeItem('bizscan_backup');
    console.log(`🗑️ [CLIENT] 모든 결과 삭제`);
  }

  // localStorage에 백업 (새로고침 대비)
  private backupToLocalStorage(): void {
    try {
      const backup = {
        results: this.results,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('bizscan_backup', JSON.stringify(backup));
    } catch (error) {
      console.warn('localStorage 백업 실패:', error);
    }
  }

  // 페이지 새로고침 시 복원
  restoreFromLocalStorage(): void {
    try {
      const backup = localStorage.getItem('bizscan_backup');
      if (backup) {
        const data = JSON.parse(backup);
        this.results = data.results || [];
        console.log(`🔄 [CLIENT] ${this.results.length}개 결과 복원됨`);
      }
    } catch (error) {
      console.warn('localStorage 복원 실패:', error);
    }
  }

  // 인증 토큰 관리 (localStorage 전용)
  saveAuthToken(token: string): void {
    localStorage.setItem('bizscan_auth_token', token);
    console.log(`🎫 [CLIENT] 인증 토큰 저장`);
  }

  getAuthToken(): string | null {
    return localStorage.getItem('bizscan_auth_token');
  }

  clearAuthToken(): void {
    localStorage.removeItem('bizscan_auth_token');
    console.log(`🗑️ [CLIENT] 인증 토큰 삭제`);
  }

  // 현재 상태 요약
  getSummary(): { total: number; success: number; failed: number } {
    const success = this.results.filter(r => r.status === 'success').length;
    const failed = this.results.filter(r => r.status === 'failed').length;
    return {
      total: this.results.length,
      success,
      failed
    };
  }
}

// 싱글톤 인스턴스
export const clientStorage = new ClientStorage();

// 브라우저에서만 실행
if (typeof window !== 'undefined') {
  // 페이지 로드 시 복원
  clientStorage.restoreFromLocalStorage();
  
  // 페이지 언로드 시 백업
  window.addEventListener('beforeunload', () => {
    // 자동으로 backupToLocalStorage()가 saveResult에서 호출됨
  });
}