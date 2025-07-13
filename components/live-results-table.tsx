'use client'

import React, { useState, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ExcelRowData } from '@/lib/excel-generator'

interface LiveResultsTableProps {
  isOpen: boolean
  onClose: () => void
  data: ExcelRowData[]
  progress: number
  totalFiles: number
  failedCount: number
  onMemoChange: (index: number, memo: string) => void
}

// 중복 제거 함수 (카운트 포함)
const removeDuplicatesWithCount = (data: ExcelRowData[]): { uniqueData: ExcelRowData[], duplicatesCount: number } => {
  const seen = new Map<string, ExcelRowData>()
  const uniqueData: ExcelRowData[] = []
  let duplicatesCount = 0
  
  for (const item of data) {
    const businessNumber = item.businessRegistrationNumber?.trim()
    
    if (businessNumber && businessNumber !== '') {
      // 사업자등록번호가 있는 경우
      if (seen.has(businessNumber)) {
        const existingItem = seen.get(businessNumber)!
        // 상호명까지 비교하여 완전히 같은 경우만 중복으로 처리
        if (existingItem.companyAndRepresentative === item.companyAndRepresentative) {
          console.log(`🔄 [실시간테이블] 중복 제거: ${item.companyAndRepresentative} (${item.businessRegistrationNumber})`)
          duplicatesCount++
          continue // 중복이므로 추가하지 않음
        }
      }
      
      seen.set(businessNumber, item)
      uniqueData.push(item)
    } else {
      // 사업자등록번호가 없는 경우 상호명으로만 비교
      const companyKey = item.companyAndRepresentative?.trim()
      if (companyKey && !seen.has(companyKey)) {
        seen.set(companyKey, item)
        uniqueData.push(item)
      } else if (companyKey && seen.has(companyKey)) {
        console.log(`🔄 [실시간테이블] 중복 제거 (상호명 기준): ${item.companyAndRepresentative}`)
        duplicatesCount++
      } else {
        // 사업자등록번호도 상호명도 없는 경우 그냥 추가
        uniqueData.push(item)
      }
    }
  }
  
  return { uniqueData, duplicatesCount }
}

