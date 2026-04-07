import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../supabaseClient'
import { exportSettlement } from '../../utils/excel'

export default function Settlement() {
  const { role, branchId, branchName } = useAuth()
  const isOwner = role === 'owner'

  const [rows, setRows]       = useState([])
  const [month, setMonth]     = useState(currentMonth())
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSettlement() }, [month])

  async function fetchSettlement() {
    setLoading(true)
    const from = month + '-01'
    const to   = lastDayOfMonth(month)

    let q = supabase
      .from('v_monthly_settlement')
      .select('*')
      .gte('settlement_month', from)
      .lte('settlement_month', to)
      .order('branch_name')

    if (!isOwner) q = q.eq('branch_name', branchName)

    const { data } = await q
    setRows(data ?? [])
    setLoading(false)
  }

  // 지점별 그루핑
  const byBranch = {}
  rows.forEach(r => {
    if (!byBranch[r.branch_name]) byBranch[r.branch_name] = []
    byBranch[r.branch_name].push(r)
  })

  const grandTotal = rows.reduce((s, r) => s + r.total_amount, 0)

  return (
    <div className="page">
      <div className="top-bar">
        <h1>{isOwner ? '월말 정산' : '정산 내역'}</h1>
        {isOwner && (
          <button
            className="btn"
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={() => exportSettlement(rows, month)}
            disabled={rows.length === 0}
          >
            엑셀
          </button>
        )}
      </div>

      {/* 월 선택 */}
      <div className="card" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>정산 월</label>
          <input
            className="form-input"
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
        </div>
      </div>

      {/* 총합 (사장만) */}
      {isOwner && (
        <div className="metric-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="metric-card">
            <div className="label">전체 출고금액</div>
            <div className="value">{Math.round(grandTotal / 10000)}<span className="unit">만원</span></div>
          </div>
          <div className="metric-card">
            <div className="label">정산 지점</div>
            <div className="value">{Object.keys(byBranch).length}<span className="unit">곳</span></div>
          </div>
        </div>
      )}

      {loading && <div className="loading">로딩 중...</div>}
      {!loading && rows.length === 0 && <div className="empty">{month} 출고 내역이 없습니다</div>}

      {Object.entries(byBranch).map(([branch, items]) => {
        const branchTotal = items.reduce((s, r) => s + r.total_amount, 0)
        return (
          <div key={branch} style={{ marginBottom: '20px' }}>
            <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{branch}</span>
              <span style={{ color: 'var(--text)' }}>합계 {Math.round(branchTotal).toLocaleString()}원</span>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: 'var(--text2)', borderBottom: '0.5px solid var(--border)' }}>품목</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: 'var(--text2)', borderBottom: '0.5px solid var(--border)' }}>수량</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: 'var(--text2)', borderBottom: '0.5px solid var(--border)' }}>단가</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500, color: 'var(--text2)', borderBottom: '0.5px solid var(--border)' }}>금액</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '0.5px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px' }}>{row.product_name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{row.total_qty}{row.unit}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text2)' }}>{row.unit_sell_price?.toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>{Math.round(row.total_amount).toLocaleString()}</td>
                    </tr>
                  ))}
                  {/* 소계 */}
                  <tr style={{ background: 'var(--bg2)' }}>
                    <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 600 }}>합계</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>
                      {Math.round(branchTotal).toLocaleString()}원
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 점장 뷰: 입금 안내 */}
            {!isOwner && (
              <div className="alert alert-warning" style={{ marginTop: '8px' }}>
                위 금액을 {month.replace('-', '년 ')}월 말일까지 본사로 입금해주세요
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function lastDayOfMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  return new Date(y, m, 0).toISOString().slice(0, 10)
}
