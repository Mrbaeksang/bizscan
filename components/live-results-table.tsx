'use client'

import React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ExcelRowData } from '@/lib/excel-generator'

interface LiveResultsTableProps {
  isOpen: boolean
  onClose: () => void
  data: ExcelRowData[]
  progress: number
  totalFiles: number
}

export function LiveResultsTable({ isOpen, onClose, data, progress, totalFiles }: LiveResultsTableProps) {
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
                  <tr className="bg-blue-600 text-white">
                    <th className="border border-gray-300 px-3 py-2 text-left font-medium">🏪 상호명</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-medium">📞 전화번호</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-medium">🕐 영업시간</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-medium">📍 주소</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-medium">📄 사업자번호</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-medium">땡겨요</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-medium">요기요</th>
                    <th className="border border-gray-300 px-3 py-2 text-center font-medium">쿠팡이츠</th>
                    <th className="border border-gray-300 px-3 py-2 text-left font-medium">📝 메모</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => {
                    // 배달앱 상태 파싱
                    const parseDeliveryStatus = (isOperational: string) => {
                      const ddangyo = isOperational.includes('땡겨요(가능)') ? '✅' : '❌'
                      const yogiyo = isOperational.includes('요기요(가능)') ? '✅' : '❌'
                      const coupangeats = isOperational.includes('쿠팡이츠(가능)') ? '✅' : '❌'
                      return { ddangyo, yogiyo, coupangeats }
                    }

                    const deliveryStatus = parseDeliveryStatus(row.isOperational)

                    return (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="border border-gray-300 px-3 py-2">{row.companyAndRepresentative}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center">{row.phoneNumber}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center">{row.openTime}</td>
                        <td className="border border-gray-300 px-3 py-2">{row.address}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center font-mono">{row.businessRegistrationNumber}</td>
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
                        <td className="border border-gray-300 px-3 py-2">{row.memo}</td>
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
            <p className="text-sm text-gray-600">
              💡 처리가 완료되면 엑셀 다운로드 버튼이 활성화됩니다.
            </p>
            <Button onClick={onClose}>
              닫기
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}