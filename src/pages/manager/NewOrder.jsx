import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../supabaseClient'
import { notifyRole } from '../../utils/notifications'
import { notifyNewOrder } from '../../utils/sendPush'

export default function ManagerNewOrder() {
  const { profile, branchId, branchName } = useAuth()
  const [products, setProducts] = useState([])
  const [items, setItems]       = useState([{ product_id: '', qty: '' }])
  const [memo, setMemo]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [done, setDone]         = useState(null)

  useEffect(() => {
    supabase.from('products').select('id, name, unit').eq('is_active', true)
      .then(({ data }) => setProducts(data ?? []))
  }, [])

  function addItem() {
    setItems(prev => [...prev, { product_id: '', qty: '' }])
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx, key, val) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [key]: val } : item))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const validItems = items.filter(i => i.product_id && parseFloat(i.qty) > 0)
    if (!validItems.length) return alert('품목과 수량을 입력하세요')
    setSaving(true)

    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        order_number: '',
        branch_id:    branchId,
        requested_by: profile.id,
        memo:         memo || null,
        status:       'pending',
      })
      .select()
      .single()

    if (error) { alert('주문 실패: ' + error.message); setSaving(false); return }

    await supabase.from('order_items').insert(
      validItems.map(item => ({
        order_id:      order.id,
        product_id:    item.product_id,
        requested_qty: parseFloat(item.qty),
      }))
    )

    // 트리거로 채번된 실제 order_number 조회
    const { data: freshOrder } = await supabase
      .from('orders')
      .select('order_number')
      .eq('id', order.id)
      .single()
    const orderNumber = freshOrder?.order_number ?? order.id

    await notifyRole('owner', {
      type:   'new_order',
      title:  `${branchName} 주문 요청`,
      body:   `${validItems.length}품목 주문이 접수됐습니다`,
      ref_id: order.id,
    })
    // 웹 푸시 발송
    await notifyNewOrder(branchName, orderNumber)

    setDone(orderNumber)
    setSaving(false)
    setItems([{ product_id: '', qty: '' }])
    setMemo('')
  }

  if (done) {
    return (
      <div className="page">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: 'var(--green-bg)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px', fontSize: '28px',
          }}>✓</div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>주문 요청 완료</h2>
          <p style={{ color: 'var(--text2)', marginBottom: '4px' }}>{done}</p>
          <p style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: '32px' }}>
            본사 사장님 승인 후 배송됩니다
          </p>
          <button className="btn btn-primary" onClick={() => setDone(null)}>
            추가 주문하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="top-bar">
        <div>
          <h1>신규 주문</h1>
          <div className="sub">{branchName}</div>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          {items.map((item, idx) => {
            const selected = products.find(p => p.id === item.product_id)
            return (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 36px', gap: '8px', marginBottom: '10px', alignItems: 'end' }}>
                <div>
                  {idx === 0 && <label className="form-label">품목</label>}
                  <select
                    className="form-input"
                    value={item.product_id}
                    onChange={e => updateItem(idx, 'product_id', e.target.value)}
                    required
                  >
                    <option value="">선택</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  {idx === 0 && (
                    <label className="form-label">
                      수량 {selected ? `(${selected.unit})` : ''}
                    </label>
                  )}
                  <input
                    className="form-input"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    value={item.qty}
                    onChange={e => updateItem(idx, 'qty', e.target.value)}
                    required
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  style={{
                    height: '42px', borderRadius: 'var(--r-md)',
                    border: '0.5px solid var(--border2)',
                    background: 'none', color: 'var(--text3)',
                    fontSize: '16px', cursor: 'pointer',
                    opacity: items.length === 1 ? 0.3 : 1,
                  }}
                >
                  ×
                </button>
              </div>
            )
          })}

          <button
            type="button"
            className="btn btn-full"
            style={{ marginBottom: '14px', fontSize: '13px' }}
            onClick={addItem}
          >
            + 품목 추가
          </button>

          <div className="form-group">
            <label className="form-label">본사 전달 메모 (선택)</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="특이사항이나 요청사항을 입력하세요"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              style={{ resize: 'none' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={saving}
            style={{ height: '46px', fontSize: '15px' }}
          >
            {saving ? '요청 중...' : '주문 요청'}
          </button>
        </form>
      </div>
    </div>
  )
}
