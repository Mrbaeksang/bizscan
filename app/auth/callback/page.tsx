'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function AuthCallbackContent() {
  const searchParams = useSearchParams()
  const [code, setCode] = useState('')
  const [token, setToken] = useState('')

  useEffect(() => {
    const authCode = searchParams.get('code')
    if (authCode) {
      setCode(authCode)
      // 토큰 발급 API 호출
      fetchToken(authCode)
    }
  }, [searchParams])

  const fetchToken = async (authCode: string) => {
    try {
      const response = await fetch('https://kauth.kakao.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: 'a56ffe9f9ba1539af86a29ae18114da9',
          redirect_uri: 'https://bizscan.vercel.app/auth/callback',
          code: authCode,
        }),
      })

      const data = await response.json()
      if (data.access_token) {
        setToken(data.access_token)
      }
    } catch (error) {
      console.error('토큰 발급 실패:', error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-center mb-6">카카오 인증 완료</h1>
        
        {code && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">인증 코드:</p>
            <p className="font-mono text-sm bg-gray-100 p-2 rounded break-all">{code}</p>
          </div>
        )}
        
        {token && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">액세스 토큰:</p>
            <p className="font-mono text-xs bg-green-100 p-2 rounded break-all">{token}</p>
            <p className="text-sm text-green-600 mt-2">
              ✅ 이 토큰을 Vercel 환경변수 KAKAO_ACCESS_TOKEN에 설정하세요!
            </p>
          </div>
        )}
        
        <button
          onClick={() => window.close()}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
        >
          창 닫기
        </button>
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthCallbackContent />
    </Suspense>
  )
}