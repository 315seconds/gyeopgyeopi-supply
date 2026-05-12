import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../supabaseClient'
import { notifyRole, notifyBranchManager } from '../../utils/notifications'
import { notifyOrderApproved } from '../../utils/sendPush'

const STATUS_FILTER = ['all', 'pending', 'approved', 'shipped']
const STATUS_LABEL  = { all: '전체', pending: '미승인', approved: '승인됨', shipped: '출고완료' }

export default function OwnerOrders() {
  const { profile } = useAuth()
  const [orders, setOrders]   = useState([])
  const [filter, setFilter]   = useState('all')
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => { fetchOrders() }, [filter])

  async function fetchOrders() {
    setLoading(true)
    let q = supabase
      .from('v_orders')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(60)

    if (filter !== 'all') q = q.eq('status', filter)
    const { data } = await q
    setOrders(data ?? [])
    setLoading(false)
  }

  async function approve(orderId, branchId) {
    await supabase
      .from('orders')
      .update({ status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString() })
      .eq('id', orderId)

    // 스태프 + 해당 점장에게 알림
    await notifyRole('staff', {
      type: 'approved', title: '주문이 승인됐습니다', body: '출고 준비를 시작해주세요', ref_id: orderId,
    })
    await notifyBranchManager(branchId, {
      type: 'approved', title: '주문이 승인됐습니다', body: '물건을 준비하고 있습니다', ref_id: orderId,
    })
    // 웹 푸시 발송
    await notifyOrderApproved(branchId, orders.find(o=>o.id===orderId)?.branch_name ?? '', orderId)
    fetchOrders()
  }

  async function cancel(orderId) {
    if (!confirm('주문을 취소하시겠습니까?')) return
    await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', orderId)
    fetchOrders()
  }

  return (
    <div className="page">
      <div className="top-bar">
        <h1>주문 관리</h1>
      </div>

      {/* 필터 탭 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', overflowX: 'auto' }}>
        {STATUS_FILTER.map(s => (
          <button
            key={s}
            className="btn"
            style={{
              padding: '6px 14px', fontSize: '13px', whiteSpace: 'nowrap',
              background: filter === s ? 'var(--burgundy)' : '',
              color: filter === s ? 'var(--cream-2)' : '',
              borderColor: filter === s ? 'var(--burgundy-dark)' : '',
            }}
            onClick={() => setFilter(s)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {loading && <div className="loading">로딩 중...</div>}

      {!loading && orders.length === 0 && (
        <div className="empty">주문 내역이 없습니다</div>
      )}

      {orders.map(order => (
        <OrderCard
          key={order.id}
          order={order}
          expanded={expanded === order.id}
          onToggle={() => setExpanded(expanded === order.id ? null : order.id)}
          onApprove={() => approve(order.id, order.branch_id)}
          onCancel={() => cancel(order.id)}
        />
      ))}
    </div>
  )
}

function OrderCard({ order, expanded, onToggle, onApprove, onCancel }) {
  const [items, setItems] = useState([])

  async function loadItems() {
    if (items.length) return
    const { data } = await supabase
      .from('order_items')
      .select('*, products(name, unit, order_unit)')
      .eq('order_id', order.id)
    setItems(data ?? [])
  }

  function handleToggle() {
    if (!expanded) loadItems()
    onToggle()
  }

  const date = new Date(order.requested_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })

  return (
    <div className="card" style={{ marginBottom: '10px' }}>
      <div style={{ cursor: 'pointer' }} onClick={handleToggle}>
        <div className="card-row" style={{ marginBottom: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>{order.branch_name}</span>
            <span className={`badge badge-${order.status}`}>{STATUS_LABEL[order.status] ?? order.status}</span>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text3)' }}>{date}</span>
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text2)' }}>
          {order.order_number} · {order.item_count}품목
          {order.order_total ? ` · ${Math.round(order.order_total).toLocaleString()}원` : ''}
        </div>
        {order.memo && (
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '4px' }}>
            메모: {order.memo}
          </div>
        )}
      </div>

      {/* 펼침: 품목 상세 + 버튼 */}
      {expanded && (
        <>
          <div className="divider" />
          {items.map(item => {
            const orderUnit = item.products?.order_unit ?? item.products?.unit
            return (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '13px' }}>
                <span>{item.products?.name}</span>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontWeight: 500 }}>{item.requested_qty}{orderUnit}</span>
                  {item.actual_weight_kg != null && (
                    <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '6px' }}>
                      ({item.actual_weight_kg}{item.products?.unit}
                      {item.charged_price ? ` · ${item.charged_price.toLocaleString()}원/${item.products?.unit}` : ''})
                    </span>
                  )}
                </div>
              </div>
            )
          })}

          {order.status === 'pending' && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button className="btn btn-approve btn-full" onClick={onApprove}>승인</button>
              <button className="btn btn-danger" style={{ flexShrink: 0 }} onClick={onCancel}>취소</button>
            </div>
          )}
          {order.status === 'shipped' && order.shipped_by_name && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '8px', textAlign: 'right' }}>
              {order.shipped_by_name} 출고 · {new Date(order.shipped_at).toLocaleDateString('ko-KR')}
            </div>
          )}
        </>
      )}
    </div>
  )
}
