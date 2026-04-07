import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../supabaseClient'
import { shipOrder } from '../../utils/fifo'
import { notifyRole, notifyBranchManager } from '../../utils/notifications'
import BarcodeScanner from '../../components/BarcodeScanner'

const STATUS_LABEL = { pending: '대기중', approved: '승인됨', shipped: '출고완료', cancelled: '취소됨' }

export default function StaffOrders() {
  const { profile } = useAuth()
  const [orders, setOrders]     = useState([])
  const [filter, setFilter]     = useState('approved')
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [shipping, setShipping] = useState(null)  // 출고 처리 중인 orderId
  const [scanTarget, setScanTarget] = useState(null) // 바코드 스캔 중인 orderId

  useEffect(() => { fetchOrders() }, [filter])

  async function fetchOrders() {
    setLoading(true)
    let q = supabase.from('v_orders').select('*').order('requested_at', { ascending: false }).limit(60)
    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setOrders(data ?? [])
    setLoading(false)
  }

  async function handleShip(orderId, branchId) {
    if (!confirm('출고 완료 처리하시겠습니까? 재고가 자동으로 차감됩니다.')) return
    setShipping(orderId)

    const { shortages } = await shipOrder(orderId, profile.id)

    // 알림 발송
    await notifyRole('owner', {
      type: 'shipped', title: '출고가 완료됐습니다',
      body: `${orders.find(o => o.id === orderId)?.branch_name} 주문 출고 완료`,
      ref_id: orderId,
    })
    await notifyBranchManager(branchId, {
      type: 'shipped', title: '물건을 준비했습니다',
      body: '곧 배송됩니다. 확인해주세요!',
      ref_id: orderId,
    })

    if (shortages.length > 0) {
      alert(`일부 품목 재고 부족으로 요청량보다 적게 출고됐습니다.\n확인 후 사장님께 보고해주세요.`)
    }

    setShipping(null)
    setExpanded(null)
    fetchOrders()
  }

  async function handleScan(code) {
    const { data } = await supabase
      .from('inventory_batches')
      .select('id, batch_code, product_id, remaining_weight_kg, sell_price, products(name)')
      .or(`barcode.eq.${code},batch_code.eq.${code}`)
      .single()

    setScanTarget(null)
    if (!data) { alert('해당 배치를 찾을 수 없습니다'); return }
    alert(`✓ ${data.products?.name}\n잔량: ${data.remaining_weight_kg}kg\n출고단가: ${data.sell_price?.toLocaleString()}원/kg`)
  }

  return (
    <div className="page">
      <div className="top-bar">
        <h1>주문 출고</h1>
        <button className="btn" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setScanTarget('check')}>
          재고 스캔
        </button>
      </div>

      {/* 바코드 스캐너 (재고 확인용) */}
      {scanTarget === 'check' && (
        <div className="card">
          <BarcodeScanner onScan={handleScan} onClose={() => setScanTarget(null)} />
        </div>
      )}

      {/* 필터 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
        {['approved', 'all', 'shipped'].map(s => (
          <button
            key={s}
            className="btn"
            style={{
              padding: '6px 14px', fontSize: '13px',
              background: filter === s ? 'var(--text)' : '',
              color: filter === s ? 'var(--bg)' : '',
              borderColor: filter === s ? 'var(--text)' : '',
            }}
            onClick={() => setFilter(s)}
          >
            {s === 'approved' ? '출고대기' : s === 'all' ? '전체' : '완료'}
          </button>
        ))}
      </div>

      {filter === 'approved' && orders.length > 0 && (
        <div className="alert alert-warning">
          출고 대기 {orders.length}건 — 사장님 승인된 주문입니다
        </div>
      )}

      {loading && <div className="loading">로딩 중...</div>}
      {!loading && orders.length === 0 && <div className="empty">해당 주문이 없습니다</div>}

      {orders.map(order => (
        <StaffOrderCard
          key={order.id}
          order={order}
          expanded={expanded === order.id}
          onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
          onShip={() => handleShip(order.id, order.branch_id)}
          shipping={shipping === order.id}
        />
      ))}
    </div>
  )
}

function StaffOrderCard({ order, expanded, onToggle, onShip, shipping }) {
  const [items, setItems] = useState([])

  async function loadItems() {
    if (items.length) return
    const { data } = await supabase
      .from('order_items')
      .select('*, products(name, unit)')
      .eq('order_id', order.id)
    setItems(data ?? [])
  }

  function handleToggle() {
    if (!expanded) loadItems()
    onToggle()
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
          {items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
              <span>{item.products?.name}</span>
              <span style={{ fontWeight: 500 }}>{item.requested_qty}{item.products?.unit}</span>
            </div>
          ))}
          {order.memo && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '6px' }}>
              점장 메모: {order.memo}
            </div>
          )}

          {order.status === 'approved' && (
            <button
              className="btn btn-ship btn-full"
              style={{ marginTop: '12px' }}
              disabled={shipping}
              onClick={onShip}
            >
              {shipping ? '처리 중...' : '출고 완료 처리 (FIFO 자동차감)'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
