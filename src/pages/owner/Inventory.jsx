import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { exportInventory } from '../../utils/excel'
import BarcodeScanner from '../../components/BarcodeScanner'

export default function OwnerInventory() {
  const [batches, setBatches]   = useState([])
  const [grouped, setGrouped]   = useState({})
  const [loading, setLoading]   = useState(true)
  const [scanning, setScanning] = useState(false)
  const [found, setFound]       = useState(null)

  useEffect(() => { fetchInventory() }, [])

  async function fetchInventory() {
    const { data } = await supabase
      .from('v_inventory_current')
      .select('*')
    setBatches(data ?? [])

    // 품목별 그루핑
    const g = {}
    data?.forEach(b => {
      if (!g[b.product_name]) g[b.product_name] = []
      g[b.product_name].push(b)
    })
    setGrouped(g)
    setLoading(false)
  }

  async function handleScan(code) {
    setScanning(false)
    const { data } = await supabase
      .from('v_inventory_current')
      .select('*')
      .or(`barcode.eq.${code},batch_code.eq.${code}`)
      .single()
    setFound(data ?? null)
    if (!data) alert('해당 바코드의 배치를 찾을 수 없습니다')
  }

  if (loading) return <div className="loading">로딩 중...</div>

  return (
    <div className="page">
      <div className="top-bar">
        <h1>재고 현황</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setScanning(true)}>
            스캔
          </button>
          <button className="btn" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => exportInventory(batches)}>
            엑셀
          </button>
        </div>
      </div>

      {/* 바코드 스캐너 */}
      {scanning && (
        <div className="card">
          <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />
        </div>
      )}

      {/* 스캔 결과 */}
      {found && (
        <div className="card" style={{ borderColor: 'var(--blue)', marginBottom: '14px' }}>
          <div className="card-row" style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: 600, fontSize: '15px' }}>{found.product_name}</span>
            <button className="btn" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => setFound(null)}>닫기</button>
          </div>
          <BatchDetail batch={found} />
        </div>
      )}

      {/* 경고 배지 범례 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span className="badge badge-fresh">0–5일</span>
        <span className="badge badge-warning">6–10일</span>
        <span className="badge badge-danger">10일 이상 ⚠</span>
      </div>

      {/* 품목별 FIFO 배치 목록 */}
      {Object.entries(grouped).map(([product, batchList]) => {
        const totalKg = batchList.reduce((s, b) => s + b.remaining_weight_kg, 0)
        const hasDanger = batchList.some(b => b.freshness === 'danger')
        return (
          <div key={product} style={{ marginBottom: '18px' }}>
            <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{product} {hasDanger && '⚠'}</span>
              <span>{totalKg.toFixed(1)}kg 잔여</span>
            </div>
            {batchList.map((batch, idx) => (
              <div key={batch.id} className="card" style={{ marginBottom: '6px' }}>
                <div className="card-row" style={{ marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {idx === 0 && (
                      <span style={{ fontSize: '10px', background: 'var(--blue-bg)', color: 'var(--blue-tx)', padding: '1px 6px', borderRadius: '10px', fontWeight: 500 }}>
                        우선출고
                      </span>
                    )}
                    <span style={{ fontSize: '13px', fontWeight: 500 }}>{batch.batch_code}</span>
                  </div>
                  <span className={`badge badge-${batch.freshness}`}>
                    {batch.days_since_processing}일 경과
                  </span>
                </div>
                <BatchDetail batch={batch} />
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function BatchDetail({ batch }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '13px' }}>
        <div>
          <span style={{ color: 'var(--text3)' }}>잔량 </span>
          <span style={{ fontWeight: 500 }}>{batch.remaining_weight_kg}kg</span>
        </div>
        <div>
          <span style={{ color: 'var(--text3)' }}>출고단가 </span>
          <span style={{ fontWeight: 500 }}>{batch.sell_price?.toLocaleString()}원/kg</span>
        </div>
        <div>
          <span style={{ color: 'var(--text3)' }}>가공일 </span>
          <span>{batch.processed_date}</span>
        </div>
        <div>
          <span style={{ color: 'var(--text3)' }}>손실률 </span>
          <span>{batch.loss_rate ? (batch.loss_rate * 100).toFixed(1) + '%' : '-'}</span>
        </div>
        {batch.supplier_name && (
          <div>
            <span style={{ color: 'var(--text3)' }}>거래처 </span>
            <span>{batch.supplier_name}</span>
          </div>
        )}
      </div>
      <div className={`age-bar age-${batch.freshness}`} style={{ marginTop: '8px' }} />
    </>
  )
}
