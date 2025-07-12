'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

interface DiscardedFilesModalProps {
  open: boolean
  onClose: () => void
  discardedFiles: {name: string, reason: string}[]
}

export function DiscardedFilesModal({ open, onClose, discardedFiles }: DiscardedFilesModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? discardedFiles.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === discardedFiles.length - 1 ? 0 : prev + 1))
  }

  if (discardedFiles.length === 0) return null

  const currentFile = discardedFiles[currentIndex]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            폐기된 파일 목록
          </DialogTitle>
          <DialogDescription>
            {currentIndex + 1} / {discardedFiles.length} - {currentFile?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-medium text-orange-800 mb-2">파일명:</h3>
            <p className="text-orange-700">{currentFile?.name}</p>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="font-medium text-orange-800 mb-2">폐기 사유:</h3>
            <p className="text-orange-700">{currentFile?.reason}</p>
          </div>

          {/* 이전/다음 버튼 */}
          {discardedFiles.length > 1 && (
            <div className="flex justify-between">
              <Button
                onClick={handlePrevious}
                variant="outline"
                size="sm"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                이전
              </Button>
              <Button
                onClick={handleNext}
                variant="outline"
                size="sm"
              >
                다음
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>

        <div className="p-6 pt-4 bg-orange-50 border-t">
          <p className="text-sm text-orange-800">
            이 파일들은 배달앱(땡겨요, 요기요, 쿠팡이츠) 3개 모두 이용이 불가능하여 결과에서 제외되었습니다.
          </p>
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-muted-foreground">
              필요시 배달앱 정보를 수정한 후 다시 처리하세요
            </div>
            <Button onClick={onClose} variant="outline">
              닫기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}