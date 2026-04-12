import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../supabaseClient'
import * as XLSX from 'xlsx'

const STATUS_LABEL = { draft: '미확정', confirmed: '확정됨', paid: '입금완료' }
const STATUS_BADGE = { draft: 'badge-pending', confirmed: 'badge-approved', paid: 'badge-shipped' }

export default function Settlement() {
  const { profile, role, branchId, branchName } = useAuth()
  const isOwner = role === 'owner'

  const [month, setMonth]           = useState(currentMonth())
  const [headers, setHeaders]       = useState([])   // settlement_headers
  const [preview, setPreview]       = useState({})   // 미확정 미리보기 {branchId: [{...}]}
  const [loading, setLoading]       = useState(true)
  const [confirming, setConfirming] = useState(null) // 확정 중인 branchId
  const [detail, setDetail]         = useState(null) // 상세 보기 {header, items}

  useEffect(() => { fetch() }, [month])

  async function fetch() {
    setLoading(true)
    const monthDate = month + '-01'

    if (isOwner) {
      // 확정된 정산 헤더 조회
      const { data: hdrs } = await supabase
        .from('settlement_headers')
        .select('*, branches(name)')
        .eq('settlement_month', monthDate)
        .order('created_at')
      setHeaders(hdrs ?? [])

      // 확정 안 된 지점들의 미리보기 (v_monthly_settlement)
      const { data: prev } = await supabase
        .from('v_monthly_settlement')
        .select('*')
        .gte('settlement_month', monthDate)
        .lt('settlement_month', nextMonthDate(month))

      const grouped = {}
      prev?.forEach(r => {
        if (!grouped[r.branch_name]) grouped[r.branch_name] = []
        grouped[r.branch_name].push(r)
      })
      setPreview(grouped)
    } else {
      // 점장: 내 지점 헤더
      const { data: hdrs } = await supabase
        .from('settlement_headers')
        .select('*, branches(name)')
        .eq('branch_id', branchId)
        .eq('settlement_month', monthDate)
      setHeaders(hdrs ?? [])

      if (!hdrs?.length) {
        // 미확정이면 미리보기
        const { data: prev } = await supabase
          .from('v_monthly_settlement')
          .select('*')
          .gte('settlement_month', monthDate)
          .lt('settlement_month', nextMonthDate(month))
          .eq('branch_name', branchName)
        setPreview({ [branchName]: prev ?? [] })
      }
    }
    setLoading(false)
  }

  async function openDetail(header) {
    const { data: items } = await supabase
      .from('settlements')
      .select('*')
      .eq('branch_id', header.branch_id)
      .eq('settlement_month', header.settlement_month)
    setDetail({ header, items: items ?? [] })
  }

  async function confirmSettlement(branchId) {
    setConfirming(branchId)
    const { data, error } = await supabase.rpc('confirm_settlement', {
      p_branch_id:    branchId,
      p_month:        month,
      p_confirmed_by: profile.id,
    })
    setConfirming(null)
    if (error) { alert('정산 확정 실패: ' + error.message); return }
    alert(`정산 확정 완료\n총액: ${data.total_amount?.toLocaleString()}원\n품목: ${data.item_count}건`)
    fetch()
  }

  async function markPaid(header) {
    const memo = prompt('입금 메모 (선택사항):')
    if (memo === null) return
    const { error } = await supabase.rpc('mark_settlement_paid', {
      p_branch_id: header.branch_id,
      p_month:     month,
      p_paid_by:   profile.id,
      p_memo:      memo || null,
    })
    if (error) { alert('처리 실패: ' + error.message); return }
    fetch()
    setDetail(null)
  }

  async function cancelSettlement(header) {
    if (header.status === 'paid') {
      alert('입금 완료된 정산은 취소할 수 없습니다')
      return
    }
    if (!confirm(`${header.branches?.name} ${month} 정산을 취소하시겠습니까?\n취소 후 재확정할 수 있습니다.`)) return

    const { error } = await supabase.rpc('cancel_settlement', {
      p_branch_id:    header.branch_id,
      p_month:        month,
      p_cancelled_by: profile.id,
    })
    if (error) { alert('취소 실패: ' + error.message); return }
    alert('정산이 취소됐습니다. 내역 수정 후 재확정해주세요.')
    setDetail(null)
    fetch()
  }

  function exportExcel(header, items) {
    const wb = XLSX.utils.book_new()
    const rows = items.map(r => ({
      '품목':     r.product_name,
      '단위':     r.unit,
      '수량':     r.total_qty,
      '단가(원)': r.unit_sell_price,
      '금액(원)': r.total_amount,
    }))
    rows.push({ '품목': '합계', '단위': '', '수량': '', '단가(원)': '', '금액(원)': header.total_amount })
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, header.branches?.name ?? '정산')
    XLSX.writeFile(wb, `겹겹_정산_${header.branches?.name}_${month}.xlsx`)
  }

  // ── 상세 바텀시트 ──────────────────────────────────────────
  if (detail) {
    const { header, items } = detail
    return (
      <div className="page">
        <div className="top-bar">
          <div>
            <h1>{header.branches?.name}</h1>
            <div className="sub">{month} 정산 상세</div>
          </div>
          <button className="btn" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setDetail(null)}>
            뒤로
          </button>
        </div>

        {/* 상태 + 총액 */}
        <div className="card" style={{ marginBottom: '14px' }}>
          <div className="card-row" style={{ marginBottom: '10px' }}>
            <span className={`badge ${STATUS_BADGE[header.status]}`}>
              {STATUS_LABEL[header.status]}
            </span>
            {isOwner && header.status === 'confirmed' && (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-approve" style={{ fontSize: '12px', padding: '5px 12px' }}
                  onClick={() => markPaid(header)}>
                  입금 확인
                </button>
              </div>
            )}
            {isOwner && header.status === 'paid' && (
              <span style={{ fontSize: '12px', color: 'var(--green-tx)' }}>완료</span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div className="metric-card">
              <div className="label">총 정산금액</div>
              <div className="value" style={{ fontSize: '18px' }}>
                {Math.round(header.total_amount).toLocaleString()}
                <span className="unit">원</span>
              </div>
            </div>
            <div className="metric-card">
              <div className="label">확정일</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginTop: '4px' }}>
                {header.confirmed_at
                  ? new Date(header.confirmed_at).toLocaleDateString('ko-KR')
                  : '-'}
              </div>
            </div>
          </div>
          {header.status === 'paid' && (
            <div className="alert alert-success" style={{ marginTop: '10px', marginBottom: 0 }}>
              입금 완료 — {header.paid_at ? new Date(header.paid_at).toLocaleDateString('ko-KR') : ''}
              {header.paid_memo && ` · ${header.paid_memo}`}
            </div>
          )}
        </div>

        {/* 품목 상세 */}
        <div className="section-label">품목별 내역</div>
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '14px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--cream-2)' }}>
                {['품목', '수량', '단가', '금액'].map(h => (
                  <th key={h} style={{
                    padding: '9px 12px', fontWeight: 500, color: 'var(--text3)',
                    borderBottom: '0.5px solid var(--cream-border)',
                    textAlign: h === '품목' ? 'left' : 'right', fontSize: '11px',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} style={{ borderBottom: '0.5px solid var(--cream-border)' }}>
                  <td style={{ padding: '9px 12px' }}>{item.product_name}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text2)' }}>
                    {item.total_qty}{item.unit}
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', color: 'var(--text3)', fontSize: '12px' }}>
                    {item.unit_sell_price?.toLocaleString()}원
                  </td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 500 }}>
                    {Math.round(item.total_amount).toLocaleString()}원
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--cream-2)' }}>
                <td colSpan={3} style={{ padding: '10px 12px', fontWeight: 600, fontSize: '13px' }}>합계</td>
                <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: '15px', color: 'var(--burgundy)' }}>
                  {Math.round(header.total_amount).toLocaleString()}원
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <button className="btn btn-full" style={{ fontSize: '13px' }}
            onClick={() => exportExcel(header, items)}>
            엑셀 다운로드
          </button>
          {isOwner && header.status === 'confirmed' && (
            <button className="btn btn-danger btn-full" style={{ fontSize: '13px' }}
              onClick={() => cancelSettlement(header)}>
              정산 취소
            </button>
          )}
        </div>

        {!isOwner && header.status === 'confirmed' && (
          <div className="alert alert-warning" style={{ marginTop: '12px' }}>
            위 금액을 {month.replace('-', '년 ')}월 말일까지 본사로 입금해주세요
          </div>
        )}
      </div>
    )
  }

  // ── 메인 정산 목록 ─────────────────────────────────────────
  const grandTotal = headers.reduce((s, h) => s + (h.total_amount ?? 0), 0)
  const confirmedBranchIds = new Set(headers.map(h => h.branch_id))

  return (
    <div className="page">
      <div className="top-bar">
        <h1>{isOwner ? '월말 정산' : '정산 내역'}</h1>
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

      {loading && <div className="loading">로딩 중...</div>}

      {/* 사장 — 전체 지점 요약 */}
      {isOwner && headers.length > 0 && (
        <div className="metric-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '14px' }}>
          <div className="metric-card">
            <div className="label">총 확정금액</div>
            <div className="value" style={{ fontSize: '18px' }}>
              {Math.round(grandTotal / 10000).toLocaleString()}
              <span className="unit">만원</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="label">입금완료</div>
            <div className="value" style={{ fontSize: '20px' }}>
              {headers.filter(h => h.status === 'paid').length}
              <span className="unit"> / {headers.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* 확정된 정산 목록 */}
      {headers.length > 0 && (
        <>
          <div className="section-label">확정된 정산</div>
          {headers.map(header => (
            <div key={header.id} className="card" style={{ marginBottom: '8px', cursor: 'pointer' }}
              onClick={() => openDetail(header)}>
              <div className="card-row" style={{ marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600 }}>{header.branches?.name}</span>
                  <span className={`badge ${STATUS_BADGE[header.status]}`}>
                    {STATUS_LABEL[header.status]}
                  </span>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--burgundy)' }}>
                  {Math.round(header.total_amount).toLocaleString()}원
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)' }}>
                확정 {header.confirmed_at ? new Date(header.confirmed_at).toLocaleDateString('ko-KR') : '-'}
                {header.status === 'paid' && header.paid_at &&
                  ` · 입금 ${new Date(header.paid_at).toLocaleDateString('ko-KR')}`}
              </div>
            </div>
          ))}
        </>
      )}

      {/* 사장 — 미확정 지점 미리보기 + 확정 버튼 */}
      {isOwner && Object.entries(preview).filter(([branch]) => {
        // 이미 확정된 지점은 제외
        return !headers.find(h => h.branches?.name === branch)
      }).map(([branch, items]) => {
        const total = items.reduce((s, r) => s + r.total_amount, 0)
        const brId = items[0]?.branch_id  // v_monthly_settlement에 branch_id가 없으므로 branches 테이블에서 가져와야 함
        return (
          <div key={branch}>
            <div className="section-label">{branch} — 미확정 미리보기</div>
            <div className="card" style={{ marginBottom: '8px' }}>
              <div className="card-row" style={{ marginBottom: '10px' }}>
                <span className="badge badge-pending">미확정</span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text2)' }}>
                  {Math.round(total).toLocaleString()}원
                </span>
              </div>
              {items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: '13px', borderBottom: '0.5px solid var(--cream-border)' }}>
                  <span>{item.product_name}</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 500 }}>{Math.round(item.total_amount).toLocaleString()}원</span>
                    <span style={{ color: 'var(--text3)', fontSize: '11px', marginLeft: '6px' }}>
                      {item.total_qty}{item.unit}
                    </span>
                  </div>
                </div>
              ))}
              <ConfirmButton branch={branch} month={month} profile={profile} onDone={fetch} />
            </div>
          </div>
        )
      })}

      {/* 점장 — 미확정 상태 */}
      {!isOwner && headers.length === 0 && preview[branchName]?.length > 0 && (
        <>
          <div className="section-label">이번달 출고 내역 (미확정)</div>
          <div className="alert alert-info">
            본사에서 정산을 확정하면 여기에 금액이 고정됩니다
          </div>
          <div className="card">
            {preview[branchName].map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '13px', borderBottom: '0.5px solid var(--cream-border)' }}>
                <span>{item.product_name}</span>
                <span style={{ fontWeight: 500 }}>{Math.round(item.total_amount).toLocaleString()}원</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 0', fontSize: '14px', fontWeight: 600 }}>
              <span>예상 합계</span>
              <span style={{ color: 'var(--burgundy)' }}>
                {Math.round(preview[branchName].reduce((s, r) => s + r.total_amount, 0)).toLocaleString()}원
              </span>
            </div>
          </div>
        </>
      )}

      {!loading && headers.length === 0 && Object.keys(preview).length === 0 && (
        <div className="empty">{month} 정산 내역이 없습니다</div>
      )}
    </div>
  )
}

