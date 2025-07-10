'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, X, AlertCircle } from 'lucide-react'

interface FailedFilesModalProps {
  open: boolean
  onClose: () => void
  failedFiles: File[]
}

export function FailedFilesModal({ open, onClose, failedFiles }: FailedFilesModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imageUrls, setImageUrls] = useState<string[]>([])

  useEffect(() => {
    // 파일들을 URL로 변환
    const urls = failedFiles.map(file => URL.createObjectURL(file))
    setImageUrls(urls)

    // 클린업 함수
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [failedFiles])

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? failedFiles.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === failedFiles.length - 1 ? 0 : prev + 1))
  }

  if (failedFiles.length === 0) return null

  const currentFile = failedFiles[currentIndex]
  const currentImageUrl = imageUrls[currentIndex]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            처리 실패한 이미지 확인
          </DialogTitle>
          <DialogDescription>
            {currentIndex + 1} / {failedFiles.length} - {currentFile?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="relative bg-slate-100 flex items-center justify-center min-h-[400px]">
          {/* 이미지 표시 */}
          {currentImageUrl && (
            <img
              src={currentImageUrl}
              alt={currentFile?.name}
              className="max-w-full max-h-[60vh] object-contain"
            />
          )}

          {/* 이전/다음 버튼 */}
          {failedFiles.length > 1 && (
            <>
              <Button
                onClick={handlePrevious}
                variant="outline"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 hover:bg-white"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleNext}
                variant="outline"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/80 hover:bg-white"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <div className="p-6 pt-4 bg-orange-50 border-t">
          <p className="text-sm text-orange-800">
            이 이미지들은 AI가 인식하지 못했습니다. 
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