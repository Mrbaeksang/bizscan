'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Loader2 } from 'lucide-react'

interface ProgressModalProps {
  open: boolean
  status: 'uploading' | 'analyzing' | 'generating'
  progress: number
  currentFile?: number
  totalFiles?: number
}

const statusMessages = {
  uploading: '파일 업로드 중...',
  analyzing: 'AI가 이미지를 분석하고 있습니다...',
  generating: '엑셀 파일을 생성하고 있습니다...'
}

export function ProgressModal({ 
  open, 
  status, 
  progress, 
  currentFile, 
  totalFiles 
}: ProgressModalProps) {
  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            처리 중...
          </DialogTitle>
          <DialogDescription className="pt-4">
            {statusMessages[status]}
            {currentFile && totalFiles && status === 'analyzing' && (
              <span className="block mt-2 font-medium">
                이미지 분석 중... ({currentFile}/{totalFiles})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <Progress value={progress} className="h-2" />
          <p className="text-center text-sm text-muted-foreground mt-2">
            {progress}%
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}