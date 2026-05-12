import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../supabaseClient'
import { shipOrder } from '../../utils/fifo'
import { notifyRole, notifyBranchManager } from '../../utils/notifications'
import { notifyOrderShipped, notifyStockShortage } from '../../utils/sendPush'
import BarcodeScanner from '../../components/BarcodeScanner'

const STATUS_LABEL = { pending: '대기중', approved: '승인됨', shipped: '출고완료', cancelled: '취소됨' }

export default function StaffOrders() {
  const { profile } = useAuth()
  const [orders, setOrders]       = useState([])
  const [filter, setFilter]       = useState('approved')
  const [loading, setLoading]     = useState(true)
  const [shipTarget, setShipTarget] = useState(null)

  useEffect(() => { fetchOrders() }, [filter])

  async function fetchOrders() {
    setLoading(true)
    let q = supabase.from('v_orders').select('*').order('requested_at', { ascending: false }).limit(60)
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setOrders(data ?? [])
    setLoading(false)
  }

  async function startShip(order) {
    // 지점의 브랜드 조회 (FIFO 재고 풀 구분)
    const { data: branch } = await supabase
      .from('branches').select('brand').eq('id', order.branch_id).single()
    const brand = branch?.brand ?? 'gyeobgyeob'

    const { data: items } = await supabase
      .from('order_items')
      .select('*, products(name, unit, order_unit, approx_kg_per_unit)')
      .eq('order_id', order.id)

    const itemsWithBatches = await Promise.all(items.map(async item => {
      const { data: batches } = await supabase
        .from('inventory_batches')
        .select('id, batch_code, barcode, remaining_weight_kg, sell_price, seq, processed_date')
        .eq('product_id', item.product_id)
        .eq('status', 'available')
        .eq('brand', brand)
        .gt('remaining_weight_kg', 0)
        .order('seq', { ascending: true })

      const orderUnit = item.products?.order_unit ?? item.products?.unit ?? 'kg'
      // kg 단위 품목은 requested_qty를 그대로 실중량으로 사용
      const prefilledWeight = orderUnit === 'kg' ? item.requested_qty : null

      return { ...item, actual_weight_kg: prefilledWeight, batches: batches ?? [], scanned: [] }
    }))

    setShipTarget({ order: { ...order, brand }, items: itemsWithBatches })
  }

  async function completeShip(skipped = false) {
    if (!shipTarget) return

    // 스태프 입력 실중량 맵핑
    const actualWeights = {}
    shipTarget.items.forEach(item => {
      if (item.actual_weight_kg > 0) actualWeights[item.id] = item.actual_weight_kg
    })

    const { shortages } = await shipOrder(
      shipTarget.order.id,
      profile.id,
      shipTarget.order.brand ?? 'gyeobgyeob',
      actualWeights,
    )

    await notifyRole('owner', {
      type: 'shipped',
      title: '출고가 완료됐습니다',
      body: `${shipTarget.order.branch_name} 주문 출고 완료${skipped ? ' (스캔 건너뜀)' : ''}`,
      ref_id: shipTarget.order.id,
    })
    await notifyBranchManager(shipTarget.order.branch_id, {
      type: 'shipped',
      title: '물건을 준비했습니다',
      body: '곧 배송됩니다. 확인해주세요!',
      ref_id: shipTarget.order.id,
    })

    if (shortages.length > 0) {
      alert('일부 품목 재고 부족으로 요청량보다 적게 출고됐습니다.\n사장님께 보고해주세요.')
      for (const s of shortages) {
        await notifyStockShortage(
          shipTarget.order.branch_name,
          s.product_id,
          s.shortage
        )
      }
    }

    await notifyOrderShipped(
      shipTarget.order.branch_id,
      shipTarget.order.branch_name,
      shipTarget.order.order_number
    )

    setShipTarget(null)
    fetchOrders()
  }

  if (shipTarget) {
    return (
      <ShipProcess
        target={shipTarget}
        onUpdate={setShipTarget}
        onComplete={completeShip}
        onCancel={() => setShipTarget(null)}
      />
    )
  }

  return (
    <div className="page">
      <div className="top-bar"><h1>주문 출고</h1></div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        {['approved', 'all', 'shipped'].map(s => (
          <button key={s} className="btn"
            style={{
              padding: '6px 14px', fontSize: '13px',
              background: filter === s ? 'var(--burgundy)' : '',
              color: filter === s ? 'var(--cream-2)' : '',
              borderColor: filter === s ? 'var(--burgundy-dark)' : '',
            }}
            onClick={() => setFilter(s)}
          >
            {s === 'approved' ? '출고대기' : s === 'all' ? '전체' : '완료'}
          </button>
        ))}
      </div>

      {filter === 'approved' && orders.length > 0 && (
        <div className="alert alert-warning">출고 대기 {orders.length}건</div>
      )}

      {loading && <div className="loading">로딩 중...</div>}
      {!loading && orders.length === 0 && <div className="empty">해당 주문이 없습니다</div>}

      {orders.map(order => (
        <OrderCard
          key={order.id}
          order={order}
          onShip={() => startShip(order)}
        />
      ))}
    </div>
  )
}

