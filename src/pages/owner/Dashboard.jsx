import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../supabaseClient'

export default function OwnerDashboard() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchDashboard() }, [])

  async function fetchDashboard() {
    const [
      { data: inventory },
      { data: prices },
      { count: pendingCount },
      { data: dangerBatches },
      { data: settlement },
    ] = await Promise.all([
      supabase.from('v_inventory_current').select('remaining_weight_kg, sell_price'),
      supabase.from('v_weighted_avg_price').select('*'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('v_inventory_current').select('product_name, batch_code, days_since_processing').eq('freshness', 'danger'),
      supabase.from('v_monthly_settlement')
        .select('branch_name, total_amount')
        .gte('settlement_month', new Date().toISOString().slice(0, 7) + '-01'),
    ])

    // 총 재고 가치
    const totalValue = inventory?.reduce((s, i) => s + (i.remaining_weight_kg * i.sell_price), 0) ?? 0
    const totalKg    = inventory?.reduce((s, i) => s + i.remaining_weight_kg, 0) ?? 0

    // 지점별 이번달 합계
    const branchTotals = {}
    settlement?.forEach(r => {
      branchTotals[r.branch_name] = (branchTotals[r.branch_name] ?? 0) + r.total_amount
    })

    setData({ totalValue, totalKg, pendingCount, dangerBatches, branchTotals, prices })
    setLoading(false)
  }

  if (loading) return <div className="loading">로딩 중...</div>

  const thisMonth = new Date().toLocaleDateString('ko-KR', { month: 'long' })

  return (
    <div className="page">
      {/* 헤더 */}
      <div className="top-bar">
        <div>
          <h1>안녕하세요, 사장님</h1>
          <div className="sub">{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</div>
        </div>
        <button className="btn" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={signOut}>
          로그아웃
        </button>
      </div>

      {/* 미승인 주문 경고 */}
      {data.pendingCount > 0 && (
        <div
          className="alert alert-warning"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/owner/orders')}
        >
          미승인 주문 {data.pendingCount}건이 있습니다 →
        </div>
      )}

      {/* 경과 경고 배치 */}
      {data.dangerBatches?.length > 0 && (
        <div
          className="alert alert-danger"
          style={{ cursor: 'pointer' }}
          onClick={() => navigate('/owner/inventory')}
        >
          10일 이상 경과 재고 {data.dangerBatches.length}배치 — 우선출고 필요 →
        </div>
      )}

      {/* 핵심 수치 */}
      <div className="metric-grid">
        <div className="metric-card">
          <div className="label">총 재고량</div>
          <div className="value">{Math.round(data.totalKg)}<span className="unit">kg</span></div>
        </div>
        <div className="metric-card">
          <div className="label">재고 가치</div>
          <div className="value">{Math.round(data.totalValue / 10000)}<span className="unit">만원</span></div>
        </div>
        <div className="metric-card">
          <div className="label">미승인 주문</div>
          <div className="value" style={{ color: data.pendingCount > 0 ? 'var(--red)' : 'var(--text)' }}>
            {data.pendingCount}<span className="unit">건</span>
          </div>
        </div>
      </div>

      {/* 이번달 지점별 매출 */}
      <div className="section-label">{thisMonth} 지점별 출고금액</div>
      {Object.entries(data.branchTotals).length === 0 ? (
        <div className="card">
          <p style={{ fontSize: '13px', color: 'var(--text3)', textAlign: 'center' }}>이번달 출고 내역이 없습니다</p>
        </div>
      ) : (
        Object.entries(data.branchTotals).map(([branch, amount]) => (
          <div key={branch} className="card">
            <div className="card-row">
              <span style={{ fontSize: '14px', fontWeight: 500 }}>{branch}</span>
              <span style={{ fontSize: '16px', fontWeight: 600 }}>{amount.toLocaleString()}원</span>
            </div>
          </div>
        ))
      )}

      {/* 현재 품목별 출고단가 */}
      <div className="section-label">현재 출고단가 (가중평균)</div>
      {data.prices?.map(p => (
        <div key={p.product_id} className="card">
          <div className="card-row">
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500 }}>{p.product_name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '2px' }}>
                잔량 {p.total_remaining_kg?.toFixed(1)}kg · 마진 {Math.round((p.margin_rate ?? 0) * 100)}%
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{p.current_sell_price?.toLocaleString()}원</div>
              <div style={{ fontSize: '11px', color: 'var(--text3)' }}>매입 {p.weighted_avg_cost?.toLocaleString()}원/kg</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
