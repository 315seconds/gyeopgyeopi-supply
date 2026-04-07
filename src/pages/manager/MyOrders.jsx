import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../supabaseClient'

const STATUS_LABEL = {
  pending:   '승인 대기',
  approved:  '승인됨 — 출고 준비 중',
  shipped:   '출고 완료',
  cancelled: '취소됨',
}
const STATUS_ALERT = {
  pending:   'alert-warning',
  approved:  'alert-info',
  shipped:   'alert-success',
  cancelled: '',
}

export default function ManagerMyOrders() {
  const { branchId } = useAuth()
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { fetchOrders() }, [])

  async function fetchOrders() {
    const { data } = await supabase
      .from('v_orders')
      .select('*')
      .eq('branch_id', branchId)
      .order('requested_at', { ascending: false })
      .limit(40)
    setOrders(data ?? [])
    setLoading(false)
  }

  async function cancelOrder(orderId) {
    if (!confirm('주문을 취소하시겠습니까?')) return
    await supabase.from('orders').update({ status: 'cancelled' }).eq('id', orderId)
    fetchOrders()
  }

  if (loading) return <div className="loading">로딩 중...</div>

  return (
    <div className="page">
      <div className="top-bar"><h1>내 주문 현황</h1></div>

      {orders.length === 0 && <div className="empty">주문 내역이 없습니다</div>}

      {orders.map(order => (
        <OrderCard
          key={order.id}
          order={order}
          expanded={expanded === order.id}
          onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
          onCancel={() => cancelOrder(order.id)}
        />
      ))}
    </div>
  )
}

function OrderCard({ order, expanded, onToggle, onCancel }) {
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

  const dateStr = new Date(order.requested_at).toLocaleDateString('ko-KR', {
    month: 'long', day: 'numeric', weekday: 'short',
  })

  return (
    <div className="card" style={{ marginBottom: '10px' }}>
      <div style={{ cursor: 'pointer' }} onClick={handleToggle}>
        <div className="card-row" style={{ marginBottom: '5px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{order.order_number}</span>
          <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{dateStr}</span>
        </div>

        {/* 상태 표시 */}
        <div className={`alert ${STATUS_ALERT[order.status] ?? ''}`} style={{ margin: '6px 0 0', padding: '6px 10px', fontSize: '12px' }}>
          {STATUS_LABEL[order.status] ?? order.status}
          {order.status === 'shipped' && order.shipped_at && (
            <span style={{ marginLeft: '8px', color: 'inherit', opacity: 0.7 }}>
              {new Date(order.shipped_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <>
          <div className="divider" />

          {/* 품목 목록 */}
          {items.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text3)' }}>로딩 중...</div>
          ) : (
            items.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px', borderBottom: '0.5px solid var(--border)' }}>
                <span>{item.products?.name}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 500 }}>
                    {item.actual_qty ?? item.requested_qty}{item.products?.unit}
                  </span>
                  {item.charged_price && (
                    <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                      {item.charged_price.toLocaleString()}원/{item.products?.unit}
                      {item.line_total && ` = ${Math.round(item.line_total).toLocaleString()}원`}
                    </div>
                  )}
                  {/* 요청량과 실출고량 차이 표시 */}
                  {item.actual_qty && item.actual_qty !== item.requested_qty && (
                    <div style={{ fontSize: '11px', color: 'var(--amber-tx)' }}>
                      요청 {item.requested_qty}{item.products?.unit}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* 총 금액 */}
          {order.order_total > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 0', fontSize: '14px', fontWeight: 600 }}>
              <span>합계</span>
              <span>{Math.round(order.order_total).toLocaleString()}원</span>
            </div>
          )}

          {order.memo && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '8px' }}>
              메모: {order.memo}
            </div>
          )}

          {/* 취소 버튼 (pending 상태만) */}
          {order.status === 'pending' && (
            <button
              className="btn btn-danger btn-full"
              style={{ marginTop: '12px' }}
              onClick={onCancel}
            >
              주문 취소
            </button>
          )}
        </>
      )}
    </div>
  )
}
