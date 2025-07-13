'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

interface DeliveryStatus {
  ddangyo: 'registered' | 'available' | 'unknown'
  yogiyo: 'registered' | 'available' | 'unknown'
  coupangeats: 'registered' | 'available' | 'unknown'
}

interface DeliveryCheckerModalProps {
  open: boolean
  onClose: () => void
}

export function DeliveryCheckerModal({ open, onClose }: DeliveryCheckerModalProps) {
  const [businessNumber, setBusinessNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DeliveryStatus | null>(null)
  const [error, setError] = useState('')

  // 사업자번호 포맷팅 (숫자만)
  const formatBusinessNumber = (value: string) => {
    const numbers = value.replace(/[^\d]/g, '')
    return numbers.slice(0, 10)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBusinessNumber(formatBusinessNumber(e.target.value))
    setError('')
  }

  const checkDeliveryStatus = async () => {
    const cleanNumber = businessNumber.replace(/-/g, '')
    
    if (cleanNumber.length !== 10) {
      setError('올바른 사업자번호 10자리를 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/delivery-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessNumber })
      })

      const data = await response.json()
      
      if (data.success) {
        setResult(data.status)
      } else {
        setError(data.error || '확인 중 오류가 발생했습니다.')
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'available':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'registered':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <AlertCircle className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return '입점 가능'
      case 'registered':
        return '이미 입점'
      default:
        return '확인 불가'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'text-green-600'
      case 'registered':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  const handleClose = () => {
    setBusinessNumber('')
    setResult(null)
    setError('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">🚚</span>
            배달 플랫폼 입점 가능 여부 확인
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Input
              placeholder="사업자번호 10자리 입력"
              value={businessNumber}
              onChange={handleInputChange}
              onKeyPress={(e) => e.key === 'Enter' && checkDeliveryStatus()}
              disabled={loading}
              className="flex-1"
              maxLength={10}
            />
            <Button 
              onClick={checkDeliveryStatus}
              disabled={loading || !businessNumber}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  확인 중...
                </>
              ) : (
                '확인'
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {result && (
            <div className="border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm text-gray-700 mb-2">확인 결과</h3>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="font-medium">땡겨요</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.ddangyo)}
                    <span className={getStatusColor(result.ddangyo)}>
                      {getStatusText(result.ddangyo)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="font-medium">요기요</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.yogiyo)}
                    <span className={getStatusColor(result.yogiyo)}>
                      {getStatusText(result.yogiyo)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="font-medium">쿠팡이츠</span>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.coupangeats)}
                    <span className={getStatusColor(result.coupangeats)}>
                      {getStatusText(result.coupangeats)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-gray-500 text-center pt-2">
                {new Date().toLocaleString('ko-KR', { 
                  timeZone: 'Asia/Seoul',
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false
                }).replace(/\. /g, '년 ').replace(/\. /g, '월 ').replace(/\. /g, '일 ')} KST 기준
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}