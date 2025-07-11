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

export async function generateExcelFromData(data: ExcelRowData[]): Promise<Blob> {
  // 엑셀 파일 생성
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('사업자등록증 데이터')

  // 열 정의
  worksheet.columns = [
    { header: '상호명(대표자명)', key: 'companyAndRepresentative', width: 40 },
    { header: '오픈시간', key: 'openTime', width: 20 },
    { header: '메모', key: 'memo', width: 30 },
    { header: '주소', key: 'address', width: 60 },
    { header: '사업자번호', key: 'businessRegistrationNumber', width: 25 },
    { header: '전화번호', key: 'phoneNumber', width: 20 },
    { header: '영업가능', key: 'isOperational', width: 15 },
  ]

  // 헤더 스타일링
  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  }

  // 데이터 추가
  data.forEach(row => {
    worksheet.addRow(row)
  })

  // 자동 필터 추가
  worksheet.autoFilter = {
    from: 'A1',
    to: 'G1'
  }

  // 엑셀 파일을 Blob으로 변환
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
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

  // 열 정의
  const headerRow = 5
  worksheet.getRow(headerRow).values = [
    '상호명(대표자명)',
    '오픈시간',
    '메모',
    '주소',
    '사업자번호',
    '전화번호',
    '영업가능'
  ]

  // 헤더 스타일링
  worksheet.getRow(headerRow).font = { bold: true }
  worksheet.getRow(headerRow).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  }

  // 데이터 추가
  data.forEach((row, index) => {
    worksheet.getRow(headerRow + index + 1).values = [
      row.companyAndRepresentative,
      row.openTime,
      row.memo,
      row.address,
      row.businessRegistrationNumber,
      row.phoneNumber,
      row.isOperational
    ]
  })

  // 열 너비 설정
  worksheet.columns = [
    { width: 40 }, // 상호명(대표자명)
    { width: 20 }, // 오픈시간
    { width: 30 }, // 메모
    { width: 60 }, // 주소
    { width: 25 }, // 사업자번호
    { width: 20 }, // 전화번호
    { width: 15 }, // 영업가능
  ]

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
}