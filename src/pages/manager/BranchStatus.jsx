import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../supabaseClient'

export default function BranchStatus() {
  const { branchId } = useAuth()
  const [byBranch, setByBranch] = useState({})
  const [loading, setLoading]   = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    // 이번달 전체 지점 주문 (내 지점 제외)
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('v_orders')
      .select('*')
      .gte('requested_at', monthStart.toISOString())
      .neq('branch_id', branchId)
      .order('requested_at', { ascending: false })

    const grouped = {}
    data?.forEach(o => {
      if (!grouped[o.branch_name]) grouped[o.branch_name] = []
      grouped[o.branch_name].push(o)
    })
    setByBranch(grouped)
    setLoading(false)
  }

  if (loading) return <div className="loading">로딩 중...</div>

  const thisMonth = new Date().toLocaleDateString('ko-KR', { month: 'long' })

  return (
    <div className="page">
      <div className="top-bar">
        <h1>타지점 현황</h1>
        <div className="sub">{thisMonth}</div>
      </div>

      <div className="alert alert-info">
        다른 지점의 주문 현황을 참고해 발주량을 조정할 수 있습니다 (읽기 전용)
      </div>

      {Object.keys(byBranch).length === 0 && (
        <div className="empty">이번달 타지점 주문 내역이 없습니다</div>
      )}

      {Object.entries(byBranch).map(([branch, orders]) => {
        const totalAmount = orders
          .filter(o => o.status === 'shipped')
          .reduce((s, o) => s + (o.order_total ?? 0), 0)

        return (
          <div key={branch} style={{ marginBottom: '20px' }}>
            <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{branch}</span>
              {totalAmount > 0 && <span>출고 {Math.round(totalAmount / 10000)}만원</span>}
            </div>

            {orders.map(order => {
              const date = new Date(order.requested_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
              return (
                <div key={order.id} className="card" style={{ marginBottom: '6px' }}>
                  <div className="card-row">
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{order.order_number}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text3)', marginLeft: '8px' }}>{date}</span>
                    </div>
                    <span className={`badge badge-${order.status}`}>
                      {{ pending:'대기', approved:'승인', shipped:'출고완료', cancelled:'취소' }[order.status]}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text2)', marginTop: '3px' }}>
                    {order.item_count}품목
                    {order.order_total ? ` · ${Math.round(order.order_total).toLocaleString()}원` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
