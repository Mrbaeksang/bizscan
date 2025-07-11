'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, RefreshCw } from 'lucide-react'

interface ReviewResultsModalProps {
  open: boolean
  onClose: () => void
  reviewResults: {
    originalCount: number
    afterDeduplication: number
    duplicatesRemoved: Array<{companyName: string, businessNumber: string}>
    textCorrections: Array<{fileName: string, field: string, original: string, corrected: string, reason: string}>
    totalCorrections: number
  } | null
}

export function ReviewResultsModal({ open, onClose, reviewResults }: ReviewResultsModalProps) {
  if (!reviewResults) return null
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center">
            <CheckCircle2 className="h-6 w-6 mr-2 text-green-600" />
            AI 검수 결과
          </DialogTitle>
          <DialogDescription>
            데이터 처리 과정에서 중복 제거 및 텍스트 수정 내역을 확인하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 요약 정보 */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">📊 검수 요약</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-700">원본 데이터:</span>
                <span className="font-medium ml-2">{reviewResults.originalCount}개</span>
              </div>
              <div>
                <span className="text-blue-700">중복 제거:</span>
                <span className="font-medium ml-2">{reviewResults.duplicatesRemoved.length}개</span>
              </div>
              <div>
                <span className="text-blue-700">최종 데이터:</span>
                <span className="font-medium ml-2">{reviewResults.afterDeduplication}개</span>
              </div>
            </div>
          </div>

          {/* 중복 제거 결과 */}
          {reviewResults.duplicatesRemoved.length > 0 && (
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-semibold text-yellow-900 mb-3 flex items-center">
                <RefreshCw className="h-4 w-4 mr-2" />
                중복 제거된 데이터 ({reviewResults.duplicatesRemoved.length}개)
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {reviewResults.duplicatesRemoved.map((item, index) => (
                  <div key={index} className="bg-white p-3 rounded border text-sm">
                    <div className="font-medium text-gray-900">{item.companyName}</div>
                    <div className="text-gray-600">사업자등록번호: {item.businessNumber}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 텍스트 수정 결과 */}
          {reviewResults.textCorrections.length > 0 && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-900 mb-3 flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                텍스트 수정된 내역 ({reviewResults.textCorrections.length}개)
              </h3>
              <div className="space-y-3 max-h-40 overflow-y-auto">
                {reviewResults.textCorrections.map((correction, index) => (
                  <div key={index} className="bg-white p-3 rounded border text-sm">
                    <div className="font-medium text-gray-900 mb-1">{correction.fileName}</div>
                    <div className="text-gray-700">
                      <span className="font-medium">{correction.field}:</span>
                      <span className="text-red-600 line-through ml-2">{correction.original}</span>
                      <span className="mx-2">→</span>
                      <span className="text-green-600 font-medium">{correction.corrected}</span>
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      수정 이유: {correction.reason}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 검수 결과가 없는 경우 */}
          {reviewResults.duplicatesRemoved.length === 0 && reviewResults.totalCorrections === 0 && (
            <div className="bg-gray-50 p-8 rounded-lg border border-gray-200 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">완벽한 데이터!</h3>
              <p className="text-gray-600">
                중복된 데이터나 수정이 필요한 텍스트가 발견되지 않았습니다.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={onClose} variant="outline">
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}