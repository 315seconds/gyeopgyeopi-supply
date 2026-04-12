import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import BarcodeScanner from '../../components/BarcodeScanner'
import LabelPrint from '../../components/LabelPrint'
import { notifyAgeWarning } from '../../utils/sendPush'

export default function StaffInventory() {
  const [batches, setBatches]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [scanning, setScanning]     = useState(false)
  const [selected, setSelected]     = useState(null)  // 상세/수정 대상 배치
  const [mode, setMode]             = useState('detail') // 'detail' | 'edit'
  const [printBatch, setPrintBatch] = useState(null)
  const [editForm, setEditForm]     = useState({})
  const [saving, setSaving]         = useState(false)

  useEffect(() => { fetchInventory() }, [])

  async function fetchInventory() {
    setLoading(true)
    const { data } = await supabase.from('v_inventory_current').select('*')
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
    if (!data) { alert('해당 바코드의 배치를 찾을 수 없습니다'); return }
    openDetail(data)
  }

  function openDetail(batch) {
    setSelected(batch)
    setMode('detail')
    setEditForm({
      // processing 상태: 원물 무게, 단가 수정 가능
      raw_weight_kg:    batch.raw_weight_kg ?? '',
      effective_unit_price: batch.effective_unit_price ?? '',
      // available 상태: 위치, 메모만
      location: batch.location ?? '',
      memo:     batch.memo ?? '',
    })
  }

  function close() {
    setSelected(null)
    setMode('detail')
  }

  // ── 수정 저장 ──────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    const updates = {}

    if (selected.status === 'processing') {
      // 원물 무게와 단가 수정 → purchases 테이블도 같이 업데이트
      const rawKg    = parseFloat(editForm.raw_weight_kg)
      const unitPrice = parseInt(editForm.effective_unit_price)
      if (isNaN(rawKg) || isNaN(unitPrice)) {
        alert('올바른 숫자를 입력하세요'); setSaving(false); return
      }
      // purchases 업데이트
      if (selected.purchase_id) {
        await supabase.from('purchases')
          .update({ raw_weight_kg: rawKg, unit_price: unitPrice })
          .eq('id', selected.purchase_id)
      }
      updates.raw_weight_kg = rawKg
    }

    if (selected.status === 'available') {
      // available: 위치, 메모만 수정 가능
      // 단가/무게 수정 원하면 삭제 후 재등록 유도
    }

    // 공통: 위치, 메모
    updates.location = editForm.location || null
    updates.memo     = editForm.memo     || null

    const { error } = await supabase
      .from('inventory_batches')
      .update(updates)
      .eq('id', selected.id)

    if (error) { alert('수정 실패: ' + error.message); setSaving(false); return }

    setSaving(false)
    close()
    fetchInventory()
    alert('수정됐습니다')
  }

  // ── 삭제 ──────────────────────────────────────────────
  async function handleDelete() {
    if (selected.status === 'depleted') {
      alert('출고 완료된 배치는 삭제할 수 없습니다'); return
    }
    const confirmed = confirm(
      `${selected.product_name} — ${selected.batch_code}\n\n이 배치를 삭제하시겠습니까?\n삭제하면 복구할 수 없습니다.`
    )
    if (!confirmed) return

    setSaving(true)

    // 연결된 purchase도 같이 삭제 (processing 단계만, available은 이미 출고 이력 없는 경우만)
    const { error } = await supabase
      .from('inventory_batches')
      .delete()
      .eq('id', selected.id)

    if (error) { alert('삭제 실패: ' + error.message); setSaving(false); return }

    // purchases도 삭제 (해당 배치만 연결된 경우)
    if (selected.purchase_id) {
      const { count } = await supabase
        .from('inventory_batches')
        .select('id', { count: 'exact', head: true })
        .eq('purchase_id', selected.purchase_id)
      if (count === 0) {
        await supabase.from('purchases').delete().eq('id', selected.purchase_id)
      }
    }

    setSaving(false)
    close()
    fetchInventory()
  }

  async function reportAge(batch) {
    const { data: owners } = await supabase.from('users').select('id').eq('role', 'owner')
    if (owners?.length) {
      await supabase.from('notifications').insert(
        owners.map(o => ({
          user_id: o.id,
          type:    'age_warning',
          title:   `${batch.product_name} 경과 경고`,
          body:    `${batch.batch_code} — ${batch.days_since_processing}일 경과. 우선 출고 필요`,
          ref_id:  batch.id,
        }))
      )
      alert('사장님께 경고 알림을 보냈습니다')
      await notifyAgeWarning(batch.product_name, batch.batch_code, batch.days_since_processing)
    }
  }

  // ── 라벨 출력 화면 ─────────────────────────────────────
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

  // ── 상세 / 수정 패널 ───────────────────────────────────
  const DetailPanel = () => {
    if (!selected) return null
    const canDelete = selected.status !== 'depleted'
    const canEditPrice = selected.status === 'processing'

    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'flex-end',
      }}
        onClick={e => { if (e.target === e.currentTarget) close() }}
      >
        <div style={{
          width: '100%', maxWidth: '480px', margin: '0 auto',
          background: 'var(--bg)', borderRadius: '16px 16px 0 0',
          padding: '20px 16px 32px',
          maxHeight: '85vh', overflowY: 'auto',
        }}>
          {/* 핸들 */}
          <div style={{ width: '36px', height: '4px', background: 'var(--border2)', borderRadius: '2px', margin: '0 auto 16px' }} />

          {/* 헤더 */}
          <div className="card-row" style={{ marginBottom: '14px' }}>
            <div>
              <div style={{ fontSize: '17px', fontWeight: 700 }}>{selected.product_name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '2px' }}>{selected.batch_code}</div>
            </div>
            <span className={`badge badge-${selected.status}`}>{selected.status}</span>
          </div>

          {mode === 'detail' ? (
            <>
              {/* 상세 정보 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                {[
                  ['잔량',     `${selected.remaining_weight_kg} kg`],
                  ['출고단가', `${selected.sell_price?.toLocaleString()}원/kg`],
                  ['가공일',   selected.processed_date],
                  ['경과일',   `${selected.days_since_processing}일`],
                  ['손실률',   selected.loss_rate ? `${(selected.loss_rate * 100).toFixed(1)}%` : '-'],
                  ['거래처',   selected.supplier_name ?? '-'],
                  ['위치',     selected.location ?? '-'],
                  ['메모',     selected.memo ?? '-'],
                ].map(([label, value]) => (
                  <div key={label} style={{ background: 'var(--bg2)', borderRadius: 'var(--r-md)', padding: '10px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '3px' }}>{label}</div>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* 경과 경고 바 */}
              <div className={`age-bar age-${selected.freshness}`} style={{ marginBottom: '16px' }} />

              {/* 버튼들 */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button className="btn btn-full" onClick={() => setPrintBatch(selected)}>
                  라벨 재출력
                </button>
                <button className="btn btn-full" style={{ background: 'var(--blue-bg)', color: 'var(--blue-tx)', borderColor: '#B5D4F4' }}
                  onClick={() => setMode('edit')}>
                  수정
                </button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {selected.freshness === 'danger' && (
                  <button className="btn btn-full btn-danger" onClick={() => reportAge(selected)}>
                    사장님께 경고 알림
                  </button>
                )}
                {canDelete && (
                  <button className="btn btn-full btn-danger" onClick={handleDelete} disabled={saving}>
                    {saving ? '삭제 중...' : '삭제'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* 수정 폼 */}
              {canEditPrice && (
                <div className="alert alert-warning" style={{ marginBottom: '14px' }}>
                  숙성 전(processing) 상태 — 원물 무게와 단가를 수정할 수 있습니다
                </div>
              )}
              {!canEditPrice && (
                <div className="alert alert-info" style={{ marginBottom: '14px' }}>
                  출고단가·중량 수정은 삭제 후 재등록이 필요합니다. 위치·메모만 수정 가능합니다.
                </div>
              )}

              {canEditPrice && (
                <div className="form-row" style={{ marginBottom: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">원물 무게 (kg)</label>
                    <input className="form-input" type="number" step="0.1" min="0"
                      value={editForm.raw_weight_kg}
                      onChange={e => setEditForm(f => ({ ...f, raw_weight_kg: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">매입단가 (원/kg)</label>
                    <input className="form-input" type="number" min="0"
                      value={editForm.effective_unit_price}
                      onChange={e => setEditForm(f => ({ ...f, effective_unit_price: e.target.value }))} />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">보관 위치</label>
                <input className="form-input" type="text" placeholder="예: 냉장고 2번 칸"
                  value={editForm.location}
                  onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">메모</label>
                <input className="form-input" type="text" placeholder="특이사항"
                  value={editForm.memo}
                  onChange={e => setEditForm(f => ({ ...f, memo: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
                  {saving ? '저장 중...' : '저장'}
                </button>
                <button className="btn btn-full" onClick={() => setMode('detail')}>취소</button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

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

      {scanning && (
        <div className="card">
          <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />
        </div>
      )}

      <div className="section-label">전체 배치 (오래된 순)</div>
      {batches
        .sort((a, b) => b.days_since_processing - a.days_since_processing)
        .map(batch => (
          <div
            key={batch.id}
            className="card"
            style={{ marginBottom: '6px', cursor: 'pointer' }}
            onClick={() => openDetail(batch)}
          >
            <div className="card-row" style={{ marginBottom: '3px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{batch.product_name}</span>
                {batch.seq === 1 && (
                  <span style={{ fontSize: '10px', background: 'var(--blue-bg)', color: 'var(--blue-tx)', padding: '1px 6px', borderRadius: '10px' }}>
                    우선
                  </span>
                )}
                <span className={`badge badge-${batch.status}`} style={{ fontSize: '10px' }}>
                  {batch.status}
                </span>
              </div>
              <span className={`badge badge-${batch.freshness}`}>{batch.days_since_processing}일</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
              {batch.batch_code} · 잔량 {batch.remaining_weight_kg}kg
              {batch.location && ` · ${batch.location}`}
            </div>
            <div className={`age-bar age-${batch.freshness}`} style={{ marginTop: '6px' }} />
          </div>
        ))}

      {/* 상세/수정 바텀시트 */}
      <DetailPanel />
    </div>
  )
}
