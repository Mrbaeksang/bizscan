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

interface FailedFilesModalProps {
  open: boolean
  onClose: () => void
  failedFiles: {name: string, error: string}[]
}

export function FailedFilesModal({ open, onClose, failedFiles }: FailedFilesModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? failedFiles.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === failedFiles.length - 1 ? 0 : prev + 1))
  }

  if (failedFiles.length === 0) return null

  const currentFile = failedFiles[currentIndex]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            처리 실패한 파일 목록
          </DialogTitle>
          <DialogDescription>
            {currentIndex + 1} / {failedFiles.length} - {currentFile?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="font-medium text-red-800 mb-2">파일명:</h3>
            <p className="text-red-700">{currentFile?.name}</p>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="font-medium text-red-800 mb-2">에러 메시지:</h3>
            <p className="text-red-700">{currentFile?.error}</p>
          </div>

          {/* 이전/다음 버튼 */}
          {failedFiles.length > 1 && (
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

        <div className="p-6 pt-4 bg-red-50 border-t">
          <p className="text-sm text-red-800">
            이 파일들은 AI가 인식하지 못했습니다. 
            이미지 품질을 확인하고 다시 시도해주세요.
          </p>
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-muted-foreground">
              팁: 이미지가 선명하고 사업자등록증이 완전히 보이는지 확인하세요
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