// ── 주문 카드 ────────────────────────────────────────────────
function OrderCard({ order, onShip }) {
  const [expanded, setExpanded] = useState(false)
  const [items, setItems]       = useState([])

  async function handleToggle() {
    if (!expanded && !items.length) {
      const { data } = await supabase
        .from('order_items')
        .select('*, products(name, unit, order_unit)')
        .eq('order_id', order.id)
      setItems(data ?? [])
    }
    setExpanded(e => !e)
  }

  const date = new Date(order.requested_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })

  return (
    <div className="card" style={{ marginBottom: '10px' }}>
      <div style={{ cursor: 'pointer' }} onClick={handleToggle}>
        <div className="card-row" style={{ marginBottom: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{order.branch_name}</span>
            <span className={`badge badge-${order.status}`}>{STATUS_LABEL[order.status]}</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{date}</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
          {order.order_number} · {order.item_count}품목
        </div>
      </div>

      {expanded && (
        <>
          <div className="divider" />
          {items.map(item => {
            const orderUnit = item.products?.order_unit ?? item.products?.unit ?? 'kg'
            return (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
                <span>{item.products?.name}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 500 }}>{item.requested_qty}{orderUnit}</span>
                  {item.actual_weight_kg && (
                    <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '6px' }}>
                      ({item.actual_weight_kg}{item.products?.unit})
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {order.memo && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px' }}>메모: {order.memo}</div>
          )}
          {order.status === 'approved' && (
            <button className="btn btn-ship btn-full" style={{ marginTop: '12px' }} onClick={onShip}>
              출고 시작 →
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── 출고 처리 화면 ──────────────────────────────────────────
function ShipProcess({ target, onUpdate, onComplete, onCancel }) {
  const [currentItemIdx, setCurrentItemIdx] = useState(0)
  const [scanning, setScanning]             = useState(false)
  const [scanResult, setScanResult]         = useState(null)
  const [confirming, setConfirming]         = useState(false)

  const { order, items } = target
  const currentItem = items[currentItemIdx]

  const orderUnit = currentItem.products?.order_unit ?? currentItem.products?.unit ?? 'kg'
  const isKgUnit  = orderUnit === 'kg'

  function getItemProgress(item) {
    const needed  = item.actual_weight_kg ?? 0
    const scanned = item.scanned.reduce((s, b) => s + b.allocated, 0)
    return { needed, scanned, done: needed > 0 && scanned >= needed - 0.001 }
  }

  // 스킵 가능 조건: 모든 품목의 actual_weight_kg가 입력됨
  const allWeightsEntered = items.every(item => (item.actual_weight_kg ?? 0) > 0)
  const allDone           = items.every(item => getItemProgress(item).done)
  const progress          = getItemProgress(currentItem)

  function updateActualWeight(idx, weightKg) {
    const updatedItems = items.map((item, i) => {
      if (i !== idx) return item
      // 중량 변경 시 스캔 초기화
      return { ...item, actual_weight_kg: weightKg > 0 ? weightKg : null, scanned: [] }
    })
    onUpdate({ ...target, items: updatedItems })
    setScanResult(null)
  }

  async function handleScan(code) {
    setScanning(false)
    setScanResult(null)

    const { data: scannedBatch } = await supabase
      .from('inventory_batches')
      .select('id, batch_code, barcode, remaining_weight_kg, sell_price, seq, processed_date, product_id')
      .or(`barcode.eq.${code},batch_code.eq.${code}`)
      .single()

    if (!scannedBatch) {
      setScanResult({ ok: false, type: 'error', message: '등록되지 않은 바코드입니다' })
      return
    }

    if (scannedBatch.product_id !== currentItem.product_id) {
      const { data: p } = await supabase.from('products').select('name').eq('id', scannedBatch.product_id).single()
      setScanResult({
        ok: false, type: 'error',
        message: `잘못된 품목입니다\n스캔: ${p?.name ?? '알 수 없음'}\n필요: ${currentItem.products?.name}`,
      })
      return
    }

    if (currentItem.scanned.find(s => s.id === scannedBatch.id)) {
      setScanResult({ ok: false, type: 'warning', message: '이미 스캔한 배치입니다' })
      return
    }

    const expectedBatches = currentItem.batches.filter(b => !currentItem.scanned.find(s => s.id === b.id))
    const expectedNext    = expectedBatches[0]

    if (expectedNext && scannedBatch.seq > expectedNext.seq) {
      setScanResult({
        ok: false, type: 'fifo',
        message: `FIFO 순서 오류\n먼저 꺼내야 할 배치:\n${expectedNext.batch_code}\n(${Math.floor((new Date() - new Date(expectedNext.processed_date)) / 86400000)}일 경과)`,
        expected: expectedNext,
        scanned: scannedBatch,
      })
      return
    }

    const remaining  = progress.needed - progress.scanned
    const allocated  = Math.min(remaining, scannedBatch.remaining_weight_kg)

    const updatedItems = items.map((item, idx) => {
      if (idx !== currentItemIdx) return item
      return { ...item, scanned: [...item.scanned, { ...scannedBatch, allocated }] }
    })
    onUpdate({ ...target, items: updatedItems })

    const newScanned = allocated + progress.scanned
    const isDone     = newScanned >= progress.needed - 0.001

    setScanResult({
      ok: true, type: 'success',
      message: `✓ ${scannedBatch.batch_code}\n${allocated.toFixed(2)}kg 확인됨${isDone ? '\n이 품목 완료!' : `\n${(progress.needed - newScanned).toFixed(2)}kg 더 필요`}`,
    })

    if (isDone && currentItemIdx < items.length - 1) {
      setTimeout(() => {
        setCurrentItemIdx(i => i + 1)
        setScanResult(null)
      }, 1200)
    }
  }

  function handleSkip() {
    if (!allWeightsEntered) {
      alert('모든 품목의 실제 중량을 먼저 입력해주세요.')
      return
    }
    if (!confirm('바코드 스캔을 건너뛰고 출고 처리하시겠습니까?\nFIFO 순서는 시스템이 자동으로 적용합니다.')) return
    onComplete(true)
  }

  return (
    <div className="page">
      <div className="top-bar">
        <div>
          <h1>출고 처리</h1>
          <div className="sub">{order.branch_name} · {order.order_number}</div>
        </div>
        <button className="btn" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={onCancel}>
          취소
        </button>
      </div>

      {/* 전체 품목 현황 */}
      <div className="card" style={{ marginBottom: '14px' }}>
        <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '8px' }}>품목별 진행 현황</div>
        {items.map((item, idx) => {
          const p       = getItemProgress(item)
          const iUnit   = item.products?.order_unit ?? item.products?.unit ?? 'kg'
          const hasWt   = (item.actual_weight_kg ?? 0) > 0
          return (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '6px 0',
              borderBottom: idx < items.length - 1 ? '0.5px solid var(--border)' : 'none',
              opacity: idx < currentItemIdx ? 0.5 : 1,
            }}>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 600,
                background: p.done ? 'var(--green-bg)' : idx === currentItemIdx ? 'var(--blue-bg)' : 'var(--bg3)',
                color:      p.done ? 'var(--green-tx)' : idx === currentItemIdx ? 'var(--blue-tx)' : 'var(--text3)',
              }}>
                {p.done ? '✓' : idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: idx === currentItemIdx ? 600 : 400 }}>
                  {item.products?.name}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                  주문 {item.requested_qty}{iUnit}
                  {hasWt && ` · 실중량 ${item.actual_weight_kg}kg`}
                  {p.done && ` · 스캔 ${p.scanned.toFixed(2)}kg`}
                </div>
              </div>
              {/* 진행 바 */}
              {hasWt && (
                <div style={{ width: '60px', height: '4px', background: 'var(--bg3)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(p.scanned / p.needed * 100, 100)}%`,
                    height: '100%', borderRadius: '2px',
                    background: p.done ? 'var(--green)' : 'var(--blue)',
                    transition: 'width .3s',
                  }} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* 현재 품목 — 실중량 입력 + 스캔 */}
      {!allDone && (
        <div className="card" style={{ marginBottom: '14px' }}>
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginBottom: '3px' }}>지금 처리할 품목</div>
            <div style={{ fontSize: '17px', fontWeight: 700 }}>{currentItem.products?.name}</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginTop: '2px' }}>
              주문 {currentItem.requested_qty}{orderUnit}
              {currentItem.products?.approx_kg_per_unit && !isKgUnit && (
                <span style={{ color: 'var(--text3)', fontSize: '12px' }}>
                  {' '}(≈ {(currentItem.requested_qty * currentItem.products.approx_kg_per_unit).toFixed(1)}kg 예상)
                </span>
              )}
            </div>
          </div>

          {/* 실제 중량 입력 */}
          <div className="form-group" style={{ marginBottom: '12px' }}>
            <label className="form-label">
              실제 출고 중량 (kg)
              {isKgUnit && (
                <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 400, marginLeft: '6px' }}>
                  kg 단위 품목 — 필요 시 수정 가능
                </span>
              )}
            </label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="저울로 측정한 실제 무게 (kg)"
              value={currentItem.actual_weight_kg ?? ''}
              onChange={e => updateActualWeight(currentItemIdx, parseFloat(e.target.value))}
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* 스캔 영역 — 실중량 입력 후 활성화 */}
          {(currentItem.actual_weight_kg ?? 0) > 0 && (
            <>
              <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '10px' }}>
                {progress.scanned.toFixed(2)} / {progress.needed}kg 스캔 확인됨
              </div>

              {currentItem.batches.length > 0 && (
                <div className="alert alert-info" style={{ marginBottom: '12px', fontSize: '12px' }}>
                  다음 꺼내야 할 배치: <strong>
                    {currentItem.batches.find(b => !currentItem.scanned.find(s => s.id === b.id))?.batch_code}
                  </strong>
                </div>
              )}

              {scanResult && (
                <div className={`alert ${
                  scanResult.type === 'success' ? 'alert-success' :
                  scanResult.type === 'fifo'    ? 'alert-danger'  :
                  scanResult.type === 'warning' ? 'alert-warning' : 'alert-danger'
                }`} style={{ marginBottom: '12px', fontSize: '13px', whiteSpace: 'pre-line' }}>
                  {scanResult.message}
                </div>
              )}

              {scanning ? (
                <BarcodeScanner onScan={handleScan} onClose={() => setScanning(false)} />
              ) : (
                <button
                  className="btn btn-primary btn-full"
                  style={{ fontSize: '15px', height: '46px' }}
                  onClick={() => { setScanResult(null); setScanning(true) }}
                >
                  바코드 스캔
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* 스캔 완료 배치 목록 */}
      {currentItem.scanned.length > 0 && (
        <>
          <div className="section-label">스캔 완료</div>
          {currentItem.scanned.map((b, i) => (
            <div key={i} className="card" style={{ marginBottom: '6px' }}>
              <div className="card-row">
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{b.batch_code}</span>
                <span style={{ fontSize: '13px', color: 'var(--green-tx)', fontWeight: 600 }}>
                  {b.allocated.toFixed(2)}kg ✓
                </span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* 출고완료 버튼 */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
        <button
          className="btn btn-ship btn-full"
          style={{ height: '50px', fontSize: '15px', fontWeight: 600, opacity: allDone ? 1 : 0.4 }}
          disabled={!allDone}
          onClick={() => setConfirming(true)}
        >
          {allDone
            ? '출고 완료 처리'
            : `스캔 대기 중 (${items.filter(i => getItemProgress(i).done).length}/${items.length})`}
        </button>
        <button
          className="btn"
          style={{
            flexShrink: 0, fontSize: '13px', padding: '0 14px',
            color:    allWeightsEntered ? 'var(--text2)' : 'var(--text3)',
            opacity:  allWeightsEntered ? 1 : 0.5,
          }}
          onClick={handleSkip}
        >
          건너뛰기
        </button>
      </div>

      {!allWeightsEntered && (
        <div style={{ fontSize: '12px', color: 'var(--text3)', textAlign: 'center', marginTop: '8px' }}>
          모든 품목의 실제 중량 입력 후 건너뛰기 가능
        </div>
      )}

      {/* 최종 확인 바텀시트 */}
      {confirming && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.35)',
          display: 'flex', alignItems: 'flex-end',
        }}
          onClick={e => { if (e.target === e.currentTarget) setConfirming(false) }}
        >
          <div style={{
            width: '100%', maxWidth: '480px', margin: '0 auto',
            background: 'var(--bg)', borderRadius: '16px 16px 0 0',
            padding: '20px 16px 32px',
          }}>
            <div style={{ width: '36px', height: '4px', background: 'var(--border2)', borderRadius: '2px', margin: '0 auto 16px' }} />
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>출고 확인</div>
            <div style={{ fontSize: '13px', color: 'var(--text2)', marginBottom: '16px' }}>
              {order.branch_name} · {order.order_number}
            </div>
            {items.map(item => {
              const p     = getItemProgress(item)
              const iUnit = item.products?.order_unit ?? item.products?.unit ?? 'kg'
              return (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', borderBottom: '0.5px solid var(--border)' }}>
                  <span>{item.products?.name}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 600 }}>{p.scanned.toFixed(2)}kg</span>
                    <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '6px' }}>
                      ({item.requested_qty}{iUnit} 주문)
                    </span>
                  </div>
                </div>
              )
            })}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <button className="btn btn-ship btn-full" style={{ height: '46px', fontSize: '15px' }}
                onClick={() => { setConfirming(false); onComplete(false) }}>
                출고 완료
              </button>
              <button className="btn btn-full" onClick={() => setConfirming(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
