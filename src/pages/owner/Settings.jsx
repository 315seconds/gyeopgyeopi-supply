import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'

const BRAND_LABEL = { gyeobgyeob: '겹겹', jeokdon: '적돈' }
const ORDER_UNITS = ['kg', '개', '박스', '봉', '병', 'g']

export default function Settings() {
  const [tab, setTab] = useState('suppliers')

  return (
    <div className="page">
      <div className="top-bar"><h1>설정</h1></div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {[
          { key: 'suppliers', label: '거래처 관리' },
          { key: 'products',  label: '상품 관리' },
          { key: 'branches',  label: '지점 관리' },
        ].map(t => (
          <button
            key={t.key}
            className="btn"
            style={{
              flex: 1, fontSize: '13px', padding: '9px',
              background:   tab === t.key ? 'var(--burgundy)' : '',
              color:        tab === t.key ? 'var(--cream-2)'  : '',
              borderColor:  tab === t.key ? 'var(--burgundy-dark)' : '',
            }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'suppliers' && <SuppliersPanel />}
      {tab === 'products'  && <ProductsPanel />}
      {tab === 'branches'  && <BranchesPanel />}
    </div>
  )
}

/* ── 지점 관리 ──────────────────────────────────────────── */
function BranchesPanel() {
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(null)

  useEffect(() => { fetchList() }, [])

  async function fetchList() {
    setLoading(true)
    const { data } = await supabase.from('branches').select('*').order('name')
    setList(data ?? [])
    setLoading(false)
  }

  async function setBrand(branchId, brand) {
    setSaving(branchId)
    const { error } = await supabase.from('branches').update({ brand }).eq('id', branchId)
    if (error) { alert('저장 실패: ' + error.message) }
    setSaving(null)
    fetchList()
  }

  if (loading) return <div className="loading">로딩 중...</div>

  return (
    <>
      <div className="alert alert-info">
        지점별 브랜드를 설정하면 해당 브랜드의 재고만 출고에 사용됩니다.<br />
        겹겹: 건조 숙성 재고 / 적돈: 즉시 출고 재고
      </div>

      {list.map(branch => (
        <div key={branch.id} className="card" style={{ marginBottom: '10px' }}>
          <div className="card-row" style={{ marginBottom: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: 600 }}>{branch.name}</span>
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>
              현재: {BRAND_LABEL[branch.brand] ?? branch.brand ?? '-'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['gyeobgyeob', 'jeokdon'].map(b => (
              <button
                key={b}
                className="btn btn-full"
                style={{
                  fontSize: '13px', padding: '9px',
                  background:   branch.brand === b ? 'var(--burgundy)' : '',
                  color:        branch.brand === b ? 'var(--cream-2)'  : '',
                  borderColor:  branch.brand === b ? 'var(--burgundy-dark)' : '',
                  opacity:      saving === branch.id ? 0.6 : 1,
                }}
                disabled={saving === branch.id}
                onClick={() => setBrand(branch.id, b)}
              >
                {BRAND_LABEL[b]}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

/* ── 거래처 관리 ──────────────────────────────────────────── */
function SuppliersPanel() {
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  useEffect(() => { fetchList() }, [])

  async function fetchList() {
    setLoading(true)
    const { data } = await supabase
      .from('suppliers')
      .select('*')
      .order('category')
      .order('name')
    setList(data ?? [])
    setLoading(false)
  }

  async function save(form) {
    if (form.id) {
      const { error } = await supabase
        .from('suppliers')
        .update({ name: form.name, category: form.category, contact: form.contact || null, memo: form.memo || null })
        .eq('id', form.id)
      if (error) { alert('저장 실패: ' + error.message); return }
    } else {
      const { error } = await supabase
        .from('suppliers')
        .insert({ name: form.name, category: form.category, contact: form.contact || null, memo: form.memo || null })
      if (error) { alert('저장 실패: ' + error.message); return }
    }
    setEditing(null)
    fetchList()
  }

  async function toggleActive(item) {
    const next = !item.is_active
    if (!confirm(`${item.name}을 ${next ? '활성화' : '비활성화'}하시겠습니까?`)) return
    await supabase.from('suppliers').update({ is_active: next }).eq('id', item.id)
    fetchList()
  }

  async function deleteSupplier(item) {
    if (!confirm(`${item.name}을 삭제하시겠습니까?\n매입 기록이 있으면 삭제되지 않습니다.`)) return
    const { error } = await supabase.from('suppliers').delete().eq('id', item.id)
    if (error) {
      alert('삭제 실패 — 이 거래처의 매입 기록이 있어 삭제할 수 없습니다.\n비활성화를 사용해주세요.')
      return
    }
    fetchList()
  }

  if (editing !== null) {
    return (
      <SupplierForm
        initial={editing === 'new' ? null : editing}
        onSave={save}
        onCancel={() => setEditing(null)}
      />
    )
  }

  const active   = list.filter(s => s.is_active)
  const inactive = list.filter(s => !s.is_active)

  return (
    <>
      <button className="btn btn-primary btn-full" style={{ marginBottom: '16px' }}
        onClick={() => setEditing('new')}>
        + 거래처 추가
      </button>

      {loading && <div className="loading">로딩 중...</div>}

      {active.length > 0 && (
        <>
          <div className="section-label">사용 중</div>
          {active.map(s => (
            <SupplierCard key={s.id} item={s}
              onEdit={() => setEditing(s)}
              onToggle={() => toggleActive(s)}
              onDelete={() => deleteSupplier(s)}
            />
          ))}
        </>
      )}

      {inactive.length > 0 && (
        <>
          <div className="section-label">비활성화됨</div>
          {inactive.map(s => (
            <SupplierCard key={s.id} item={s}
              onEdit={() => setEditing(s)}
              onToggle={() => toggleActive(s)}
              onDelete={() => deleteSupplier(s)}
            />
          ))}
        </>
      )}
    </>
  )
}

function SupplierCard({ item, onEdit, onToggle, onDelete }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ marginBottom: '8px', opacity: item.is_active ? 1 : 0.5 }}>
      <div className="card-row" style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.name}</span>
            <span className={`badge ${item.category === 'meat' ? 'badge-danger' : 'badge-approved'}`}>
              {item.category === 'meat' ? '고기' : '기타'}
            </span>
          </div>
          {item.contact && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '3px' }}>{item.contact}</div>
          )}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {open && (
        <>
          <div className="divider" />
          {item.memo && (
            <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '10px' }}>{item.memo}</div>
          )}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-full" style={{ fontSize: '13px' }} onClick={onEdit}>수정</button>
            <button className="btn btn-full" style={{ fontSize: '13px', color: 'var(--amber-tx)', borderColor: 'var(--amber-border)' }}
              onClick={onToggle}>
              {item.is_active ? '비활성화' : '활성화'}
            </button>
            {!item.is_active && (
              <button className="btn btn-danger" style={{ fontSize: '13px', flexShrink: 0 }} onClick={onDelete}>삭제</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SupplierForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    id:       initial?.id       ?? null,
    name:     initial?.name     ?? '',
    category: initial?.category ?? 'meat',
    contact:  initial?.contact  ?? '',
    memo:     initial?.memo     ?? '',
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <div className="card">
      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>
        {initial ? '거래처 수정' : '거래처 추가'}
      </div>

      <div className="form-group">
        <label className="form-label">거래처명 *</label>
        <input className="form-input" value={form.name}
          onChange={e => set('name', e.target.value)} placeholder="예: 진주축산" />
      </div>

      <div className="form-group">
        <label className="form-label">분류</label>
        <select className="form-input" value={form.category} onChange={e => set('category', e.target.value)}>
          <option value="meat">고기</option>
          <option value="other">기타 식재료</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">연락처</label>
        <input className="form-input" value={form.contact}
          onChange={e => set('contact', e.target.value)} placeholder="전화번호 또는 담당자명" />
      </div>

      <div className="form-group">
        <label className="form-label">메모</label>
        <input className="form-input" value={form.memo}
          onChange={e => set('memo', e.target.value)} placeholder="특이사항" />
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary btn-full"
          disabled={!form.name.trim()}
          onClick={() => onSave(form)}>
          저장
        </button>
        <button className="btn btn-full" onClick={onCancel}>취소</button>
      </div>
    </div>
  )
}

/* ── 상품 관리 ──────────────────────────────────────────── */
function ProductsPanel() {
  const [list, setList]       = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)

  useEffect(() => { fetchList() }, [])

  async function fetchList() {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('category')
      .order('name')
    setList(data ?? [])
    setLoading(false)
  }

  async function save(form) {
    const payload = {
      name:                form.name,
      category:            form.category,
      unit:                form.unit,
      order_unit:          form.order_unit,
      approx_kg_per_unit:  form.order_unit !== 'kg' && form.approx_kg_per_unit
                             ? parseFloat(form.approx_kg_per_unit)
                             : null,
      margin_rate:         parseFloat(form.margin_rate) / 100 || null,
      requires_processing: form.requires_processing,
    }
    if (form.id) {
      const { error } = await supabase.from('products').update(payload).eq('id', form.id)
      if (error) { alert('저장 실패: ' + error.message); return }
    } else {
      const { error } = await supabase.from('products').insert(payload)
      if (error) { alert('저장 실패: ' + error.message); return }
    }
    setEditing(null)
    fetchList()
  }

  async function toggleActive(item) {
    if (!confirm(`${item.name}을 ${item.is_active ? '비활성화' : '활성화'}하시겠습니까?`)) return
    await supabase.from('products').update({ is_active: !item.is_active }).eq('id', item.id)
    fetchList()
  }

  async function deleteProduct(item) {
    if (!confirm(`${item.name}을 삭제하시겠습니까?\n주문/재고 기록이 있으면 삭제되지 않습니다.`)) return
    const { error } = await supabase.from('products').delete().eq('id', item.id)
    if (error) {
      alert('삭제 불가 — 이 상품의 주문 또는 재고 기록이 있습니다.\n비활성화를 사용해주세요.')
      return
    }
    fetchList()
  }

  if (editing !== null) {
    return (
      <ProductForm
        initial={editing === 'new' ? null : editing}
        onSave={save}
        onCancel={() => setEditing(null)}
      />
    )
  }

  const meat  = list.filter(p => p.category === 'meat' && p.is_active)
  const other = list.filter(p => p.category === 'other' && p.is_active)
  const inact = list.filter(p => !p.is_active)

  return (
    <>
      <button className="btn btn-primary btn-full" style={{ marginBottom: '16px' }}
        onClick={() => setEditing('new')}>
        + 상품 추가
      </button>

      {loading && <div className="loading">로딩 중...</div>}

      {meat.length > 0 && (
        <>
          <div className="section-label">고기 품목</div>
          {meat.map(p => (
            <ProductCard key={p.id} item={p}
              onEdit={() => setEditing(p)}
              onToggle={() => toggleActive(p)}
              onDelete={() => deleteProduct(p)}
            />
          ))}
        </>
      )}

      {other.length > 0 && (
        <>
          <div className="section-label">기타 식재료</div>
          {other.map(p => (
            <ProductCard key={p.id} item={p}
              onEdit={() => setEditing(p)}
              onToggle={() => toggleActive(p)}
              onDelete={() => deleteProduct(p)}
            />
          ))}
        </>
      )}

      {inact.length > 0 && (
        <>
          <div className="section-label">비활성화됨</div>
          {inact.map(p => (
            <ProductCard key={p.id} item={p}
              onEdit={() => setEditing(p)}
              onToggle={() => toggleActive(p)}
              onDelete={() => deleteProduct(p)}
            />
          ))}
        </>
      )}
    </>
  )
}

function ProductCard({ item, onEdit, onToggle, onDelete }) {
  const [open, setOpen] = useState(false)
  const marginPct  = item.margin_rate ? Math.round(item.margin_rate * 100) : null
  const orderUnit  = item.order_unit ?? item.unit
  const showApprox = orderUnit !== 'kg' && item.approx_kg_per_unit

  return (
    <div className="card" style={{ marginBottom: '8px', opacity: item.is_active ? 1 : 0.5 }}>
      <div className="card-row" style={{ cursor: 'pointer' }} onClick={() => setOpen(o => !o)}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '14px', fontWeight: 500 }}>{item.name}</span>
            {marginPct && (
              <span className="badge badge-warning">마진 {marginPct}%</span>
            )}
            {item.requires_processing && (
              <span className="badge badge-priority">숙성필요</span>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '3px' }}>
            재고단위 {item.unit}
            {orderUnit !== item.unit && ` · 주문단위 ${orderUnit}`}
            {showApprox && ` · 1${orderUnit}≈${item.approx_kg_per_unit}kg`}
          </div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>
          <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {open && (
        <>
          <div className="divider" />
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-full" style={{ fontSize: '13px' }} onClick={onEdit}>수정</button>
            <button className="btn btn-full" style={{ fontSize: '13px', color: 'var(--amber-tx)', borderColor: 'var(--amber-border)' }}
              onClick={onToggle}>
              {item.is_active ? '비활성화' : '활성화'}
            </button>
            {!item.is_active && (
              <button className="btn btn-danger" style={{ fontSize: '13px', flexShrink: 0 }} onClick={onDelete}>삭제</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function ProductForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    id:                   initial?.id                   ?? null,
    name:                 initial?.name                 ?? '',
    category:             initial?.category             ?? 'meat',
    unit:                 initial?.unit                 ?? 'kg',
    order_unit:           initial?.order_unit           ?? (initial?.unit ?? 'kg'),
    approx_kg_per_unit:   initial?.approx_kg_per_unit != null
                            ? String(initial.approx_kg_per_unit)
                            : '',
    margin_rate:          initial?.margin_rate != null
                            ? Math.round(initial.margin_rate * 100).toString()
                            : '',
    requires_processing:  initial?.requires_processing  ?? false,
  })

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  const isMeat          = form.category === 'meat'
  const isNonKgOrder    = form.order_unit !== 'kg'

  return (
    <div className="card">
      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px' }}>
        {initial ? '상품 수정' : '상품 추가'}
      </div>

      <div className="form-group">
        <label className="form-label">상품명 *</label>
        <input className="form-input" value={form.name}
          onChange={e => set('name', e.target.value)} placeholder="예: 목살" />
      </div>

      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">분류</label>
          <select className="form-input" value={form.category}
            onChange={e => set('category', e.target.value)}>
            <option value="meat">고기</option>
            <option value="other">기타</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">재고 단위</label>
          <select className="form-input" value={form.unit}
            onChange={e => set('unit', e.target.value)}>
            {ORDER_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
      </div>

      {/* 주문 단위 (점장이 주문 시 사용하는 단위) */}
      <div style={{ marginTop: '14px' }}>
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              주문 단위
              <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text3)', marginLeft: '4px' }}>
                점장 주문 시
              </span>
            </label>
            <select className="form-input" value={form.order_unit}
              onChange={e => set('order_unit', e.target.value)}>
              {ORDER_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {isNonKgOrder && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                1{form.order_unit}당 kg
                <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text3)', marginLeft: '4px' }}>
                  참고값
                </span>
              </label>
              <input className="form-input" type="number" step="0.01" min="0"
                value={form.approx_kg_per_unit}
                onChange={e => set('approx_kg_per_unit', e.target.value)}
                placeholder="예: 1.5" />
            </div>
          )}
        </div>
        {isNonKgOrder && (
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
            출고 시 스태프가 실제 무게를 직접 입력합니다
          </div>
        )}
      </div>

      {isMeat && (
        <div className="form-group" style={{ marginTop: '14px' }}>
          <label className="form-label">마진율 (%)</label>
          <input className="form-input" type="number" min="0" max="100" step="1"
            value={form.margin_rate}
            onChange={e => set('margin_rate', e.target.value)}
            placeholder="예: 13 (목살/삼겹) 또는 10 (나머지)" />
          <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
            목살·삼겹살 → 13, 항정·가브리·갈매기·배달 → 10
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '14px 0' }}>
        <input
          type="checkbox"
          id="req-processing"
          checked={form.requires_processing}
          onChange={e => set('requires_processing', e.target.checked)}
          style={{ width: '16px', height: '16px', accentColor: 'var(--burgundy)', cursor: 'pointer' }}
        />
        <label htmlFor="req-processing" style={{ fontSize: '13px', color: 'var(--text2)', cursor: 'pointer' }}>
          숙성·트리밍 가공 필요 (겹겹 브랜드용 고기류)
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary btn-full"
          disabled={!form.name.trim()}
          onClick={() => onSave(form)}>
          저장
        </button>
        <button className="btn btn-full" onClick={onCancel}>취소</button>
      </div>
    </div>
  )
}
