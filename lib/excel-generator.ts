import ExcelJS from 'exceljs'

export interface ExcelRowData {
  companyAndRepresentative: string
  openTime: string
  memo: string
  address: string
  businessRegistrationNumber: string
  phoneNumber: string
  isOperational: string
}

export async function generateExcelFromData(data: ExcelRowData[]): Promise<Buffer> {
  // 엑셀 파일 생성
  const workbook = new ExcelJS.Workbook()
  
  // 한글 지원을 위한 설정
  workbook.creator = 'BizScan'
  workbook.lastModifiedBy = 'BizScan'
  workbook.created = new Date()
  workbook.modified = new Date()
  
  const worksheet = workbook.addWorksheet('사업자등록증 데이터')

  // 열 정의 (메모 칸 맨 뒤로 이동)
  worksheet.columns = [
    { header: '🏪 상호명', key: 'companyAndRepresentative', width: 35 },
    { header: '📞 전화번호', key: 'phoneNumber', width: 18 },
    { header: '🕐 영업시간', key: 'openTime', width: 18 },
    { header: '📍 주소', key: 'address', width: 50 },
    { header: '📄 사업자번호', key: 'businessRegistrationNumber', width: 20 },
    { header: '땡겨요', key: 'ddangyo', width: 12 },
    { header: '요기요', key: 'yogiyo', width: 12 },
    { header: '쿠팡이츠', key: 'coupangeats', width: 12 },
    { header: '📝 메모', key: 'memo', width: 25 },
  ]

  // 헤더 스타일링 (더 예쁜 색상)
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' } // 파란색 헤더
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 25

  // 영업가능 상태 파싱 함수
  function parseDeliveryStatus(isOperational: string): {ddangyo: string, yogiyo: string, coupangeats: string} {
    const ddangyo = isOperational.includes('땡겨요(가능)') ? '✅' : '❌'
    const yogiyo = isOperational.includes('요기요(가능)') ? '✅' : '❌'
    const coupangeats = isOperational.includes('쿠팡이츠(가능)') ? '✅' : '❌'
    return { ddangyo, yogiyo, coupangeats }
  }

  // 데이터 정렬: 배달앱 가능한 것을 먼저, 불가능한 것을 뒤로
  const sortedData = [...data].sort((a, b) => {
    const aText = String(a.isOperational || '')
    const bText = String(b.isOperational || '')
    
    const aHasDelivery = aText.includes('땡겨요(가능)') || 
                        aText.includes('요기요(가능)') || 
                        aText.includes('쿠팡이츠(가능)')
    const bHasDelivery = bText.includes('땡겨요(가능)') || 
                        bText.includes('요기요(가능)') || 
                        bText.includes('쿠팡이츠(가능)')
    
    // 배달 가능한 것을 먼저 (0), 불가능한 것을 뒤로 (1)
    return Number(!aHasDelivery) - Number(!bHasDelivery)
  })

  // 데이터 추가 (가독성 최적화)
  sortedData.forEach((row, index) => {
    const isOperationalText = String(row.isOperational || '')
    const deliveryStatus = parseDeliveryStatus(isOperationalText)
    
    // 한글 문자열을 안전하게 처리 (메모 맨 뒤로 이동)
    const safeRow = {
      companyAndRepresentative: String(row.companyAndRepresentative || ''),
      phoneNumber: String(row.phoneNumber || ''),
      openTime: String(row.openTime || ''),
      address: String(row.address || ''),
      businessRegistrationNumber: String(row.businessRegistrationNumber || ''),
      ddangyo: deliveryStatus.ddangyo,
      yogiyo: deliveryStatus.yogiyo,
      coupangeats: deliveryStatus.coupangeats,
      memo: String(row.memo || '')
    }
    const addedRow = worksheet.addRow(safeRow)
    
    // 행 번갈아 색칠 (zebra striping)
    if ((index + 2) % 2 === 0) {
      addedRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8F9FA' } // 연한 회색
      }
    }
    
    // 배달앱 컬럼들에 색상 처리 (6, 7, 8열)
    [6, 7, 8].forEach(colIndex => {
      const cell = addedRow.getCell(colIndex)
      const cellValue = String(cell.value || '')
      
      if (cellValue === '✅') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD4EDDA' } // 연한 초록색
        }
        cell.font = { color: { argb: 'FF155724' }, bold: true, size: 12 }
      } else if (cellValue === '❌') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8D7DA' } // 연한 빨간색
        }
        cell.font = { color: { argb: 'FF721C24' }, bold: true, size: 12 }
      }
      
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    
    // 텍스트 정렬 설정
    addedRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' } // 상호명
    addedRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' } // 전화번호
    addedRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' } // 영업시간
    addedRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' } // 주소
    addedRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' } // 사업자번호
    addedRow.getCell(9).alignment = { vertical: 'middle', horizontal: 'left' } // 메모
    
    // 전체 행에 대한 폰트 설정 (크기 12, 볼드)
    addedRow.eachCell((cell, colNumber) => {
      // 배달앱 컬럼(6,7,8열)이 아닌 경우에만 폰트 설정 적용
      if (colNumber < 6 || colNumber > 8) {
        cell.font = { size: 12, bold: true }
      }
    })
    
    // 행 높이 설정
    addedRow.height = 20
  })
  
  // 모든 셀에 테두리 추가
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      }
    })
  })

  // 자동 필터 추가
  worksheet.autoFilter = {
    from: 'A1',
    to: 'I1'
  }

  // 엑셀 파일을 Buffer로 변환 (한글 지원)
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// 부분 데이터로 Excel 생성 (진행 중 저장용)
export async function generatePartialExcel(
  data: ExcelRowData[],
  totalCount: number,
  successCount: number,
  failedCount: number
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('사업자등록증 데이터')

  // 요약 정보 추가
  worksheet.addRow(['처리 요약'])
  worksheet.addRow(['총 파일 수', totalCount])
  worksheet.addRow(['성공', successCount])
  worksheet.addRow(['실패', failedCount])

  // 열 정의 (가독성 최적화, 메모 맨 뒤로)
  const headerRow = 5
  worksheet.getRow(headerRow).values = [
    '🏪 상호명',
    '📞 전화번호', 
    '🕐 영업시간',
    '📍 주소',
    '📄 사업자번호',
    '땡겨요',
    '요기요',
    '쿠팡이츠',
    '📝 메모'
  ]

  // 헤더 스타일링 (메인과 동일)
  const headerRowObj = worksheet.getRow(headerRow)
  headerRowObj.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRowObj.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' } // 파란색 헤더
  }
  headerRowObj.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRowObj.height = 25

  // 영업가능 상태 파싱 함수 (동일)
  function parseDeliveryStatus(isOperational: string): {ddangyo: string, yogiyo: string, coupangeats: string} {
    const ddangyo = isOperational.includes('땡겨요(가능)') ? '✅' : '❌'
    const yogiyo = isOperational.includes('요기요(가능)') ? '✅' : '❌'
    const coupangeats = isOperational.includes('쿠팡이츠(가능)') ? '✅' : '❌'
    return { ddangyo, yogiyo, coupangeats }
  }

  // 데이터 정렬: 배달앱 가능한 것을 먼저, 불가능한 것을 뒤로
  const sortedData = [...data].sort((a, b) => {
    const aText = String(a.isOperational || '')
    const bText = String(b.isOperational || '')
    
    const aHasDelivery = aText.includes('땡겨요(가능)') || 
                        aText.includes('요기요(가능)') || 
                        aText.includes('쿠팡이츠(가능)')
    const bHasDelivery = bText.includes('땡겨요(가능)') || 
                        bText.includes('요기요(가능)') || 
                        bText.includes('쿠팡이츠(가능)')
    
    // 배달 가능한 것을 먼저 (0), 불가능한 것을 뒤로 (1)
    return Number(!aHasDelivery) - Number(!bHasDelivery)
  })

  // 데이터 추가 (메인과 동일한 스타일)
  sortedData.forEach((row, index) => {
    const isOperationalText = String(row.isOperational || '')
    const deliveryStatus = parseDeliveryStatus(isOperationalText)
    
    const dataRow = worksheet.getRow(headerRow + index + 1)
    dataRow.values = [
      row.companyAndRepresentative,
      row.phoneNumber,
      row.openTime,
      row.address,
      row.businessRegistrationNumber,
      deliveryStatus.ddangyo,
      deliveryStatus.yogiyo,
      deliveryStatus.coupangeats,
      row.memo
    ]
    
    // 행 번갈아 색칠 (zebra striping) - 메인 함수와 일관성 유지
    if ((index + headerRow + 1) % 2 === 0) {
      dataRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8F9FA' } // 연한 회색
      }
    }
    
    // 배달앱 컬럼들에 색상 처리 (6, 7, 8열)
    [6, 7, 8].forEach(colIndex => {
      const cell = dataRow.getCell(colIndex)
      const cellValue = String(cell.value || '')
      
      if (cellValue === '✅') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD4EDDA' } // 연한 초록색
        }
        cell.font = { color: { argb: 'FF155724' }, bold: true, size: 12 }
      } else if (cellValue === '❌') {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8D7DA' } // 연한 빨간색
        }
        cell.font = { color: { argb: 'FF721C24' }, bold: true, size: 12 }
      }
      
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    
    // 텍스트 정렬 설정
    dataRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' } // 상호명
    dataRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' } // 전화번호
    dataRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' } // 영업시간
    dataRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' } // 주소
    dataRow.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' } // 사업자번호
    dataRow.getCell(9).alignment = { vertical: 'middle', horizontal: 'left' } // 메모
    
    // 전체 행에 대한 폰트 설정 (크기 12, 볼드)
    dataRow.eachCell((cell, colNumber) => {
      // 배달앱 컬럼(6,7,8열)이 아닌 경우에만 폰트 설정 적용
      if (colNumber < 6 || colNumber > 8) {
        cell.font = { size: 12, bold: true }
      }
    })
    
    // 행 높이 설정
    dataRow.height = 20
  })
  
  // 모든 셀에 테두리 추가
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber >= headerRow) {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        }
      })
    }
  })

  // 열 너비 설정 (새로운 구조에 맞게)
  worksheet.columns = [
    { width: 35 }, // 🏪 상호명
    { width: 18 }, // 📞 전화번호
    { width: 18 }, // 🕐 영업시간
    { width: 50 }, // 📍 주소
    { width: 20 }, // 📄 사업자번호
    { width: 12 }, // 땡겨요
    { width: 12 }, // 요기요
    { width: 12 }, // 쿠팡이츠
    { width: 25 }, // 📝 메모
  ]

  // 자동 필터 추가
  if (data.length > 0) {
    worksheet.autoFilter = {
      from: `A${headerRow}`,
      to: `I${headerRow}`
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
}