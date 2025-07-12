'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import axios from 'axios'
import { FileDropzone } from '@/components/file-dropzone'
import { FailedFilesModal } from '@/components/failed-files-modal'
import { ReviewResultsModal } from '@/components/review-results-modal'
import { LiveResultsTable } from '@/components/live-results-table'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle, Download, FileSpreadsheet, Eye, Pause, Play, RefreshCw, Trash2 } from 'lucide-react'
import { compressImage } from '@/lib/image-utils'
import { clientStorage } from '@/lib/client-storage'
import type { ExcelRowData } from '@/lib/excel-generator'

type Status = 'idle' | 'processing' | 'paused' | 'completed'
type AuthStep = 'request' | 'verify' | 'authenticated'

// 재시도 카운트가 포함된 파일 타입
interface FileWithRetry extends File {
  retryCount?: number
}

export default function Home() {
  // 인증 관련
  const [authStep, setAuthStep] = useState<AuthStep>('request')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [authMessage, setAuthMessage] = useState('')
  
  // 핵심 상태 6개
  const [files, setFiles] = useState<FileWithRetry[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [successData, setSuccessData] = useState<ExcelRowData[]>([])
  const [failedFiles, setFailedFiles] = useState<{name: string, error: string}[]>([])
  const [progress, setProgress] = useState(0)
  const [excelBlob, setExcelBlob] = useState<Blob | null>(null)
  
  // UI 상태
  const [showFailedModal, setShowFailedModal] = useState(false)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [showLivePreview, setShowLivePreview] = useState(false)
  const [reviewResults, setReviewResults] = useState<{
    originalCount: number
    afterDeduplication: number
    duplicatesRemoved: Array<{companyName: string, businessNumber: string}>
    textCorrections: Array<{fileName: string, field: string, original: string, corrected: string, reason: string}>
    totalCorrections: number
  } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  
  const cancelRef = useRef(false)
  const currentIndexRef = useRef(0)

  // 인증 확인 (임시 해제)
  useEffect(() => {
    setAuthStep('authenticated')
    // const token = clientStorage.getAuthToken()
    // if (token) {
    //   try {
    //     const tokenData = JSON.parse(atob(token))
    //     if (new Date(tokenData.expiresAt) > new Date()) {
    //       setAuthStep('authenticated')
    //     } else {
    //       clientStorage.clearAuthToken()
    //     }
    //   } catch {
    //     clientStorage.clearAuthToken()
    //   }
    // }
  }, [])

  // 인증 처리
  const handleAuth = async () => {
    if (authStep === 'request') {
      setAuthStatus('loading')
      try {
        const response = await fetch('/api/auth/simple-request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'admin' })
        })
        const data = await response.json()
        if (data.success) {
          setAuthStep('verify')
          setAuthMessage('관리자에게 6자리 인증번호를 요청했습니다.')
        }
      } catch {
        setAuthStatus('error')
        setAuthMessage('인증 요청 중 오류가 발생했습니다.')
      }
      setAuthStatus('idle')
    } else if (authStep === 'verify') {
      const verificationCode = code.join('')
      if (verificationCode.length !== 6) {
        setAuthMessage('6자리 인증번호를 입력하세요.')
        return
      }
      setAuthStatus('loading')
      try {
        const response = await fetch('/api/auth/simple-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: verificationCode })
        })
        const data = await response.json()
        if (data.success) {
          clientStorage.saveAuthToken(data.token)
          setAuthStep('authenticated')
          setAuthMessage('인증이 완료되었습니다.')
        } else {
          setAuthMessage(data.message || '인증번호가 올바르지 않습니다.')
        }
      } catch {
        setAuthMessage('인증 중 오류가 발생했습니다.')
      }
      setAuthStatus('idle')
    }
  }

  // 1. 처리 시작
  const startProcessing = async () => {
    if (files.length === 0) {
      alert('파일을 먼저 업로드하세요.')
      return
    }
    
    setStatus('processing')
    cancelRef.current = false
    currentIndexRef.current = 0
    setShowLivePreview(true) // 실시간 테이블 열기
    
    console.log(`🚀 [BIZSCAN] 처리 시작 - 총 ${files.length}개 파일`)
    
    await processFiles()
  }

  // 2. 일시정지 + 엑셀 생성
  const pauseProcessing = async () => {
    cancelRef.current = true
    setStatus('paused')
    
    console.log(`⏸️ [BIZSCAN] 일시정지 - 성공: ${successData.length}개`)
    
    if (successData.length > 0) {
      await generateExcel(successData)
    }
  }

  // 3. 재개 (실패파일 뒤로)
  const resumeProcessing = async () => {
    // 이전 처리가 완전히 멈출 때까지 대기
    while (status === 'processing') {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    cancelRef.current = false
    setStatus('processing')
    
    console.log(`▶️ [BIZSCAN] 재개 - 기존 성공: ${successData.length}개`)
    
    // 실패파일 뒤로 밀기
    const remainingFiles = files.slice(currentIndexRef.current + 1)
    const failedFileNames = new Set(failedFiles.map(f => f.name))
    const retryFiles = files.filter(f => failedFileNames.has(f.name))
    
    const newFileOrder = [...remainingFiles, ...retryFiles]
    setFiles(newFileOrder)
    currentIndexRef.current = 0
    setFailedFiles([])
    
    await processFiles()
  }

  // 파일 처리 핵심 로직
  const processFiles = async () => {
    const results: ExcelRowData[] = [...successData]
    const failed: {name: string, error: string}[] = []
    
    for (let i = currentIndexRef.current; i < files.length; i++) {
      if (cancelRef.current) break
      
      const file = files[i]
      currentIndexRef.current = i
      
      console.log(`📝 [BIZSCAN] 파일 ${i + 1}/${files.length} 처리: ${file.name}`)
      
      try {
        const processedData = await processFile(file)
        
        results.push(processedData)
        setSuccessData(prev => [...prev, processedData])
        
        console.log(`✅ [BIZSCAN] 성공: ${file.name}`)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '처리 실패'
        console.log(`❌ [BIZSCAN] 실패: ${file.name} - ${errorMsg}`)
        
        // 실패한 파일을 맨 뒤로 이동 (최대 3번까지만 재시도)
        const retryCount = file.retryCount || 0
        if (retryCount < 3) {
          console.log(`🔄 [BIZSCAN] 재시도 ${retryCount + 1}/3: ${file.name}`)
          const retryFile: FileWithRetry = Object.assign(file, { retryCount: retryCount + 1 })
          setFiles(prev => [...prev, retryFile]) // 맨 뒤에 추가
        } else {
          console.log(`💀 [BIZSCAN] 최종 실패: ${file.name}`)
          failed.push({ name: file.name, error: errorMsg })
          setFailedFiles(prev => [...prev, { name: file.name, error: errorMsg }])
        }
      }
      
      // 진행률 업데이트
      const progressPercent = Math.round(((i + 1) / files.length) * 100)
      setProgress(progressPercent)
    }
    
    // 처리 완료
    if (!cancelRef.current) {
      setStatus('completed')
      playCompletionSound()
      
      if (results.length > 0) {
        await generateExcel(results)
      }
      
      console.log(`🎉 [BIZSCAN] 완료 - 성공: ${results.length}개, 실패: ${failed.length}개`)
    }
  }

  // 개별 파일 처리
  const processFile = async (file: File): Promise<ExcelRowData> => {
    const compressedFile = await compressImage(file)
    const formData = new FormData()
    formData.append('file', compressedFile, file.name)
    
    const response = await axios.post('/api/extract-single', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 90000 // 90초로 증가 (배포환경 고려)
    })
    
    if (!response.data.success) {
      throw new Error(response.data.error || '처리 실패')
    }
    
    return response.data.data
  }

  // 엑셀 생성 함수를 useCallback으로 메모이제이션
  const generateExcel = useCallback(async (data: ExcelRowData[]) => {
    setIsGenerating(true)
    setExcelBlob(null) // 기존 엑셀 블롭 초기화하여 새로운 데이터로 생성
    
    try {
      console.log(`🔍 [BIZSCAN] 엑셀 생성 API 호출 시작 - ${data.length}개 데이터`)
      console.log(`📝 [BIZSCAN] 메모 데이터 상세:`, data.map(item => ({ 상호명: item.companyAndRepresentative, 메모: item.memo || '(빈값)' })))
      
      // 🔥 API 호출 전 마지막 체크: 메모가 있는 항목 수 계산
      const itemsWithMemo = data.filter(item => item.memo && item.memo.trim() !== '')
      console.log(`🔥 [BIZSCAN] API 호출 전 메모 보유 항목: ${itemsWithMemo.length}/${data.length}개`)
      console.log(`🔥 [BIZSCAN] 메모 보유 항목 상세:`, itemsWithMemo.map(item => ({ 상호명: item.companyAndRepresentative, 메모: item.memo })))
      
      // 🔥 rawData 최종 확인
      const requestBody = { rawData: data }
      console.log(`🔥 [BIZSCAN] 최종 전송 데이터:`, JSON.stringify(requestBody, null, 2))
      
      const response = await fetch('/api/bulk-review-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      console.log(`📋 [BIZSCAN] API 응답 상태: ${response.status}`)
      console.log(`📋 [BIZSCAN] 응답 헤더:`, response.headers)
      
      if (response.ok) {
        const blob = await response.blob()
        console.log(`📊 [BIZSCAN] 블롭 크기: ${blob.size}bytes, 타입: ${blob.type}`)
        
        // 블롭 내용이 JSON 에러인지 확인
        if (blob.size < 1000 && blob.type === 'application/json') {
          const text = await blob.text()
          console.error(`❌ [BIZSCAN] JSON 에러 응답:`, text)
          return
        }
        
        setExcelBlob(blob)
        
        // 리뷰 결과 저장
        const reviewHeader = response.headers.get('X-Review-Results')
        if (reviewHeader) {
          setReviewResults(JSON.parse(decodeURIComponent(reviewHeader)))
        }
        
        console.log(`📊 [BIZSCAN] 엑셀 생성 완료`)
      } else {
        const errorText = await response.text()
        console.error(`❌ [BIZSCAN] API 에러 응답:`, errorText)
      }
    } catch (error) {
      console.error('엑셀 생성 실패:', error)
    } finally {
      setIsGenerating(false)
    }
  }, []) // 빈 의존성 배열로 함수 안정화

  // 최신 데이터로 엑셀 생성 (상태 최신화 보장)
  const generateLatestExcel = useCallback(() => {
    console.log('📊 [BIZSCAN] 최신 데이터로 엑셀 생성 시작')
    console.log('📊 [BIZSCAN] 현재 successData 길이:', successData.length)
    console.log('📊 [BIZSCAN] 현재 메모 데이터:', successData.map(item => ({ 상호명: item.companyAndRepresentative, 메모: item.memo || '(빈값)' })))
    
    // 🔥 메모가 있는 항목 체크
    const itemsWithMemo = successData.filter(item => item.memo && item.memo.trim() !== '')
    console.log(`🔥 [BIZSCAN] generateLatestExcel - 메모 보유 항목: ${itemsWithMemo.length}/${successData.length}개`)
    console.log(`🔥 [BIZSCAN] generateLatestExcel - 메모 보유 상세:`, itemsWithMemo.map(item => ({ 상호명: item.companyAndRepresentative, 메모: item.memo })))
    
    if (!successData || successData.length === 0) {
      alert('생성할 데이터가 없습니다.');
      return;
    }
    
    // 즉시 최신 상태 사용 - React 18에서 더 안정적
    generateExcel(successData);
  }, [successData, generateExcel])

  // 엑셀 다운로드
  const downloadExcel = () => {
    if (!excelBlob) return
    
    const url = URL.createObjectURL(excelBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bizscan_${successData.length}개.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  // 완료 음성
  const playCompletionSound = () => {
    try {
      const audio = new Audio('/notification.mp3')
      audio.play().catch(() => console.log('음성 재생 실패'))
    } catch {
      console.log('음성 파일 없음')
    }
  }

  // 메모 변경 함수
  const handleMemoChange = (index: number, memo: string) => {
    console.log(`📝 [BIZSCAN] 메모 변경: index=${index}, memo="${memo}"`)
    
    // 메모가 변경되면 기존 엑셀 블롭을 무효화하여 재생성 유도
    setExcelBlob(null)
    
    setSuccessData(prev => {
      console.log(`🔥 [BIZSCAN] handleMemoChange - 기존 successData 길이: ${prev.length}`)
      console.log(`🔥 [BIZSCAN] handleMemoChange - 변경 대상 index: ${index}`)
      console.log(`🔥 [BIZSCAN] handleMemoChange - 변경 전 대상 항목:`, prev[index] ? { 상호명: prev[index].companyAndRepresentative, 메모: prev[index].memo } : '항목 없음')
      
      const updated = [...prev]
      if (updated[index]) {
        console.log(`📝 [BIZSCAN] 기존 메모: "${updated[index].memo}" → 새 메모: "${memo}"`)
        updated[index] = { ...updated[index], memo }
        
        console.log(`🔥 [BIZSCAN] handleMemoChange - 변경 후 대상 항목:`, { 상호명: updated[index].companyAndRepresentative, 메모: updated[index].memo })
      } else {
        console.error(`🔥 [BIZSCAN] handleMemoChange - index ${index}에 항목이 없음 (총 ${updated.length}개)`)
      }
      
      // 🔥 메모가 있는 항목 수 체크
      const itemsWithMemo = updated.filter(item => item.memo && item.memo.trim() !== '')
      console.log(`🔥 [BIZSCAN] handleMemoChange - 업데이트 후 메모 보유 항목: ${itemsWithMemo.length}/${updated.length}개`)
      console.log(`🔥 [BIZSCAN] handleMemoChange - 업데이트 후 메모 보유 상세:`, itemsWithMemo.map(item => ({ 상호명: item.companyAndRepresentative, 메모: item.memo })))
      
      return updated
    })
  }

  // 초기화
  const resetAll = () => {
    setFiles([])
    setStatus('idle')
    setSuccessData([])
    setFailedFiles([])
    setProgress(0)
    setExcelBlob(null)
    setReviewResults(null)
    currentIndexRef.current = 0
    cancelRef.current = false
    clientStorage.clearAll()
  }

  // 인증 안된 경우
  if (authStep !== 'authenticated') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">BizScan</h1>
            <p className="text-gray-600">사업자등록증 OCR 서비스</p>
          </div>
          
          {authStep === 'request' && (
            <div className="space-y-4">
              <p className="text-center text-gray-700">서비스 이용을 위해 인증이 필요합니다.</p>
              <Button 
                onClick={handleAuth} 
                className="w-full" 
                disabled={authStatus === 'loading'}
              >
                {authStatus === 'loading' ? '요청 중...' : '인증번호 요청'}
              </Button>
            </div>
          )}
          
          {authStep === 'verify' && (
            <div className="space-y-4">
              <p className="text-center text-gray-700">6자리 인증번호를 입력하세요</p>
              <div className="flex justify-center gap-2">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    type="text"
                    value={digit}
                    onChange={(e) => {
                      const newCode = [...code]
                      newCode[index] = e.target.value.slice(-1)
                      setCode(newCode)
                      if (e.target.value && index < 5) {
                        const nextInput = document.getElementById(`code-${index + 1}`)
                        nextInput?.focus()
                      }
                    }}
                    id={`code-${index}`}
                    className="w-12 h-12 text-center border border-gray-300 rounded-lg text-lg font-mono"
                    maxLength={1}
                  />
                ))}
              </div>
              <Button 
                onClick={handleAuth} 
                className="w-full" 
                disabled={authStatus === 'loading'}
              >
                {authStatus === 'loading' ? '확인 중...' : '인증하기'}
              </Button>
            </div>
          )}
          
          {authMessage && (
            <Alert className="mt-4">
              <AlertDescription>{authMessage}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">BizScan</h1>
            <p className="text-gray-600">사업자등록증 OCR 및 자동 정리 서비스</p>
          </div>

          {/* 진행률 */}
          {status === 'processing' && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">처리 진행률</span>
                <span className="text-sm text-gray-600">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 text-sm text-gray-600">
                성공: {successData.length}개 | 실패: {failedFiles.length}개
              </div>
            </div>
          )}

          {/* 버튼들 */}
          <div className="flex flex-wrap gap-4 mb-6">
            {/* 시작 버튼 */}
            {status === 'idle' && (
              <Button 
                onClick={startProcessing} 
                disabled={files.length === 0}
                className="flex-1"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                처리 시작
              </Button>
            )}

            {/* 일시정지/재개 버튼 */}
            {status === 'processing' && (
              <Button onClick={pauseProcessing} variant="outline" className="flex-1">
                <Pause className="w-4 h-4 mr-2" />
                일시정지
              </Button>
            )}

            {status === 'paused' && (
              <Button onClick={resumeProcessing} className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                재개
              </Button>
            )}

            {/* 다운로드 버튼 */}
            {(status === 'paused' || status === 'completed') && successData.length > 0 && (
              <Button 
                onClick={excelBlob ? downloadExcel : generateLatestExcel}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                {excelBlob ? '엑셀 다운로드' : '엑셀 생성'} ({successData.length}개)
              </Button>
            )}

            {/* 피드백 버튼 */}
            {reviewResults && (
              <Button 
                onClick={() => setShowReviewModal(true)} 
                variant="outline"
              >
                <Eye className="w-4 h-4 mr-2" />
                AI 검수 결과
              </Button>
            )}

            {/* 실시간 테이블 버튼 */}
            {(status === 'processing' || successData.length > 0) && (
              <Button 
                onClick={() => setShowLivePreview(true)} 
                variant="outline"
              >
                <Eye className="w-4 h-4 mr-2" />
                실시간 결과 ({successData.length}개)
              </Button>
            )}

            {/* 실패 파일 버튼 */}
            {failedFiles.length > 0 && (
              <Button 
                onClick={() => setShowFailedModal(true)} 
                variant="outline"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                실패 파일 ({failedFiles.length}개)
              </Button>
            )}


            {/* 초기화 버튼 */}
            <Button 
              onClick={resetAll} 
              variant="outline"
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              초기화
            </Button>
          </div>

          {/* 파일 업로드 */}
          <FileDropzone 
            files={files} 
            onFilesChange={setFiles}
            disabled={status === 'processing'}
          />

          {/* 엑셀 생성 중 */}
          {isGenerating && (
            <div className="mt-6 p-4 bg-yellow-50 rounded-lg flex items-center">
              <RefreshCw className="w-5 h-5 mr-3 animate-spin text-yellow-600" />
              <span className="text-yellow-800">AI 검수 및 엑셀 생성 중...</span>
            </div>
          )}

          {/* 완료 메시지 */}
          {status === 'completed' && (
            <Alert className="mt-6">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                모든 파일 처리가 완료되었습니다! 성공: {successData.length}개, 실패: {failedFiles.length}개
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* 모달들 */}
      <FailedFilesModal 
        open={showFailedModal}
        onClose={() => setShowFailedModal(false)}
        failedFiles={failedFiles}
      />


      <ReviewResultsModal 
        open={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        reviewResults={reviewResults}
      />

      <LiveResultsTable 
        isOpen={showLivePreview}
        onClose={() => setShowLivePreview(false)}
        data={successData}
        progress={progress}
        totalFiles={files.length}
        failedCount={failedFiles.length}
        onMemoChange={handleMemoChange}
      />
    </div>
  )
}