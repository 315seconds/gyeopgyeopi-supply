import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../supabaseClient'

export default function ReceivingStep1() {
  const { profile } = useAuth()
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts]   = useState([])
  const [form, setForm] = useState({
    supplier_id: '', product_id: '', purchase_date: today(),
    raw_weight_kg: '', unit_price: '', memo: '',
  })
  const [saving, setSaving]     = useState(false)
  const [success, setSuccess]   = useState(false)
  const [recent, setRecent]     = useState([])

  useEffect(() => {
    supabase.from('suppliers').select('id, name').eq('is_active', true).then(({ data }) => setSuppliers(data ?? []))
    supabase.from('products').select('id, name, requires_processing').eq('is_active', true).then(({ data }) => setProducts(data ?? []))
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
    setForm(f => ({ ...f, [key]: val }))
  }

  const totalAmount = form.raw_weight_kg && form.unit_price
    ? Math.round(parseFloat(form.raw_weight_kg) * parseInt(form.unit_price))
    : 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.supplier_id || !form.product_id) return alert('거래처와 품목을 선택하세요')
    setSaving(true)

    const { data: purchase, error } = await supabase
      .from('purchases')
      .insert({
        supplier_id:   form.supplier_id,
        product_id:    form.product_id,
        purchase_date: form.purchase_date,
        raw_weight_kg: parseFloat(form.raw_weight_kg),
        unit_price:    parseInt(form.unit_price),
        memo:          form.memo || null,
        created_by:    profile.id,
      })
      .select()
      .single()

    if (error) { alert('저장 실패: ' + error.message); setSaving(false); return }

    // 고기는 processing 상태로 배치 생성, 기타는 바로 available
    const selectedProduct = products.find(p => p.id === form.product_id)
    const isProcessing = selectedProduct?.requires_processing ?? true

    await supabase.from('inventory_batches').insert({
      purchase_id:          purchase.id,
      product_id:           form.product_id,
      batch_code:           '',  // 트리거 자동생성
      processed_date:       form.purchase_date,
      raw_weight_kg:        parseFloat(form.raw_weight_kg),
      initial_weight_kg:    isProcessing ? 0 : parseFloat(form.raw_weight_kg),
      remaining_weight_kg:  isProcessing ? 0 : parseFloat(form.raw_weight_kg),
      effective_unit_price: isProcessing ? 0 : parseInt(form.unit_price),
      sell_price:           isProcessing ? 0 : parseInt(form.unit_price),
      status:               isProcessing ? 'processing' : 'available',
      created_by:           profile.id,
    })

    setSuccess(true)
    setForm({ supplier_id: '', product_id: '', purchase_date: today(), raw_weight_kg: '', unit_price: '', memo: '' })
    fetchRecent()
    setTimeout(() => setSuccess(false), 3000)
    setSaving(false)
  }

  return (
    <div className="page">
      <div className="top-bar"><h1>매입 등록</h1></div>
      <div className="alert alert-info">
        1단계: 거래처에서 가져온 원물 정보를 기록합니다. 고기는 숙성 후 2단계(가공완료)에서 재고에 반영됩니다.
      </div>

      {success && <div className="alert alert-success">등록 완료! 가공완료 탭에서 숙성 후 중량을 입력해주세요.</div>}

      <div className="card">
        <form onSubmit={handleSubmit}>
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

          {/* 총금액 미리보기 */}
          {totalAmount > 0 && (
            <div className="alert alert-info" style={{ marginBottom: '12px' }}>
              총 매입금액: <strong>{totalAmount.toLocaleString()}원</strong>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">메모 (선택)</label>
            <input className="form-input" type="text" placeholder="특이사항" value={form.memo} onChange={e => set('memo', e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={saving}>
            {saving ? '저장 중...' : '매입 등록'}
          </button>
        </form>
      </div>

      {/* 최근 등록 내역 */}
      {recent.length > 0 && (
        <>
          <div className="section-label">최근 등록</div>
          {recent.map(r => (
            <div key={r.id} className="card" style={{ marginBottom: '6px' }}>
              <div className="card-row">
                <div>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{r.products?.name}</span>
                  <span style={{ fontSize: '12px', color: 'var(--text3)', marginLeft: '8px' }}>{r.suppliers?.name}</span>
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
