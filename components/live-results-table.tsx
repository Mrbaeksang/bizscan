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
  onMemoChange: (index: number, memo: string) => void
}

export function LiveResultsTable({ isOpen, onClose, data, progress, totalFiles, onMemoChange }: LiveResultsTableProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20 // 한 페이지당 20개씩
  
  // 페이지네이션 계산
  const { paginatedData, totalPages, startIndex, endIndex } = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    const paginated = data.slice(start, end)
    const pages = Math.ceil(data.length / itemsPerPage)
    
    return {
      paginatedData: paginated,
      totalPages: pages,
      startIndex: start,
      endIndex: Math.min(end, data.length)
    }
  }, [data, currentPage, itemsPerPage])

  // 새 데이터가 추가되면 마지막 페이지로 이동 (사용자가 첫 페이지에 있을 때만)
  React.useEffect(() => {
    if (data.length > 0) {
      const lastPage = Math.ceil(data.length / itemsPerPage)
      // 현재 페이지가 1페이지이거나 초기 상태일 때만 마지막 페이지로 이동
      if (currentPage === 1) {
        setCurrentPage(lastPage)
      }
    }
  }, [data.length, itemsPerPage, currentPage])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold">실시간 처리 결과</h2>
            <p className="text-sm text-gray-600 mt-1">
              진행률: {Math.round(progress)}% ({data.length}/{totalFiles}개 완료)
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
                    const actualIndex = startIndex + pageIndex // 실제 데이터 인덱스
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
                            value={row.memo}
                            onChange={(e) => onMemoChange(actualIndex, e.target.value)}
                            className="w-full px-2 py-1 border-0 bg-transparent focus:bg-white focus:border focus:border-blue-500 rounded"
                            placeholder="메모 입력..."
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
                💡 메모를 입력하면 자동 저장됩니다. 최종 엑셀에 포함됩니다.
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