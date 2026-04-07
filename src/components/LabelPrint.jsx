import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

/**
 * 라벨 출력 컴포넌트
 * batch: inventory_batches row (product_name 포함)
 */
export default function LabelPrint({ batch, onClose }) {
  const barcodeRef = useRef(null)

  useEffect(() => {
    if (barcodeRef.current && batch?.batch_code) {
      JsBarcode(barcodeRef.current, batch.batch_code, {
        format:      'CODE128',
        width:       2,
        height:      50,
        displayValue: false,
        margin:      4,
      })
    }
  }, [batch])

  if (!batch) return null

  function handlePrint() {
    window.print()
  }

  const lossStr = batch.loss_rate
    ? `${(batch.loss_rate * 100).toFixed(1)}%`
    : '-'

  return (
    <div style={{ padding: '16px 0' }}>
      {/* 실제 출력 영역 */}
      <div
        className="print-area"
        style={{
          width: '62mm',
          background: '#fff',
          border: '0.5px solid var(--border)',
          borderRadius: 'var(--r-md)',
          padding: '8px 10px',
          margin: '0 auto 16px',
          fontFamily: 'var(--font)',
        }}
      >
        {/* 품목명 */}
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>
          {batch.product_name}
        </div>

        {/* 배치코드 */}
        <div style={{ fontSize: '10px', color: '#666', marginBottom: '6px' }}>
          {batch.batch_code}
        </div>

        {/* 바코드 */}
        <svg ref={barcodeRef} style={{ width: '100%', display: 'block', marginBottom: '6px' }} />

        {/* 핵심 정보 */}
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ color: '#888', paddingBottom: '2px' }}>가공일</td>
              <td style={{ textAlign: 'right', fontWeight: 500 }}>{batch.processed_date}</td>
            </tr>
            <tr>
              <td style={{ color: '#888', paddingBottom: '2px' }}>중량</td>
              <td style={{ textAlign: 'right', fontWeight: 500 }}>
                {batch.remaining_weight_kg} kg
              </td>
            </tr>
            <tr>
              <td style={{ color: '#888', paddingBottom: '2px' }}>손실률</td>
              <td style={{ textAlign: 'right', fontWeight: 500 }}>{lossStr}</td>
            </tr>
            <tr>
              <td style={{ color: '#888' }}>출고단가</td>
              <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '12px' }}>
                {batch.sell_price?.toLocaleString()}원/kg
              </td>
            </tr>
          </tbody>
        </table>

        {/* 거래처 */}
        {batch.supplier_name && (
          <div style={{ fontSize: '10px', color: '#aaa', marginTop: '5px', textAlign: 'right' }}>
            {batch.supplier_name}
          </div>
        )}
      </div>

      {/* 버튼들 */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-full btn-primary" onClick={handlePrint}>
          라벨 출력
        </button>
        {onClose && (
          <button className="btn btn-full" onClick={onClose}>
            닫기
          </button>
        )}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text3)', textAlign: 'center', marginTop: '10px' }}>
        본사 WiFi 연결된 QL-820NWB 프린터로 출력됩니다
      </p>
    </div>
  )
}
