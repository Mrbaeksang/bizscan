'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileSpreadsheet, Mail, CheckCircle2, AlertCircle } from 'lucide-react'
import { clientStorage } from '@/lib/client-storage'

export default function SimpleAuthPage() {
  const [step, setStep] = useState<'input' | 'verify'>('input')
  const [userId, setUserId] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    // 이미 토큰이 있는지 확인
    const token = clientStorage.getAuthToken()
    if (token) {
      window.location.href = '/'
    }
  }, [])

  const handleRequestCode = async () => {
    if (!userId.trim()) {
      setMessage('아이디를 입력해주세요.')
      setStatus('error')
      return
    }

    setStatus('loading')
    
    try {
      const response = await fetch('/api/auth/simple-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: userId.trim()
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setStep('verify')
        setStatus('idle')
        setMessage(data.message)
      } else {
        setStatus('error')
        setMessage(data.error || '요청 처리 중 오류가 발생했습니다.')
      }
    } catch (error) {
      setStatus('error')
      setMessage('네트워크 오류가 발생했습니다.')
    }
  }

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setMessage('인증번호를 입력해주세요.')
      setStatus('error')
      return
    }

    // 클라이언트에서 간단한 토큰 생성 (서버 검증 없음)
    const token = btoa(JSON.stringify({
      userId: userId.trim(),
      code: code.trim(),
      loginTime: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }))
    
    // 클라이언트 저장소에 저장
    clientStorage.saveAuthToken(token)
    
    setMessage('인증 완료! 메인 페이지로 이동합니다...')
    setStatus('idle')
    
    setTimeout(() => {
      window.location.href = '/'
    }, 1000)
  }

  const handleCodeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6) // 숫자만, 6자리 제한
    setCode(value)
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-2 mb-4">
              <FileSpreadsheet className="h-10 w-10 text-primary" />
              <h1 className="text-3xl font-bold text-slate-900">BizScan</h1>
            </div>
            <p className="text-slate-600 text-center">
              간단 인증 로그인
            </p>
          </div>

          {status === 'error' && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          {step === 'input' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="userId" className="block text-sm font-medium mb-2">
                  아이디
                </label>
                <input
                  id="userId"
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="아이디를 입력하세요"
                  disabled={status === 'loading'}
                  onKeyPress={(e) => e.key === 'Enter' && handleRequestCode()}
                />
              </div>
              
              <Button 
                onClick={handleRequestCode}
                disabled={status === 'loading'}
                className="w-full h-12 text-lg"
              >
                {status === 'loading' ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    인증번호 요청 중...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-5 w-5" />
                    인증번호 요청하기
                  </>
                )}
              </Button>
              
              <div className="text-sm text-slate-500 text-center mt-4">
                관리자 이메일로 6자리 인증번호가 발송됩니다.
              </div>
            </div>
          )}

          {step === 'verify' && (
            <div className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50">
                <Mail className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  관리자로부터 6자리 인증번호를 받아 입력해주세요.
                </AlertDescription>
              </Alert>
              
              <div>
                <label htmlFor="code" className="block text-sm font-medium mb-2">
                  인증번호 (6자리)
                </label>
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={handleCodeInput}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-center text-2xl font-mono tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                  onKeyPress={(e) => e.key === 'Enter' && code.length === 6 && handleVerifyCode()}
                />
              </div>
              
              <Button 
                onClick={handleVerifyCode}
                disabled={code.length !== 6}
                className="w-full h-12 text-lg"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                로그인
              </Button>
              
              <Button 
                onClick={() => {
                  setStep('input')
                  setCode('')
                  setMessage('')
                  setStatus('idle')
                }}
                variant="outline"
                className="w-full"
              >
                다시 요청하기
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}