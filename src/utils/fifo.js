import { supabase } from '../supabaseClient'

/**
 * FIFO로 배치를 할당하고 차감 기록을 생성합니다.
 *
 * @param {string} orderItemId
 * @param {string} productId
 * @param {number} actualWeightKg - 실제 출고 중량 (kg)
 * @param {string} brand          - 'gyeobgyeob' | 'jeokdon'
 */
export async function allocateFifo(orderItemId, productId, actualWeightKg, brand) {
  const { data: batches, error } = await supabase
    .from('inventory_batches')
    .select('id, remaining_weight_kg, sell_price, seq')
    .eq('product_id', productId)
    .eq('status', 'available')
    .eq('brand', brand)
    .gt('remaining_weight_kg', 0)
    .order('seq', { ascending: true })

  if (error) throw error

  let remaining = actualWeightKg
  const allocations = []

  for (const batch of batches) {
    if (remaining <= 0) break
    const take = Math.min(remaining, batch.remaining_weight_kg)
    allocations.push({
      order_item_id:   orderItemId,
      batch_id:        batch.id,
      allocated_qty:   Math.round(take * 1000) / 1000,
      effective_price: batch.sell_price,
    })
    remaining = Math.round((remaining - take) * 1000) / 1000
  }

  if (allocations.length === 0) {
    return { ok: false, allocations: [], shortage: actualWeightKg }
  }

  const { error: insertErr } = await supabase
    .from('order_item_allocations')
    .insert(allocations)

  if (insertErr) throw insertErr

  const totalAllocated = allocations.reduce((s, a) => s + a.allocated_qty, 0)
  const weightedPrice  = Math.round(
    allocations.reduce((s, a) => s + a.allocated_qty * a.effective_price, 0) / totalAllocated
  )

  await supabase
    .from('order_items')
    .update({ actual_weight_kg: totalAllocated, charged_price: weightedPrice })
    .eq('id', orderItemId)

  return { ok: true, allocations, shortage: remaining }
}

/**
 * 주문 전체 품목에 대해 FIFO 차감을 실행합니다.
 *
 * @param {string} orderId
 * @param {string} staffId
 * @param {string} brand          - 'gyeobgyeob' | 'jeokdon'
 * @param {Object} actualWeights  - { [orderItemId]: kg } 스태프 입력 실중량
 */
export async function shipOrder(orderId, staffId, brand, actualWeights = {}) {
  const { data: items } = await supabase
    .from('order_items')
    .select('id, product_id, requested_qty, actual_weight_kg')
    .eq('order_id', orderId)

  const shortages = []

  for (const item of items) {
    const qty = actualWeights[item.id] ?? item.actual_weight_kg ?? item.requested_qty
    const result = await allocateFifo(item.id, item.product_id, qty, brand)
    if (result.shortage > 0) {
      shortages.push({ product_id: item.product_id, shortage: result.shortage })
    }
  }

  await supabase
    .from('orders')
    .update({ status: 'shipped', shipped_by: staffId, shipped_at: new Date().toISOString() })
    .eq('id', orderId)

  return { ok: true, shortages }
}
