import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

export default function LabelPrint({ batch, onClose }) {
  const barcodeRef = useRef(null)

  useEffect(() => {
    if (barcodeRef.current && batch?.batch_code) {
      JsBarcode(barcodeRef.current, batch.batch_code, {
        width: 2,
        height: 50,
        displayValue: false,
        margin: 4,
      })
    }
  }, [batch])

  if (!batch) return null

  const lossStr = batch.loss_rate
    ? `${(batch.loss_rate * 100).toFixed(1)}%`
    : '-'

  function handlePrint() {
    const barcodeSvg = barcodeRef.current ? barcodeRef.current.outerHTML : ''

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <title>라벨 — ${batch.product_name}</title>
  <style>
    @page { size: 62mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Apple SD Gothic Neo','Malgun Gothic',sans-serif; width: 62mm; padding: 4mm; background: #fff; }
    .product { font-size: 18px; font-weight: 700; margin-bottom: 3px; }
    .batch   { font-size: 10px; color: #666; margin-bottom: 6px; }
    .barcode svg { width: 100%; }
    table { width: 100%; font-size: 11px; border-collapse: collapse; }
    td { padding: 2px 0; }
    td:last-child { text-align: right; font-weight: 500; }
    .sell { font-size: 13px; font-weight: 700; }
    .sup  { font-size: 10px; color: #aaa; text-align: right; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="product">${batch.product_name}</div>
  <div class="batch">${batch.batch_code}</div>
  <div class="barcode">${barcodeSvg}</div>
  <table>
    <tr><td style="color:#888">가공일</td><td>${batch.processed_date}</td></tr>
    <tr><td style="color:#888">중량</td><td>${batch.remaining_weight_kg} kg</td></tr>
    <tr><td style="color:#888">손실률</td><td>${lossStr}</td></tr>
    <tr><td style="color:#888">출고단가</td><td class="sell">${batch.sell_price?.toLocaleString()}원/kg</td></tr>
  </table>
  ${batch.supplier_name ? `<div class="sup">${batch.supplier_name}</div>` : ''}
  <script>
    window.onload = function() {
      window.print()
      window.onafterprint = function() { window.close() }
    }
  <\/script>
</body>
</html>`

    const win = window.open('', '_blank', 'width=300,height=500')
    if (!win) {
      alert('팝업이 차단됐습니다. 브라우저 팝업 허용 후 다시 시도해주세요.')
      return
    }
    win.document.write(html)
    win.document.close()
  }

  return (
    <div style={{ padding: '16px 0' }}>
      {/* 미리보기 */}
      <div style={{
        width: '200px',
        background: '#fff',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: '10px 12px',
        margin: '0 auto 16px',
      }}>
        <div style={{ fontSize: '17px', fontWeight: 700, marginBottom: '3px' }}>
          {batch.product_name}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--text3)', marginBottom: '6px' }}>
          {batch.batch_code}
        </div>
        <svg ref={barcodeRef} style={{ width: '100%', display: 'block', marginBottom: '6px' }} />
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ color: 'var(--text3)', paddingBottom: '2px' }}>가공일</td>
              <td style={{ textAlign: 'right', fontWeight: 500 }}>{batch.processed_date}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--text3)', paddingBottom: '2px' }}>중량</td>
              <td style={{ textAlign: 'right', fontWeight: 500 }}>{batch.remaining_weight_kg} kg</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--text3)', paddingBottom: '2px' }}>손실률</td>
              <td style={{ textAlign: 'right', fontWeight: 500 }}>{lossStr}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--text3)' }}>출고단가</td>
              <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '13px' }}>
                {batch.sell_price?.toLocaleString()}원/kg
              </td>
            </tr>
          </tbody>
        </table>
        {batch.supplier_name && (
          <div style={{ fontSize: '10px', color: 'var(--text3)', marginTop: '5px', textAlign: 'right' }}>
            {batch.supplier_name}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary btn-full" onClick={handlePrint}>
          라벨 출력
        </button>
        {onClose && (
          <button className="btn btn-full" onClick={onClose}>
            닫기
          </button>
        )}
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text3)', textAlign: 'center', marginTop: '10px' }}>
        팝업창에서 프린터를 선택하세요 (QL-820NWB)
      </p>
    </div>
  )
}
