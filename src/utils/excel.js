import * as XLSX from 'xlsx'

/**
 * rows: Array<Object>  — 컬럼명이 한글이어도 OK
 * filename: 확장자 없이 전달 (예: '재고현황_2026-04')
 */
export function exportToExcel(rows, filename, sheetName = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * 재고현황 엑셀 export
 */
export function exportInventory(batches) {
  const rows = batches.map(b => ({
    '품목':       b.product_name,
    '배치코드':   b.batch_code,
    '거래처':     b.supplier_name ?? '-',
    '가공일':     b.processed_date,
    '경과일':     b.days_since_processing,
    '초기중량(kg)': b.initial_weight_kg,
    '잔여중량(kg)': b.remaining_weight_kg,
    '손실률(%)':  b.loss_rate ? (b.loss_rate * 100).toFixed(1) : '-',
    '실효단가':   b.effective_unit_price,
    '출고단가':   b.sell_price,
    '위치':       b.location,
    '상태':       b.status,
  }))
  exportToExcel(rows, `재고현황_${today()}`, '재고현황')
}

/**
 * 매입통계 엑셀 export
 */
export function exportPurchaseStats(stats) {
  const rows = stats.map(s => ({
    '월':         s.month,
    '거래처':     s.supplier_name,
    '품목':       s.product_name,
    '구매횟수':   s.purchase_count,
    '총중량(kg)': s.total_weight_kg,
    '평균단가':   s.avg_unit_price,
    '총매입금액': s.total_amount,
  }))
  exportToExcel(rows, `매입통계_${today()}`, '매입통계')
}

/**
 * 월말 정산 엑셀 export (지점별 시트 분리)
 */
export function exportSettlement(rows, month) {
  const wb = XLSX.utils.book_new()
  const branches = [...new Set(rows.map(r => r.branch_name))]

  branches.forEach(branch => {
    const filtered = rows.filter(r => r.branch_name === branch)
    const sheetRows = filtered.map(r => ({
      '품목':      r.product_name,
      '단위':      r.unit,
      '총수량':    r.total_qty,
      '출고단가':  r.unit_sell_price,
      '합계금액':  r.total_amount,
    }))
    // 합계 행 추가
    sheetRows.push({
      '품목': '합계',
      '단위': '',
      '총수량': '',
      '출고단가': '',
      '합계금액': filtered.reduce((s, r) => s + r.total_amount, 0),
    })
    const ws = XLSX.utils.json_to_sheet(sheetRows)
    XLSX.utils.book_append_sheet(wb, ws, branch)
  })

  XLSX.writeFile(wb, `월말정산_${month}.xlsx`)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
