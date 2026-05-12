import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../supabaseClient'

const BRAND_LABEL = { gyeobgyeob: '겹겹', jeokdon: '적돈' }

export default function ReceivingStep1() {
  const { profile } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts]   = useState([])
  const [form, setForm] = useState({
    supplier_id:         '',
    product_id:          '',
    brand:               'gyeobgyeob',
    purchase_date:       today(),
    raw_weight_kg:       '',
    unit_price:          '',
    processed_weight_kg: '',  // 적돈 즉시등록용
    memo:                '',
  })
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [recent, setRecent]   = useState([])

  useEffect(() => {
    supabase.from('suppliers').select('id, name').eq('is_active', true)
      .then(({ data }) => setSuppliers(data ?? []))
    supabase.from('products').select('id, name, requires_processing, margin_rate').eq('is_active', true)
      .then(({ data }) => setProducts(data ?? []))
    fetchRecent()
  }, [])

  async function fetchRecent() {
    const { data } = await supabase
      .from('purchases')
      .select('*, suppliers(name), products(name)')
      .order('created_at', { ascending: false })
      .limit(5)
    setRecent(data ?? [])
  }

  function set(key, val) {
    setForm(f => {
      const next = { ...f, [key]: val }
      // 브랜드 변경 시 즉시등록 중량 초기화
      if (key === 'brand') next.processed_weight_kg = ''
      return next
    })
  }

  const selectedProduct = products.find(p => p.id === form.product_id)
  const isJeokdon       = form.brand === 'jeokdon'

  // 적돈: 즉시 가공 완료 처리 여부 (처리후중량이 입력된 경우)
  const jeokdonImmediate = isJeokdon && parseFloat(form.processed_weight_kg) > 0

  const rawWeight    = parseFloat(form.raw_weight_kg) || 0
  const unitPrice    = parseInt(form.unit_price) || 0
  const totalAmount  = rawWeight > 0 && unitPrice > 0 ? Math.round(rawWeight * unitPrice) : 0
  const finalW       = parseFloat(form.processed_weight_kg) || 0
  const marginRate   = selectedProduct?.margin_rate ?? 0
  const effectivePrice = finalW > 0 && totalAmount > 0 ? Math.round(totalAmount / finalW) : 0
  const sellPrice    = effectivePrice > 0 ? Math.round(effectivePrice * (1 + marginRate)) : 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.supplier_id || !form.product_id) return alert('거래처와 품목을 선택하세요')
    if (jeokdonImmediate && finalW > rawWeight) {
      return alert('가공 후 중량이 원물 무게보다 클 수 없습니다')
    }
    setSaving(true)

    const { data: purchase, error } = await supabase
      .from('purchases')
      .insert({
        supplier_id:   form.supplier_id,
        product_id:    form.product_id,
        brand:         form.brand,
        purchase_date: form.purchase_date,
        raw_weight_kg: rawWeight,
        unit_price:    unitPrice,
        memo:          form.memo || null,
        created_by:    profile.id,
      })
      .select()
      .single()

    if (error) { alert('저장 실패: ' + error.message); setSaving(false); return }

    // 겹겹: 숙성 필요 시 processing, 아니면 available
    // 적돈: 즉시 가공 완료 입력 시 available, 아니면 processing (같은 날 Step2)
    const requiresProcessing = isJeokdon
      ? !jeokdonImmediate
      : (selectedProduct?.requires_processing ?? true)

    await supabase.from('inventory_batches').insert({
      purchase_id:          purchase.id,
      product_id:           form.product_id,
      brand:                form.brand,
      batch_code:           '',  // 트리거 자동생성
      processed_date:       jeokdonImmediate ? form.purchase_date : form.purchase_date,
      raw_weight_kg:        rawWeight,
      initial_weight_kg:    jeokdonImmediate ? finalW : (requiresProcessing ? 0 : rawWeight),
      remaining_weight_kg:  jeokdonImmediate ? finalW : (requiresProcessing ? 0 : rawWeight),
      effective_unit_price: jeokdonImmediate ? effectivePrice : (requiresProcessing ? 0 : unitPrice),
      sell_price:           jeokdonImmediate ? sellPrice : (requiresProcessing ? 0 : unitPrice),
      status:               requiresProcessing ? 'processing' : 'available',
      created_by:           profile.id,
    })

    setSuccess(true)
    setForm({
      supplier_id: '', product_id: '', brand: form.brand,
      purchase_date: today(), raw_weight_kg: '', unit_price: '',
      processed_weight_kg: '', memo: '',
    })
    fetchRecent()
    setTimeout(() => setSuccess(false), 3000)
    setSaving(false)
  }

  const successMsg = jeokdonImmediate
    ? '등록 완료! 즉시 재고에 반영됐습니다.'
    : isJeokdon
      ? '등록 완료! 가공완료 탭에서 처리 중량을 입력해주세요.'
      : '등록 완료! 가공완료 탭에서 숙성 후 중량을 입력해주세요.'

  return (
    <div className="page">
      <div className="top-bar"><h1>매입 등록</h1></div>

      {/* 브랜드 안내 */}
      <div className={`alert ${isJeokdon ? 'alert-warning' : 'alert-info'}`}>
        {isJeokdon
          ? '적돈: 원물 → 컷팅/진공포장 → 즉시 출고 가능. 가공 후 중량을 바로 입력하면 재고에 즉시 반영됩니다.'
          : '겹겹: 원물 → 건조 숙성 → 가공완료 탭에서 최종 중량 입력 후 재고 반영됩니다.'}
      </div>

      {success && <div className="alert alert-success">{successMsg}</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>

          {/* 브랜드 선택 */}
          <div className="form-group">
            <label className="form-label">브랜드</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['gyeobgyeob', 'jeokdon'].map(b => (
                <button
                  key={b}
                  type="button"
                  className="btn"
                  style={{
                    flex: 1, padding: '10px',
                    background:  form.brand === b ? 'var(--burgundy)' : '',
                    color:       form.brand === b ? 'var(--cream-2)'  : '',
                    borderColor: form.brand === b ? 'var(--burgundy-dark)' : '',
                  }}
                  onClick={() => set('brand', b)}
                >
                  {BRAND_LABEL[b]}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">거래처</label>
            <select className="form-input" value={form.supplier_id} onChange={e => set('supplier_id', e.target.value)} required>
              <option value="">선택하세요</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">품목</label>
            <select className="form-input" value={form.product_id} onChange={e => set('product_id', e.target.value)} required>
              <option value="">선택하세요</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">구매일</label>
              <input className="form-input" type="date" value={form.purchase_date} onChange={e => set('purchase_date', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">원물 무게 (kg)</label>
              <input className="form-input" type="number" step="0.1" min="0" placeholder="10.0" value={form.raw_weight_kg} onChange={e => set('raw_weight_kg', e.target.value)} required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">매입단가 (원/kg)</label>
            <input className="form-input" type="number" min="0" placeholder="15000" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} required />
          </div>

          {totalAmount > 0 && (
            <div className="alert alert-info" style={{ marginBottom: '12px' }}>
              총 매입금액: <strong>{totalAmount.toLocaleString()}원</strong>
            </div>
          )}

          {/* 적돈: 즉시 가공 후 중량 입력 */}
          {isJeokdon && (
            <div className="form-group">
              <label className="form-label">
                가공 후 중량 (kg)
                <span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '6px', fontWeight: 400 }}>
                  비우면 Step 2에서 별도 입력
                </span>
              </label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                max={rawWeight || undefined}
                placeholder={rawWeight > 0 ? `최대 ${rawWeight}kg` : '컷팅 후 실측 무게'}
                value={form.processed_weight_kg}
                onChange={e => set('processed_weight_kg', e.target.value)}
              />
              {jeokdonImmediate && effectivePrice > 0 && (
                <div style={{ marginTop: '8px', background: 'var(--bg2)', borderRadius: 'var(--r-md)', padding: '10px', fontSize: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <div><span style={{ color: 'var(--text3)' }}>손실률 </span><span style={{ fontWeight: 500 }}>{rawWeight > 0 ? ((rawWeight - finalW) / rawWeight * 100).toFixed(1) : '-'}%</span></div>
                    <div><span style={{ color: 'var(--text3)' }}>실효단가 </span><span style={{ fontWeight: 500 }}>{effectivePrice.toLocaleString()}원/kg</span></div>
                    <div><span style={{ color: 'var(--text3)' }}>마진 </span><span style={{ fontWeight: 500 }}>{Math.round(marginRate * 100)}%</span></div>
                    <div><span style={{ color: 'var(--text3)' }}>출고단가 </span><span style={{ fontWeight: 600, color: 'var(--green)' }}>{sellPrice.toLocaleString()}원/kg</span></div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">메모 (선택)</label>
            <input className="form-input" type="text" placeholder="특이사항" value={form.memo} onChange={e => set('memo', e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
            {saving ? '저장 중...' : jeokdonImmediate ? '매입 등록 (즉시 재고 반영)' : '매입 등록'}
          </button>
        </form>
      </div>

      {recent.length > 0 && (
        <>
          <div className="section-label">최근 등록</div>
          {recent.map(r => (
            <div key={r.id} className="card" style={{ marginBottom: '6px' }}>
              <div className="card-row">
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{r.products?.name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text3)', marginLeft: '8px' }}>{r.suppliers?.name}</span>
                  {r.brand && (
                    <span style={{ fontSize: '10px', marginLeft: '6px', background: 'var(--bg3)', padding: '1px 5px', borderRadius: '8px' }}>
                      {BRAND_LABEL[r.brand] ?? r.brand}
                    </span>
                  )}
                </div>
                <span style={{ fontSize: '13px', color: 'var(--text2)' }}>{r.raw_weight_kg}kg</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text3)', marginTop: '3px' }}>
                {r.purchase_date} · {r.total_amount?.toLocaleString()}원
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
