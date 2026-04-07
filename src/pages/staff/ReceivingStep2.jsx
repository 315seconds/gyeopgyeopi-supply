import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../supabaseClient'
import LabelPrint from '../../components/LabelPrint'

export default function ReceivingStep2() {
  const { profile } = useAuth()
  const [batches, setBatches]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState(null)
  const [finalWeight, setFinalWeight] = useState('')
  const [saving, setSaving]     = useState(false)
  const [printBatch, setPrintBatch] = useState(null)

  useEffect(() => { fetchProcessing() }, [])

  async function fetchProcessing() {
    const { data } = await supabase
      .from('inventory_batches')
      .select('*, products(name, margin_rate), purchases(raw_weight_kg, unit_price, total_amount, suppliers(name))')
      .eq('status', 'processing')
      .order('created_at', { ascending: true })
    setBatches(data ?? [])
    setLoading(false)
  }

  function selectBatch(batch) {
    setSelected(batch)
    setFinalWeight('')
  }

  const rawWeight    = selected?.raw_weight_kg ?? 0
  const finalW       = parseFloat(finalWeight) || 0
  const lossRate     = rawWeight > 0 && finalW > 0 ? ((rawWeight - finalW) / rawWeight * 100).toFixed(1) : null
  const totalAmount  = selected?.purchases?.total_amount ?? 0
  const effectivePrice = finalW > 0 ? Math.round(totalAmount / finalW) : 0
  const marginRate   = selected?.products?.margin_rate ?? 0
  const sellPrice    = effectivePrice > 0 ? Math.round(effectivePrice * (1 + marginRate)) : 0

  async function handleComplete(e) {
    e.preventDefault()
    if (!finalW || finalW <= 0) return alert('최종 중량을 입력하세요')
    if (finalW > rawWeight) return alert('최종 중량이 원물 무게보다 클 수 없습니다')
    setSaving(true)

    const { data: updated, error } = await supabase
      .from('inventory_batches')
      .update({
        initial_weight_kg:    finalW,
        remaining_weight_kg:  finalW,
        effective_unit_price: effectivePrice,
        sell_price:           sellPrice,
        status:               'available',
        processed_date:       new Date().toISOString().slice(0, 10),
      })
      .eq('id', selected.id)
      .select('*, products(name, margin_rate)')
      .single()

    if (error) { alert('저장 실패: ' + error.message); setSaving(false); return }

    // 라벨 출력용 데이터 준비
    setPrintBatch({
      ...updated,
      product_name:  updated.products?.name,
      supplier_name: selected.purchases?.suppliers?.name,
    })

    setSaving(false)
    setSelected(null)
    setFinalWeight('')
    fetchProcessing()
  }

  if (printBatch) {
    return (
      <div className="page">
        <div className="top-bar"><h1>라벨 출력</h1></div>
        <div className="alert alert-success">가공 완료! 라벨을 출력해서 진공팩에 부착해주세요.</div>
        <LabelPrint
          batch={printBatch}
          onClose={() => setPrintBatch(null)}
        />
      </div>
    )
  }

  if (loading) return <div className="loading">로딩 중...</div>

  return (
    <div className="page">
      <div className="top-bar"><h1>가공 완료 등록</h1></div>
      <div className="alert alert-info">
        숙성·트리밍 완료 후 실제 진공포장된 최종 중량을 입력하세요.
      </div>

      {batches.length === 0 && (
        <div className="empty">숙성 중인 배치가 없습니다</div>
      )}

      {/* 배치 선택 목록 */}
      {!selected && batches.map(batch => {
        const daysSince = Math.floor((Date.now() - new Date(batch.created_at)) / 86400000)
        return (
          <div key={batch.id} className="card" style={{ cursor: 'pointer' }} onClick={() => selectBatch(batch)}>
            <div className="card-row">
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{batch.products?.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>
                  {batch.batch_code} · 원물 {batch.raw_weight_kg}kg
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-processing">숙성중 {daysSince}일째</span>
                <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>
                  {batch.purchases?.suppliers?.name}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* 가공 완료 입력 폼 */}
      {selected && (
        <div className="card">
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{selected.products?.name}</div>
            <div style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '2px' }}>
              {selected.batch_code} · 원물 {selected.raw_weight_kg}kg · 매입 {selected.purchases?.total_amount?.toLocaleString()}원
            </div>
          </div>

          <form onSubmit={handleComplete}>
            <div className="form-group">
              <label className="form-label">최종 가공 후 중량 (kg)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                max={rawWeight}
                placeholder={`최대 ${rawWeight}kg`}
                value={finalWeight}
                onChange={e => setFinalWeight(e.target.value)}
                autoFocus
                required
              />
            </div>

            {/* 자동 계산 미리보기 */}
            {finalW > 0 && (
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r-md)', padding: '12px', marginBottom: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                  <div>
                    <div style={{ color: 'var(--text3)', fontSize: '11px' }}>손실률</div>
                    <div style={{ fontWeight: 500, color: lossRate > 20 ? 'var(--red)' : 'var(--text)' }}>
                      {lossRate}%
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text3)', fontSize: '11px' }}>실효단가</div>
                    <div style={{ fontWeight: 500 }}>{effectivePrice.toLocaleString()}원/kg</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text3)', fontSize: '11px' }}>마진</div>
                    <div style={{ fontWeight: 500 }}>{Math.round(marginRate * 100)}%</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text3)', fontSize: '11px' }}>출고단가</div>
                    <div style={{ fontWeight: 600, color: 'var(--green)', fontSize: '15px' }}>
                      {sellPrice.toLocaleString()}원/kg
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary btn-full" disabled={saving || !finalW}>
                {saving ? '저장 중...' : '가공 완료 → 라벨 출력'}
              </button>
              <button type="button" className="btn" onClick={() => setSelected(null)}>취소</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
