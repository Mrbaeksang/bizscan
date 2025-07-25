import { NextRequest, NextResponse } from 'next/server'
import { generateExcelFromData } from '@/lib/excel-generator'
import type { ExcelRowData } from '@/lib/excel-generator'

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json()
    const rawData: ExcelRowData[] = requestData.rawData
    
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: '검수할 데이터가 없습니다.' 
      })
    }

    console.log(`🔍 [BIZSCAN] 엑셀 생성 시작 - ${rawData.length}개 데이터`)
    console.log(`📋 [BIZSCAN] 원본 데이터 샘플:`, JSON.stringify(rawData[0], null, 2))
    console.log(`📋 [BIZSCAN] 모든 데이터:`, JSON.stringify(rawData, null, 2))

    // 중복 제거 및 엑셀 생성 (모든 데이터 포함)
    const { uniqueData, duplicatesRemoved } = removeDuplicates(rawData)
    console.log(`🔄 [BIZSCAN] 중복 제거 완료 - ${uniqueData.length}개 남음`)
    
    console.log(`📊 [BIZSCAN] 엑셀 생성 함수 호출 중...`)
    const buffer = await generateExcelFromData(uniqueData)
    console.log(`✅ [BIZSCAN] 엑셀 버퍼 생성 완료 - 크기: ${buffer.length}bytes`)
    
    console.log(`✅ [BIZSCAN] 엑셀 생성 완료 - 원본 ${rawData.length}개 → 최종 ${uniqueData.length}개`)
    
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=bizscan_${uniqueData.length}_items.xlsx`,
        'X-Review-Results': encodeURIComponent(JSON.stringify({
          originalCount: rawData.length,
          afterDeduplication: uniqueData.length,
          duplicatesRemoved: duplicatesRemoved,
          textCorrections: [],
          totalCorrections: 0
        }))
      }
    })

  } catch (error) {
    console.error('❌ [BIZSCAN] 엑셀 생성 중 오류:', error)
    console.error('❌ [BIZSCAN] 오류 스택:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      success: false, 
      error: `엑셀 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` 
    })
  }
}


function removeDuplicates(data: ExcelRowData[]) {
  const seen = new Map<string, ExcelRowData>()
  const uniqueData: ExcelRowData[] = []
  const duplicatesRemoved: Array<{companyName: string, businessNumber: string}> = []
  
  for (const item of data) {
    const businessNumber = item.businessRegistrationNumber?.trim()
    
    if (businessNumber && businessNumber !== '') {
      // 사업자등록번호가 있는 경우
      if (seen.has(businessNumber)) {
        const existingItem = seen.get(businessNumber)!
        // 상호명까지 비교하여 완전히 같은 경우만 중복으로 처리
        if (existingItem.companyAndRepresentative === item.companyAndRepresentative) {
          console.log(`🔄 [BIZSCAN] 중복 제거: ${item.companyAndRepresentative} (${item.businessRegistrationNumber})`)
          
          // 🔥 메모 병합: 둘 중 메모가 있는 것을 우선 사용
          const existingMemo = existingItem.memo?.trim() || ''
          const newMemo = item.memo?.trim() || ''
          
          if (newMemo && !existingMemo) {
            console.log(`📝 [BIZSCAN] 메모 병합 (새→기존): "${existingMemo}" → "${newMemo}"`)
            existingItem.memo = newMemo
          } else if (existingMemo && !newMemo) {
            console.log(`📝 [BIZSCAN] 메모 유지 (기존): "${existingMemo}"`)
          } else if (newMemo && existingMemo) {
            console.log(`📝 [BIZSCAN] 메모 병합 (둘 다): "${existingMemo}" + "${newMemo}"`)
            existingItem.memo = existingMemo + ' | ' + newMemo
          }
          
          duplicatesRemoved.push({
            companyName: item.companyAndRepresentative,
            businessNumber: item.businessRegistrationNumber
          })
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
        console.log(`🔄 [BIZSCAN] 중복 제거 (상호명 기준): ${item.companyAndRepresentative}`)
        
        // 🔥 메모 병합: 둘 중 메모가 있는 것을 우선 사용  
        const existingItem = seen.get(companyKey)!
        const existingMemo = existingItem.memo?.trim() || ''
        const newMemo = item.memo?.trim() || ''
        
        if (newMemo && !existingMemo) {
          console.log(`📝 [BIZSCAN] 메모 병합 (상호명/새→기존): "${existingMemo}" → "${newMemo}"`)
          existingItem.memo = newMemo
        } else if (existingMemo && !newMemo) {
          console.log(`📝 [BIZSCAN] 메모 유지 (상호명/기존): "${existingMemo}"`)
        } else if (newMemo && existingMemo) {
          console.log(`📝 [BIZSCAN] 메모 병합 (상호명/둘 다): "${existingMemo}" + "${newMemo}"`)
          existingItem.memo = existingMemo + ' | ' + newMemo
        }
        
        duplicatesRemoved.push({
          companyName: item.companyAndRepresentative,
          businessNumber: item.businessRegistrationNumber || '없음'
        })
      } else {
        // 사업자등록번호도 상호명도 없는 경우 그냥 추가
        uniqueData.push(item)
      }
    }
  }
  
  return { uniqueData, duplicatesRemoved }
}