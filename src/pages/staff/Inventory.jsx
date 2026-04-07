import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import BarcodeScanner from '../../components/BarcodeScanner'
import LabelPrint from '../../components/LabelPrint'

export default function StaffInventory() {
  const [batches, setBatches]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [scanning, setScanning] = useState(false)
  const [found, setFound]       = useState(null)
  const [printBatch, setPrintBatch] = useState(null)

  useEffect(() => { fetchInventory() }, [])

  async function fetchInventory() {
    const { data } = await supabase
      .from('v_inventory_current')
      .select('*')
    setBatches(data ?? [])
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

  async function reportAge(batch) {
    // 사장에게 경과 경고 알림 전송
    const { data: owners } = await supabase.from('users').select('id').eq('role', 'owner')
    if (owners?.length) {
      await supabase.from('notifications').insert(
        owners.map(o => ({
          user_id: o.id,
          type: 'age_warning',
          title: `${batch.product_name} 경과 경고`,
          body: `${batch.batch_code} — ${batch.days_since_processing}일 경과. 우선 출고 필요`,
          ref_id: batch.id,
        }))
      )
      alert('사장님께 경고 알림을 보냈습니다')
    }
  }

  if (printBatch) {
    return (
      <div className="page">
        <div className="top-bar"><h1>라벨 재출력</h1></div>
        <LabelPrint batch={printBatch} onClose={() => setPrintBatch(null)} />
      </div>
    )
  }

  if (loading) return <div className="loading">로딩 중...</div>

  const dangerCount = batches.filter(b => b.freshness === 'danger').length

  return (
    <div className="page">
      <div className="top-bar">
        <h1>재고 확인</h1>
        <button className="btn" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setScanning(true)}>
          바코드 스캔
        </button>
      </div>

      {dangerCount > 0 && (
        <div className="alert alert-danger">
          10일 이상 경과 {dangerCount}배치 — 우선 출고 필요
        </div>
      )}

      {/* 스캐너 */}
      {scanning && (
        <div className="card">
          <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />
        </div>
      )}

      {/* 스캔 결과 */}
      {found && (
        <div className="card" style={{ borderColor: 'var(--blue)', marginBottom: '14px' }}>
          <div className="card-row" style={{ marginBottom: '8px' }}>
            <span style={{ fontWeight: 600 }}>{found.product_name} — {found.batch_code}</span>
            <button className="btn" style={{ fontSize: '11px', padding: '3px 8px' }} onClick={() => setFound(null)}>닫기</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '13px', marginBottom: '10px' }}>
            <div><span style={{ color: 'var(--text3)' }}>잔량 </span><strong>{found.remaining_weight_kg}kg</strong></div>
            <div><span style={{ color: 'var(--text3)' }}>출고단가 </span><strong>{found.sell_price?.toLocaleString()}원</strong></div>
            <div><span style={{ color: 'var(--text3)' }}>가공일 </span>{found.processed_date}</div>
            <div><span style={{ color: 'var(--text3)' }}>경과 </span>{found.days_since_processing}일</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-full" style={{ fontSize: '13px' }} onClick={() => setPrintBatch(found)}>
              라벨 재출력
            </button>
            {found.freshness === 'danger' && (
              <button className="btn btn-danger btn-full" style={{ fontSize: '13px' }} onClick={() => reportAge(found)}>
                사장님께 경고 알림
              </button>
            )}
          </div>
        </div>
      )}

      {/* 전체 배치 목록 — 경과일 기준 정렬 (오래된 순) */}
      <div className="section-label">전체 배치 (오래된 순)</div>
      {batches
        .sort((a, b) => b.days_since_processing - a.days_since_processing)
        .map((batch, idx) => (
          <div
            key={batch.id}
            className="card"
            style={{ marginBottom: '6px', cursor: 'pointer' }}
            onClick={() => setFound(batch)}
          >
            <div className="card-row" style={{ marginBottom: '3px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{batch.product_name}</span>
                {batch.seq === 1 && (
                  <span style={{ fontSize: '10px', background: 'var(--blue-bg)', color: 'var(--blue-tx)', padding: '1px 6px', borderRadius: '10px' }}>
                    우선
                  </span>
                )}
              </div>
              <span className={`badge badge-${batch.freshness}`}>{batch.days_since_processing}일</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
              {batch.batch_code} · 잔량 {batch.remaining_weight_kg}kg
            </div>
            <div className={`age-bar age-${batch.freshness}`} style={{ marginTop: '6px' }} />
          </div>
        ))}
    </div>
  )
}
