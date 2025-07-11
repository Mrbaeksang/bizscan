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
import { CheckCircle2, AlertCircle, X, Download, RefreshCw } from 'lucide-react'
import { clientStorage } from '@/lib/client-storage'
import type { StoredResult } from '@/lib/client-storage'

interface LivePreviewModalProps {
  open: boolean
  onClose: () => void
  isProcessing: boolean
}

export function LivePreviewModal({ open, onClose, isProcessing }: LivePreviewModalProps) {
  const [results, setResults] = useState<StoredResult[]>([])
  const [autoRefresh, setAutoRefresh] = useState(true)

  // 실시간 데이터 새로고침
  const refreshData = async () => {
    const allResults = await clientStorage.getResults()
    setResults(allResults.sort((a, b) => new Date(a.processedAt).getTime() - new Date(b.processedAt).getTime()))
  }

  useEffect(() => {
    if (open) {
      refreshData()
    }
  }, [open])

  useEffect(() => {
    if (open && autoRefresh && isProcessing) {
      const interval = setInterval(refreshData, 2000) // 2초마다 새로고침
      return () => clearInterval(interval)
    }
  }, [open, autoRefresh, isProcessing])

  const exportTableAsCSV = () => {
    const headers = ['파일명', '상호명', '대표자명', '사업자주소', '사업자등록번호', '상태']
    const csvContent = [
      headers.join(','),
      ...results.map(result => [
        `"${result.fileName}"`,
        `"${result.data.상호명}"`,
        `"${result.data.대표자명}"`,
        `"${result.data.사업자주소}"`,
        `"${result.data.사업자등록번호}"`,
        result.status === 'success' ? '성공' : '실패'
      ].join(','))
    ].join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bizscan_preview_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
  }

  const successResults = results.filter(r => r.status === 'success')
  const failedResults = results.filter(r => r.status === 'failed')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-full max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              실시간 데이터 미리보기
            </div>
            <div className="flex items-center gap-2">
              <div className="text-sm text-muted-foreground">
                총 {results.length}개 | 성공 {successResults.length}개 | 실패 {failedResults.length}개
              </div>
              <Button
                onClick={() => setAutoRefresh(!autoRefresh)}
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh && isProcessing ? 'animate-spin' : ''}`} />
                자동새로고침
              </Button>
              <Button
                onClick={exportTableAsCSV}
                variant="outline"
                size="sm"
                disabled={results.length === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                CSV 다운로드
              </Button>
              <Button onClick={refreshData} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            처리된 데이터를 실시간으로 확인할 수 있습니다. (엑셀 파일과 동일한 형태)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {results.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              아직 처리된 데이터가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-3 border-b font-medium w-16">#</th>
                    <th className="text-left p-3 border-b font-medium w-32">파일명</th>
                    <th className="text-left p-3 border-b font-medium w-48">상호명(대표자명)</th>
                    <th className="text-left p-3 border-b font-medium w-64">사업자주소</th>
                    <th className="text-left p-3 border-b font-medium w-32">사업자등록번호</th>
                    <th className="text-left p-3 border-b font-medium w-20">상태</th>
                    <th className="text-left p-3 border-b font-medium w-24">처리시간</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={result.id} className={`border-b hover:bg-muted/30 ${result.status === 'failed' ? 'bg-red-50' : ''}`}>
                      <td className="p-3 text-muted-foreground">{index + 1}</td>
                      <td className="p-3">
                        <div className="truncate max-w-32" title={result.fileName}>
                          {result.fileName}
                        </div>
                      </td>
                      <td className="p-3">
                        {result.status === 'success' ? (
                          <div>
                            <div className="font-medium">{result.data.상호명}</div>
                            <div className="text-muted-foreground text-xs">({result.data.대표자명})</div>
                          </div>
                        ) : (
                          <span className="text-red-600 text-sm">처리 실패</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="max-w-64 truncate" title={result.data.사업자주소}>
                          {result.data.사업자주소 || '-'}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-sm">
                          {result.data.사업자등록번호 || '-'}
                        </span>
                      </td>
                      <td className="p-3">
                        {result.status === 'success' ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="flex items-center gap-1">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span className="text-xs text-red-600" title={result.error}>
                              실패
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {new Date(result.processedAt).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-6 pt-4 bg-muted/20 border-t">
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              💡 팁: 이 테이블은 최종 Excel 파일과 동일한 구조입니다.
              {isProcessing && autoRefresh && (
                <span className="ml-2 text-blue-600">• 실시간 업데이트 중</span>
              )}
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