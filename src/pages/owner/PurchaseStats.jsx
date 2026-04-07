import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { exportPurchaseStats } from '../../utils/excel'

export default function PurchaseStats() {
  const [stats, setStats]         = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [filter, setFilter] = useState({
    supplier: 'all',
    from: firstDayOfMonth(),
    to:   today(),
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('suppliers').select('id, name').eq('is_active', true)
      .then(({ data }) => setSuppliers(data ?? []))
    fetchStats()
  }, [])

  async function fetchStats() {
    setLoading(true)
    let q = supabase
      .from('v_purchase_stats')
      .select('*')
      .gte('month', filter.from)
      .lte('month', filter.to)
      .order('total_amount', { ascending: false })

    if (filter.supplier !== 'all') q = q.eq('supplier_name', filter.supplier)
    const { data } = await q
    setStats(data ?? [])
    setLoading(false)
  }

  const totalAmount = stats.reduce((s, r) => s + r.total_amount, 0)
  const totalWeight = stats.reduce((s, r) => s + r.total_weight_kg, 0)

  // 거래처별 소계
  const bySupplier = {}
  stats.forEach(r => {
    if (!bySupplier[r.supplier_name]) bySupplier[r.supplier_name] = 0
    bySupplier[r.supplier_name] += r.total_amount
  })
  const maxAmount = Math.max(...Object.values(bySupplier), 1)

  return (
    <div className="page">
      <div className="top-bar">
        <h1>매입 통계</h1>
        <button
          className="btn"
          style={{ fontSize: '12px', padding: '6px 12px' }}
          onClick={() => exportPurchaseStats(stats)}
        >
          엑셀
        </button>
      </div>

      {/* 필터 */}
      <div className="card" style={{ marginBottom: '14px' }}>
        <div className="form-row" style={{ marginBottom: '10px' }}>
          <div>
            <label className="form-label">시작일</label>
            <input className="form-input" type="date" value={filter.from}
              onChange={e => setFilter(f => ({ ...f, from: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">종료일</label>
            <input className="form-input" type="date" value={filter.to}
              onChange={e => setFilter(f => ({ ...f, to: e.target.value }))} />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: '10px' }}>
          <label className="form-label">거래처</label>
          <select className="form-input" value={filter.supplier}
            onChange={e => setFilter(f => ({ ...f, supplier: e.target.value }))}>
            <option value="all">전체</option>
            {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>
        <button className="btn btn-primary btn-full" onClick={fetchStats}>조회</button>
      </div>

      {/* 요약 */}
      <div className="metric-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <div className="metric-card">
          <div className="label">총 매입금액</div>
          <div className="value">{Math.round(totalAmount / 10000)}<span className="unit">만원</span></div>
        </div>
        <div className="metric-card">
          <div className="label">총 매입량</div>
          <div className="value">{Math.round(totalWeight)}<span className="unit">kg</span></div>
        </div>
      </div>

      {/* 거래처별 막대 */}
      {Object.keys(bySupplier).length > 0 && (
        <>
          <div className="section-label">거래처별 매입금액</div>
          <div className="card">
            {Object.entries(bySupplier)
              .sort(([, a], [, b]) => b - a)
              .map(([name, amount]) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ width: '72px', fontSize: '13px', flexShrink: 0 }}>{name}</span>
                  <div style={{ flex: 1, height: '5px', background: 'var(--bg3)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.round(amount / maxAmount * 100)}%`, height: '100%', background: 'var(--green)', borderRadius: '3px' }} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 500, minWidth: '70px', textAlign: 'right' }}>
                    {Math.round(amount / 10000)}만원
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

      {/* 품목별 상세 */}
      {loading && <div className="loading">로딩 중...</div>}
      {!loading && stats.length === 0 && <div className="empty">해당 기간 매입 내역이 없습니다</div>}

      {stats.length > 0 && (
        <>
          <div className="section-label">품목별 상세</div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)' }}>
                  {['거래처', '품목', '중량(kg)', '평균단가', '총금액'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: h === '거래처' || h === '품목' ? 'left' : 'right', fontWeight: 500, color: 'var(--text2)', borderBottom: '0.5px solid var(--border)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td style={{ padding: '8px 10px' }}>{row.supplier_name}</td>
                    <td style={{ padding: '8px 10px' }}>{row.product_name}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{Math.round(row.total_weight_kg)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{row.avg_unit_price?.toLocaleString()}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 500 }}>{row.total_amount?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function firstDayOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function today() {
  return new Date().toISOString().slice(0, 10)
}