export function LiveResultsTable({ isOpen, onClose, data, progress, totalFiles, failedCount, onMemoChange }: LiveResultsTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20 // 한 페이지당 20개씩
  
  // 중복 제거 및 영업 상태별 데이터 분류
  const { operationalData, nonOperationalData, duplicateCount } = useMemo(() => {
    // 먼저 중복 제거
    const { uniqueData, duplicatesCount } = removeDuplicatesWithCount(data)
    
    const operational: ExcelRowData[] = []
    const nonOperational: ExcelRowData[] = []
    
    uniqueData.forEach(item => {
      const isOperationalText = String(item.isOperational || '')
      const hasDelivery = isOperationalText.includes('땡겨요(가능)') || 
                         isOperationalText.includes('요기요(가능)') || 
                         isOperationalText.includes('쿠팡이츠(가능)')
      
      if (hasDelivery) {
        operational.push(item)
      } else {
        nonOperational.push(item)
      }
    })
    
    return { operationalData: operational, nonOperationalData: nonOperational, duplicateCount: duplicatesCount }
  }, [data])
  
  // 모든 데이터 표시 (영업 가능한 것을 먼저 정렬)
  const filteredData = useMemo(() => [...operationalData, ...nonOperationalData], [operationalData, nonOperationalData])
  
  // 페이지네이션 계산
  const { paginatedData, totalPages, startIndex, endIndex } = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    const paginated = filteredData.slice(start, end)
    const pages = Math.ceil(filteredData.length / itemsPerPage)
    
    return {
      paginatedData: paginated,
      totalPages: pages,
      startIndex: start,
      endIndex: Math.min(end, filteredData.length)
    }
  }, [filteredData, currentPage, itemsPerPage])

  // 새 데이터가 추가되면 마지막 페이지로 이동 (사용자가 첫 페이지에 있을 때만)
  React.useEffect(() => {
    if (filteredData.length > 0) {
      const lastPage = Math.ceil(filteredData.length / itemsPerPage)
      // 현재 페이지가 1페이지이거나 초기 상태일 때만 마지막 페이지로 이동
      if (currentPage === 1) {
        setCurrentPage(lastPage)
      }
    }
  }, [filteredData.length, itemsPerPage, currentPage])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">실시간 처리 결과</h2>
            <p className="text-sm text-gray-600 mt-1">
              진행률: {Math.round(progress)}% ({data.length}/{totalFiles}개 완료) | 
              표시: 영업가능 {operationalData.length}개 + 영업불가 {nonOperationalData.length}개 = {operationalData.length + nonOperationalData.length}개
              {duplicateCount > 0 && ` (중복 ${duplicateCount}개 제거됨)`} | 실패: {failedCount}개
              {totalPages > 1 && ` | 페이지 ${currentPage}/${totalPages} (${startIndex + 1}-${endIndex})`}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* 테이블 */}
        <div className="flex-1 overflow-auto p-6">
          {data.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              처리된 결과가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-pink-600 text-white">
                    <th className="border border-gray-300 px-3 py-2 text-left font-medium">🏪 상호명</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-medium">📝 메모</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-medium">📞 전화번호</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-medium">🕐 영업시간</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-medium">📍 주소</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-medium">📄 사업자번호</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-medium">땡겨요</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-medium">요기요</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-medium">쿠팡이츠</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((row, pageIndex) => {
                    // 중복 제거로 인해 원본 인덱스 찾기가 복잡해짐
                    // 사업자번호 + 상호명으로 고유 식별
                    const uniqueKey = `${row.businessRegistrationNumber || ''}-${row.companyAndRepresentative || ''}`
                    const actualIndex = data.findIndex(item => 
                      `${item.businessRegistrationNumber || ''}-${item.companyAndRepresentative || ''}` === uniqueKey
                    )
                    
                    // 인덱스를 찾지 못한 경우 스킵
                    if (actualIndex === -1) {
                      console.error('Could not find matching item for memo update:', uniqueKey)
                      return null
                    }
                    // 배달앱 상태 파싱
                    const parseDeliveryStatus = (isOperational: string) => {
                      const ddangyo = isOperational.includes('땡겨요(가능)') ? '✅' : '❌'
                      const yogiyo = isOperational.includes('요기요(가능)') ? '✅' : '❌'
                      const coupangeats = isOperational.includes('쿠팡이츠(가능)') ? '✅' : '❌'
                      return { ddangyo, yogiyo, coupangeats }
                    }

                    const deliveryStatus = parseDeliveryStatus(row.isOperational)

                    return (
                      <tr key={actualIndex} className={pageIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="border border-gray-300 px-3 py-2 text-left font-bold">{row.companyAndRepresentative}</td>
                        <td className="border border-gray-300 px-1 py-1">
                          <input
                            type="text"
                            value={row.memo || ''}
                            onChange={(e) => onMemoChange(actualIndex, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                (e.target as HTMLInputElement).blur(); // 엔터 시 포커스 해제로 저장 확실히
                                console.log('🔥 [메모저장] 엔터키로 저장:', (e.target as HTMLInputElement).value);
                              }
                            }}
                            onBlur={(e) => {
                              console.log('🔥 [메모저장] 포커스 아웃으로 저장:', (e.target as HTMLInputElement).value);
                            }}
                            className="w-full px-2 py-1 border-0 bg-transparent focus:bg-white focus:border focus:border-blue-500 rounded"
                            placeholder="메모 입력 후 엔터..."
                          />
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-left font-bold">{row.phoneNumber}</td>
                        <td className="border border-gray-300 px-3 py-2 text-left font-bold">{row.openTime}</td>
                        <td className="border border-gray-300 px-3 py-2 text-left font-bold">{row.address}</td>
                        <td className="border border-gray-300 px-3 py-2 text-left font-bold font-mono">{row.businessRegistrationNumber}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center">
                          <span className={`font-bold ${deliveryStatus.ddangyo === '✅' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'} px-2 py-1 rounded text-sm`}>
                            {deliveryStatus.ddangyo}
                          </span>
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center">
                          <span className={`font-bold ${deliveryStatus.yogiyo === '✅' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'} px-2 py-1 rounded text-sm`}>
                            {deliveryStatus.yogiyo}
                          </span>
                        </td>
                        <td className="border border-gray-300 px-3 py-2 text-center">
                          <span className={`font-bold ${deliveryStatus.coupangeats === '✅' ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'} px-2 py-1 rounded text-sm`}>
                            {deliveryStatus.coupangeats}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-6 border-t bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                💡 메모 입력 후 <strong>엔터키</strong> 또는 <strong>다른 곳 클릭</strong>하면 저장됩니다.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <span className="text-sm px-2">
                    {currentPage} / {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              
              <Button onClick={onClose}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}