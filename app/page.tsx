'use client'

import React, { useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { FileDropzone } from '@/components/file-dropzone'
import { ProgressModal } from '@/components/progress-modal'
import { FailedFilesModal } from '@/components/failed-files-modal'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle, Download, FileSpreadsheet, LogOut, Eye } from 'lucide-react'

type Status = 'idle' | 'uploading' | 'analyzing' | 'generating' | 'success' | 'error'

export default function Home() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState(0)
  const [excelBlob, setExcelBlob] = useState<Blob | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [failedFiles, setFailedFiles] = useState<string[]>([])
  const [successCount, setSuccessCount] = useState(0)
  const [pendingData, setPendingData] = useState<Blob | null>(null) // 생성 대기 중인 데이터
  const [showFailedFilesModal, setShowFailedFilesModal] = useState(false)

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      localStorage.removeItem('auth_token')
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleSubmit = async () => {
    console.log('handleSubmit called with files:', files)
    if (files.length === 0) return

    setStatus('uploading')
    setProgress(10)
    setErrorMessage('')

    try {
      const formData = new FormData()
      files.forEach((file, index) => {
        console.log(`Adding file ${index}: ${file.name}, size: ${file.size}`)
        formData.append('files', file)
      })

      // 업로드 진행
      setProgress(20)

      // API 호출
      setStatus('analyzing')
      const totalFiles = files.length
      console.log('Sending request to /api/extract')
      
      // 진행률 시뮬레이션 (실제로는 서버에서 진행 상황을 받아와야 함)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + (60 / totalFiles / 10)
          if (newProgress >= 80) {
            clearInterval(progressInterval)
            return 80
          }
          return newProgress
        })
        setCurrentFile((prev) => Math.min(prev + 0.1, totalFiles))
      }, 300)

      const response = await axios.post('/api/extract', formData, {
        responseType: 'blob',
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          console.log('Upload progress:', progressEvent)
        }
      })

      console.log('Response received:', response)
      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)

      clearInterval(progressInterval)
      
      // 엑셀 생성 단계
      setStatus('generating')
      setProgress(90)
      
      // 약간의 지연 후 완료
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // 실패한 파일 확인
      const failedFilesHeader = response.headers['x-failed-files']
      // *** FIX: totalFiles 변수 중복 선언 제거 ***
      const failedCount = failedFilesHeader ? JSON.parse(failedFilesHeader).length : 0
      const successfulCount = totalFiles - failedCount
      
      if (failedFilesHeader) {
        const failed = JSON.parse(failedFilesHeader)
        setFailedFiles(failed)
        console.log('Failed files:', failed)
      }
      
      setSuccessCount(successfulCount)
      setPendingData(response.data) // 엑셀 데이터를 대기 상태로 저장
      setStatus('success')
      setProgress(100)
      
      // 모달 자동 닫기
      setTimeout(() => {
        setProgress(0)
        setCurrentFile(0)
      }, 500)
      
    } catch (error) {
      console.error('Error in handleSubmit:', error)
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status,
          headers: error.response?.headers
        })
        if (error.response?.data instanceof Blob) {
          const text = await error.response.data.text()
          console.error('Error response text:', text)
          setErrorMessage(text) // Blob 형태의 에러 메시지를 표시하도록 개선
        } else if (typeof error.response?.data?.error === 'string') {
          setErrorMessage(error.response.data.error)
        } else {
          setErrorMessage('파일 처리 중 오류가 발생했습니다. 다시 시도해주세요.')
        }
      }
      setStatus('error')
      setProgress(0)
      setCurrentFile(0)
    }
  }

  const handleGenerateExcel = () => {
    if (pendingData) {
      setExcelBlob(pendingData)
      setPendingData(null)
    }
  }

  const handleRetryFailed = () => {
    // 실패한 파일들만 다시 선택
    const failedFileNames = new Set(failedFiles)
    const filesToRetry = files.filter(file => failedFileNames.has(file.name))
    setFiles(filesToRetry)
    setStatus('idle')
    setFailedFiles([])
    setSuccessCount(0)
    setPendingData(null)
    setExcelBlob(null)
  }

  const handleDownload = () => {
    if (excelBlob) {
      const url = window.URL.createObjectURL(excelBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'bizscan_results.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      
      // 다운로드 후에도 상태 유지 (재시도 가능하도록)
    }
  }

  const isProcessing = status === 'uploading' || status === 'analyzing' || status === 'generating'

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto py-12 px-4 max-w-4xl">
        <div className="absolute top-4 right-4">
          <Button
            variant="outline"
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            로그아웃
          </Button>
        </div>
        
        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-3 mb-4">
            <FileSpreadsheet className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold text-slate-900">BizScan</h1>
          </div>
          <p className="text-lg text-slate-600">
            사업자등록증 이미지를 드래그 앤 드롭하여 엑셀 파일로 데이터를 추출하세요
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 space-y-6">
          <FileDropzone 
            files={files} 
            onFilesChange={setFiles}
            disabled={isProcessing}
          />

          {status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          {status === 'success' && pendingData && !excelBlob && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <div className="space-y-2">
                  <p className="font-semibold">
                    총 {files.length}개 파일 중 {successCount}개 성공, {failedFiles.length}개 실패
                  </p>
                  <p>
                    {successCount > 0 ? `${successCount}개의 성공한 파일만으로 엑셀을 생성하시겠습니까?` : '성공한 파일이 없습니다.'}
                  </p>
                  {failedFiles.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-100/50 rounded">
                      <p className="text-sm font-medium mb-1">실패한 파일:</p>
                      <ul className="list-disc list-inside text-sm">
                        {failedFiles.map((file, index) => (
                          <li key={index}>{file}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {status === 'success' && excelBlob && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                엑셀 파일이 준비되었습니다! 다운로드 버튼을 클릭하세요.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 flex-wrap">
            {/* 처리 완료 후 선택 버튼들 */}
            {status === 'success' && pendingData && !excelBlob && (
              <>
                {successCount > 0 && (
                  <Button 
                    onClick={handleGenerateExcel}
                    className="flex-1 h-14 text-lg"
                    size="lg"
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    {successCount}개만 엑셀 생성
                  </Button>
                )}
                {failedFiles.length > 0 && (
                  <Button 
                    onClick={handleRetryFailed}
                    variant="outline"
                    className="flex-1 h-14 text-lg"
                    size="lg"
                  >
                    <AlertCircle className="mr-2 h-5 w-5" />
                    {failedFiles.length}개 재시도
                  </Button>
                )}
              </>
            )}

            {/* 엑셀 다운로드 버튼 */}
            {status === 'success' && excelBlob && (
              <>
                <Button 
                  onClick={handleDownload}
                  className="flex-1 h-14 text-lg"
                  size="lg"
                >
                  <Download className="mr-2 h-5 w-5" />
                  엑셀 다운로드
                </Button>
                {failedFiles.length > 0 && (
                  <Button 
                    onClick={handleRetryFailed}
                    variant="outline"
                    className="flex-1 h-14 text-lg"
                    size="lg"
                  >
                    <AlertCircle className="mr-2 h-5 w-5" />
                    실패한 {failedFiles.length}개 재시도
                  </Button>
                )}
              </>
            )}

            {/* 초기 엑셀 생성 버튼 */}
            {(!status || status === 'idle' || status === 'error') && (
              <Button 
                onClick={handleSubmit}
                disabled={files.length === 0 || isProcessing}
                className="w-full h-14 text-lg"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                    처리 중...
                  </>
                ) : (
                  '엑셀 생성'
                )}
              </Button>
            )}
          </div>
        </div>

        <ProgressModal
          open={isProcessing}
          status={status as 'uploading' | 'analyzing' | 'generating'}
          progress={progress}
          currentFile={Math.floor(currentFile)}
          totalFiles={files.length}
        />
      </div>
    </main>
  )
}