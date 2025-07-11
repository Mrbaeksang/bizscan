'use client'

import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { FileDropzone } from '@/components/file-dropzone'
import { FailedFilesModal } from '@/components/failed-files-modal'
import { LivePreviewModal } from '@/components/live-preview-modal'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle2, AlertCircle, Download, FileSpreadsheet, Eye, Pause, Play, Table, Mail } from 'lucide-react'
import { compressImage } from '@/lib/image-utils'
import { clientStorage } from '@/lib/client-storage'
import { generateExcelFromData, generatePartialExcel } from '@/lib/excel-generator'
import type { ExcelRowData } from '@/lib/excel-generator'

type Status = 'idle' | 'uploading' | 'analyzing' | 'generating' | 'success' | 'error' | 'paused'
type AuthStep = 'request' | 'verify' | 'authenticated'

export default function Home() {
  const router = useRouter()
  const [authStep, setAuthStep] = useState<AuthStep>('request')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [authStatus, setAuthStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [authMessage, setAuthMessage] = useState('')
  
  const [files, setFiles] = useState<File[]>([])
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState(0)
  const [excelBlob, setExcelBlob] = useState<Blob | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [failedFiles, setFailedFiles] = useState<{name: string, error: string}[]>([])
  const [successCount, setSuccessCount] = useState(0)
  const [processedData, setProcessedData] = useState<ExcelRowData[]>([])
  const [showFailedFilesModal, setShowFailedFilesModal] = useState(false)
  const [showLivePreview, setShowLivePreview] = useState(false)
  const cancelRef = useRef(false)

  // 인증 상태 확인
  useEffect(() => {
    const token = clientStorage.getAuthToken()
    if (token) {
      try {
        const tokenData = JSON.parse(atob(token))
        const expiresAt = new Date(tokenData.expiresAt)
        if (expiresAt > new Date()) {
          setAuthStep('authenticated')
        } else {
          clientStorage.clearAuthToken()
        }
      } catch (error) {
        clientStorage.clearAuthToken()
      }
    }
  }, [])

  // 인증번호 요청
  const handleRequestCode = async () => {
    setAuthStatus('loading')
    
    try {
      const response = await fetch('/api/auth/simple-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: 'admin' // 고정값
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setAuthStep('verify')
        setAuthStatus('idle')
        setAuthMessage('관리자에게 6자리 인증번호를 요청했습니다.')
      } else {
        setAuthStatus('error')
        setAuthMessage(data.error || '요청 처리 중 오류가 발생했습니다.')
      }
    } catch (error) {
      setAuthStatus('error')
      setAuthMessage('네트워크 오류가 발생했습니다.')
    }
  }

  // 인증번호 입력 처리
  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return // 숫자만 허용
    
    const newCode = [...code]
    newCode[index] = value.slice(-1) // 마지막 문자만 저장
    setCode(newCode)
    
    // 다음 입력 필드로 자동 이동
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`)
      nextInput?.focus()
    }
  }

  // 인증번호 확인
  const handleVerifyCode = async () => {
    const fullCode = code.join('')
    if (fullCode.length !== 6) {
      setAuthMessage('6자리 인증번호를 모두 입력해주세요.')
      setAuthStatus('error')
      return
    }

    // 클라이언트에서 토큰 생성 (24시간 유효)
    const token = btoa(JSON.stringify({
      userId: 'admin',
      code: fullCode,
      loginTime: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }))
    
    clientStorage.saveAuthToken(token)
    setAuthStep('authenticated')
    setAuthMessage('인증 완료! 파일을 업로드할 수 있습니다.')
  }

  const handleSubmit = async () => {
    if (files.length === 0) return

    console.log('🚀 [BIZSCAN] 처리 시작 - 총 파일 수:', files.length)
    console.log('🚀 [BIZSCAN] 파일 목록:', files.map(f => `${f.name} (${f.size}bytes)`))

    // 초기화 (재시도가 아닌 경우만 완전 초기화)
    setStatus('analyzing')
    setProgress(0)
    setCurrentFile(0)
    setErrorMessage('')
    setFailedFiles([])
    
    // 재시도인지 확인 (기존 데이터 있으면 재시도)
    const isRetry = processedData.length > 0
    
    if (!isRetry) {
      setSuccessCount(0)
      setProcessedData([])
    } else {
      console.log('🔄 [BIZSCAN] 재시도 모드 - 기존 성공 데이터 유지')
    }
    
    cancelRef.current = false

    // 클라이언트 저장소 초기화 (재시도가 아닌 경우만)
    let existingResults: ExcelRowData[] = []
    
    if (!isRetry) {
      console.log('🔄 [BIZSCAN] 클라이언트 저장소 초기화 중...')
      await clientStorage.clearAll()
      console.log('✅ [BIZSCAN] 클라이언트 저장소 초기화 완료')
    } else {
      console.log('🔄 [BIZSCAN] 재시도 모드 - 기존 성공 데이터 로드 중...')
      const storedResults = await clientStorage.getResults()
      const successResults = storedResults.filter(r => r.status === 'success')
      
      existingResults = successResults.map(r => ({
        companyAndRepresentative: `${r.data.상호명 || ''}(${r.data.대표자명 || ''})`,
        openTime: '',
        memo: '',
        address: r.data.사업자주소 || '',
        businessRegistrationNumber: r.data.사업자등록번호 || '',
        phoneNumber: '',
        isOperational: '',
        대표자명: r.data.대표자명,
        상호명: r.data.상호명,
        사업자주소: r.data.사업자주소,
        사업자등록번호: r.data.사업자등록번호
      }))
      
      console.log(`✅ [BIZSCAN] 기존 성공 데이터 ${existingResults.length}개 로드됨`)
    }

    const totalFiles = files.length
    const results: ExcelRowData[] = []
    const failed: {name: string, error: string}[] = []

    try {
      // 각 파일을 순차적으로 처리
      for (let i = 0; i < files.length; i++) {
        if (cancelRef.current) {
          console.log('⏸️ [BIZSCAN] 사용자가 처리를 일시정지함')
          setStatus('paused')
          break
        }

        const file = files[i]
        console.log(`📝 [BIZSCAN] 파일 ${i + 1}/${files.length} 처리 시작: ${file.name}`)
        setCurrentFile(i + 1)
        
        // 이미지 압축
        console.log(`🗜️ [BIZSCAN] 이미지 압축 중: ${file.name} (원본: ${file.size}bytes)`)
        const compressedFile = await compressImage(file, {
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.6
        })
        console.log(`✅ [BIZSCAN] 압축 완료: ${compressedFile.size}bytes (${Math.round((1 - compressedFile.size/file.size) * 100)}% 감소)`)

        // FormData 생성
        const formData = new FormData()
        formData.append('file', compressedFile)

        // API 호출 함수
        const callAPI = async () => {
          console.log(`🌐 [BIZSCAN] API 호출 시작: ${file.name}`)
          const startTime = Date.now()
          const response = await axios.post('/api/extract-single', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            timeout: 30000
          })
          const duration = Date.now() - startTime
          console.log(`✅ [BIZSCAN] API 응답 받음: ${file.name} (소요시간: ${duration}ms)`)
          return response
        }

        try {
          const response = await callAPI()

          if (response.data.success) {
            console.log(`✅ [BIZSCAN] 데이터 추출 성공: ${file.name}`)
            console.log(`📊 [BIZSCAN] 추출된 데이터:`, response.data.data)
            results.push(response.data.data)
            setSuccessCount(prev => prev + 1)
            
            // 클라이언트 저장소에 저장
            console.log(`💾 [BIZSCAN] 클라이언트 저장소 저장 중: ${file.name}`)
            await clientStorage.saveResult({
              id: `${Date.now()}_${i}`,
              fileName: file.name,
              data: {
                대표자명: response.data.data.대표자명,
                상호명: response.data.data.상호명,
                사업자주소: response.data.data.사업자주소,
                사업자등록번호: response.data.data.사업자등록번호
              },
              confidence: 1,
              processedAt: new Date(),
              status: 'success'
            })
            console.log(`✅ [BIZSCAN] 클라이언트 저장소 저장 완료: ${file.name}`)
          } else {
            throw new Error(response.data.error || '처리 실패')
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류'
          console.error(`❌ [BIZSCAN] 파일 처리 실패: ${file.name}`, error)
          console.log(`❌ [BIZSCAN] 에러 메시지: ${errorMessage}`)
          
          // 500 에러인 경우 한 번 더 재시도
          if (errorMessage.includes('500') && !errorMessage.includes('재시도')) {
            console.log(`🔄 [BIZSCAN] 500 에러 재시도: ${file.name}`)
            await new Promise(resolve => setTimeout(resolve, 3000)) // 3초 대기
            
            try {
              const retryResponse = await callAPI()
              
              if (retryResponse.data.success) {
                console.log(`✅ [BIZSCAN] 재시도 성공: ${file.name}`)
                results.push(retryResponse.data.data)
                setSuccessCount(prev => prev + 1)
                
                await clientStorage.saveResult({
                  id: `${Date.now()}_${i}`,
                  fileName: file.name,
                  data: {
                    대표자명: retryResponse.data.data.대표자명,
                    상호명: retryResponse.data.data.상호명,
                    사업자주소: retryResponse.data.data.사업자주소,
                    사업자등록번호: retryResponse.data.data.사업자등록번호
                  },
                  confidence: 1,
                  processedAt: new Date(),
                  status: 'success'
                })
              } else {
                throw new Error('재시도 실패: ' + retryResponse.data.error)
              }
            } catch (retryError) {
              console.error(`❌ [BIZSCAN] 재시도도 실패: ${file.name}`, retryError)
              failed.push({ name: file.name, error: '재시도 실패: ' + errorMessage })
            }
          } else {
            failed.push({ name: file.name, error: errorMessage })
          }
          
          // 클라이언트 저장소에 실패 저장
          console.log(`💾 [BIZSCAN] 실패 데이터 저장 중: ${file.name}`)
          await clientStorage.saveResult({
            id: `${Date.now()}_${i}`,
            fileName: file.name,
            data: {
              대표자명: '',
              상호명: '',
              사업자주소: '',
              사업자등록번호: ''
            },
            confidence: 0,
            processedAt: new Date(),
            status: 'failed',
            error: errorMessage
          })
        }

        // 진행률 업데이트
        const currentProgress = Math.round(((i + 1) / totalFiles) * 100)
        console.log(`📊 [BIZSCAN] 진행률 업데이트: ${currentProgress}% (${i + 1}/${totalFiles})`)
        setProgress(currentProgress)
        
        // 기존 데이터와 새 데이터 병합
        const mergedData = [...existingResults, ...results]
        setProcessedData(mergedData)
        setFailedFiles([...failed])

        // 2초 대기 (무료 API Rate Limit 방지 - 최적화)
        if (i < files.length - 1) {
          console.log(`⏱️ [BIZSCAN] 2초 대기 중... (다음: ${files[i + 1].name})`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      // 처리 완료
      if (!cancelRef.current) {
        console.log(`🏁 [BIZSCAN] 모든 파일 처리 완료 - 성공: ${results.length}, 실패: ${failed.length}`)
        setStatus('generating')
        
        // 클라이언트에서 Excel 생성 (기존 데이터 + 새 데이터)
        const finalResults = [...existingResults, ...results]
        if (finalResults.length > 0) {
          console.log(`📊 [BIZSCAN] Excel 생성 시작... (기존 ${existingResults.length}개 + 새로운 ${results.length}개 = 총 ${finalResults.length}개 데이터)`)
          const excelStartTime = Date.now()
          const excelBlob = await generateExcelFromData(finalResults)
          const excelDuration = Date.now() - excelStartTime
          console.log(`✅ [BIZSCAN] Excel 생성 완료 (소요시간: ${excelDuration}ms, 크기: ${excelBlob.size}bytes)`)
          setExcelBlob(excelBlob)
        } else {
          console.log(`⚠️ [BIZSCAN] 성공한 데이터가 없어 Excel 생성 안함`)
        }
        
        setStatus('success')
        console.log(`🎉 [BIZSCAN] 전체 처리 완료!`)
      }
    } catch (error) {
      console.error('❌ [BIZSCAN] 전체 처리 중 오류:', error)
      setErrorMessage('처리 중 오류가 발생했습니다.')
      setStatus('error')
    } finally {
      console.log(`🏁 [BIZSCAN] handleSubmit 함수 종료`)
    }
  }

  const handlePauseResume = () => {
    if (status === 'analyzing') {
      cancelRef.current = true
      setStatus('paused')
    } else if (status === 'paused') {
      cancelRef.current = false
      setStatus('analyzing')
      // 재개 로직은 복잡하므로 다시 시작하도록 유도
      handleSubmit()
    }
  }

  const handleRetryFailed = () => {
    // 실패한 파일들만 다시 선택
    const failedFileNames = new Set(failedFiles.map(f => f.name))
    const filesToRetry = files.filter(file => failedFileNames.has(file.name))
    setFiles(filesToRetry)
    setStatus('idle')
    setFailedFiles([])
    // 성공한 데이터는 유지 (초기화 안함)
    setExcelBlob(null)
  }

  const handleDownload = () => {
    if (excelBlob) {
      console.log(`📥 [BIZSCAN] Excel 다운로드 시작 (크기: ${excelBlob.size}bytes)`)
      const url = window.URL.createObjectURL(excelBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'bizscan_results.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      console.log(`✅ [BIZSCAN] Excel 다운로드 완료: bizscan_results.xlsx`)
      
      // 다운로드 후에도 상태 유지 (재시도 가능하도록)
    } else {
      console.error(`❌ [BIZSCAN] Excel Blob이 없어서 다운로드 불가`)
    }
  }

  const handlePartialDownload = async () => {
    if (processedData.length > 0) {
      console.log(`📥 [BIZSCAN] 부분 Excel 다운로드 시작 (${processedData.length}개 데이터)`)
      const partialBlob = await generatePartialExcel(
        processedData,
        files.length,
        successCount,
        failedFiles.length
      )
      
      const filename = `bizscan_partial_${successCount}_of_${files.length}.xlsx`
      const url = window.URL.createObjectURL(partialBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      console.log(`✅ [BIZSCAN] 부분 Excel 다운로드 완료: ${filename} (크기: ${partialBlob.size}bytes)`)
    } else {
      console.error(`❌ [BIZSCAN] 처리된 데이터가 없어서 부분 다운로드 불가`)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="container mx-auto py-12 px-4 max-w-4xl">
        
        <div className="text-center mb-12">
          <div className="flex justify-center items-center gap-3 mb-4">
            <FileSpreadsheet className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold text-slate-900">BizScan</h1>
          </div>
          <p className="text-lg text-slate-600">
            사업자등록증 이미지를 드래그 앤 드롭하여 엑셀 파일로 데이터를 추출하세요
          </p>
        </div>

        {/* 인증 단계 */}
        {authStep === 'request' && (
          <div className="bg-white rounded-xl shadow-sm p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">관리자 인증</h2>
              <p className="text-slate-600 mb-6">관리자에게 인증번호를 요청하세요</p>
            </div>
            
            {authStatus === 'error' && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{authMessage}</AlertDescription>
              </Alert>
            )}
            
            <Button 
              onClick={handleRequestCode}
              disabled={authStatus === 'loading'}
              className="w-full h-16 text-xl"
              size="lg"
            >
              {authStatus === 'loading' ? (
                <>
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3" />
                  인증번호 요청 중...
                </>
              ) : (
                <>
                  <Mail className="mr-3 h-6 w-6" />
                  관리자에게 인증번호 발급받기
                </>
              )}
            </Button>
          </div>
        )}

        {/* 인증번호 입력 단계 */}
        {authStep === 'verify' && (
          <div className="bg-white rounded-xl shadow-sm p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">인증번호 입력</h2>
              <p className="text-slate-600 mb-6">관리자로부터 받은 6자리 인증번호를 입력하세요</p>
            </div>
            
            {authStatus === 'error' && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{authMessage}</AlertDescription>
              </Alert>
            )}
            
            {authMessage && authStatus !== 'error' && (
              <Alert className="border-blue-200 bg-blue-50 mb-4">
                <Mail className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  {authMessage}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-6">
              <div className="flex justify-center gap-3">
                {code.map((digit, index) => (
                  <input
                    key={index}
                    id={`code-${index}`}
                    type="text"
                    value={digit}
                    onChange={(e) => handleCodeInput(index, e.target.value)}
                    className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    maxLength={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !digit && index > 0) {
                        document.getElementById(`code-${index - 1}`)?.focus()
                      }
                    }}
                  />
                ))}
              </div>
              
              <Button 
                onClick={handleVerifyCode}
                disabled={code.join('').length !== 6}
                className="w-full h-14 text-lg"
                size="lg"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                인증 완료
              </Button>
              
              <Button 
                onClick={() => {
                  setAuthStep('request')
                  setCode(['', '', '', '', '', ''])
                  setAuthMessage('')
                  setAuthStatus('idle')
                }}
                variant="outline"
                className="w-full h-12"
              >
                다시 요청하기
              </Button>
            </div>
          </div>
        )}

        {/* 인증 완료 후 파일 업로드 */}
        {authStep === 'authenticated' && (
          <div className="bg-white rounded-xl shadow-sm p-8 space-y-6">
            {/* 상단 컨트롤 버튼들 */}
            <div className="flex gap-3 flex-wrap">
            {/* 초기 엑셀 생성 버튼 */}
            {(status === 'idle' || status === 'error') && (
              <Button 
                onClick={handleSubmit}
                disabled={files.length === 0}
                className="flex-1 h-14 text-lg"
                size="lg"
              >
                {files.length}개 파일로 엑셀 생성
              </Button>
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
                <Button 
                  onClick={() => setShowLivePreview(true)}
                  variant="outline"
                  className="h-14 text-lg px-6"
                  size="lg"
                >
                  <Table className="mr-2 h-5 w-5" />
                  데이터 미리보기
                </Button>
                {failedFiles.length > 0 && (
                  <Button 
                    onClick={() => setShowFailedFilesModal(true)}
                    variant="outline"
                    className="h-14 text-lg px-6"
                    size="lg"
                  >
                    <Eye className="mr-2 h-5 w-5" />
                    실패 목록
                  </Button>
                )}
              </>
            )}

            {/* 재시도 버튼 */}
            {status === 'success' && failedFiles.length > 0 && (
              <Button 
                onClick={handleRetryFailed}
                variant="outline"
                className="w-full h-14 text-lg mt-2"
                size="lg"
              >
                <AlertCircle className="mr-2 h-5 w-5" />
                실패한 {failedFiles.length}개 재시도
              </Button>
            )}
          </div>

          {/* 진행 상황 표시 - 상단으로 이동 */}
          {(status === 'analyzing' || status === 'paused') && (
            <div className="space-y-4 bg-blue-50 p-6 rounded-lg border border-blue-200">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-blue-900">
                  처리 중: {currentFile} / {files.length} ({successCount} 성공, {failedFiles.length} 실패)
                </p>
                <Button
                  onClick={handlePauseResume}
                  variant="outline"
                  size="sm"
                  className="bg-white"
                >
                  {status === 'paused' ? (
                    <><Play className="h-4 w-4 mr-1" /> 재개</>
                  ) : (
                    <><Pause className="h-4 w-4 mr-1" /> 일시정지</>
                  )}
                </Button>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold text-blue-900">{progress}%</span>
                <span className="text-sm text-blue-700 ml-2">완료</span>
              </div>
              <div className="flex gap-2">
                {processedData.length > 0 && (
                  <Button
                    onClick={handlePartialDownload}
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    현재까지 처리된 {processedData.length}개 다운로드
                  </Button>
                )}
                <Button
                  onClick={() => setShowLivePreview(true)}
                  variant="outline"
                  size="sm"
                  className="bg-white"
                >
                  <Table className="h-4 w-4 mr-2" />
                  실시간 데이터 보기
                </Button>
              </div>
            </div>
          )}

          <FileDropzone 
            files={files} 
            onFilesChange={setFiles}
            disabled={status === 'analyzing' || status === 'generating'}
          />

          {status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}


          {status === 'success' && !excelBlob && processedData.length > 0 && (
            <Alert className="border-blue-200 bg-blue-50">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <div className="space-y-2">
                  <p className="font-semibold">
                    총 {files.length}개 파일 중 {successCount}개 성공, {failedFiles.length}개 실패
                  </p>
                  <p>엑셀 파일이 생성되었습니다.</p>
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

          </div>
        )}

        {/* FailedFilesModal 수정 */}
        {failedFiles.length > 0 && (
          <FailedFilesModal
            open={showFailedFilesModal}
            onClose={() => setShowFailedFilesModal(false)}
            failedFiles={files.filter(file => 
              failedFiles.some(failed => failed.name === file.name)
            )}
          />
        )}

        {/* 실시간 데이터 미리보기 모달 */}
        <LivePreviewModal
          open={showLivePreview}
          onClose={() => setShowLivePreview(false)}
          isProcessing={status === 'analyzing' || status === 'generating'}
        />
      </div>
    </main>
  )
}