// 확정 버튼 — branch 이름으로 branch_id를 조회해서 RPC 호출
function ConfirmButton({ branch, month, profile, onDone }) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    if (!confirm(`${branch} ${month} 정산을 확정하시겠습니까?\n확정 후에는 금액이 고정됩니다.`)) return
    setLoading(true)

    const { data: br } = await supabase
      .from('branches').select('id').eq('name', branch).single()
    if (!br) { alert('지점 정보를 찾을 수 없습니다'); setLoading(false); return }

    const { data, error } = await supabase.rpc('confirm_settlement', {
      p_branch_id:    br.id,
      p_month:        month,
      p_confirmed_by: profile.id,
    })
    setLoading(false)
    if (error) { alert('확정 실패: ' + error.message); return }
    alert(`✓ 정산 확정 완료\n총액: ${data.total_amount?.toLocaleString()}원`)
    onDone()
  }

  return (
    <button
      className="btn btn-primary btn-full"
      style={{ marginTop: '12px', fontSize: '14px' }}
      disabled={loading}
      onClick={handleConfirm}
    >
      {loading ? '확정 중...' : '이 지점 정산 확정'}
    </button>
  )
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonthDate(monthStr) {
  const [y, m] = monthStr.split('-').map(Number)
  const next = new Date(y, m, 1)
  return next.toISOString().slice(0, 10)
}
