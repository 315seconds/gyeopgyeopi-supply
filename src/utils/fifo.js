import { supabase } from '../supabaseClient'

/**
 * 주문 품목에 대해 FIFO로 배치를 할당하고 차감 기록을 생성합니다.
 * orders.status 가 'shipped' 로 바뀌는 시점에 호출됩니다.
 *
 * @param {string} orderItemId  - order_items.id
 * @param {string} productId    - products.id
 * @param {number} qty          - 출고할 총 수량 (kg)
 * @returns {{ ok: boolean, allocations: Array, shortage: number }}
 */
export async function allocateFifo(orderItemId, productId, qty) {
  // 1. 해당 품목의 available 배치를 FIFO 순으로 조회
  const { data: batches, error } = await supabase
    .from('inventory_batches')
    .select('id, remaining_weight_kg, sell_price, seq')
    .eq('product_id', productId)
    .eq('status', 'available')
    .gt('remaining_weight_kg', 0)
    .order('seq', { ascending: true })

  if (error) throw error

  let remaining = qty
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
    return { ok: false, allocations: [], shortage: qty }
  }

  // 2. 차감 기록 INSERT → DB 트리거가 remaining_weight_kg 자동 차감
  const { error: insertErr } = await supabase
    .from('order_item_allocations')
    .insert(allocations)

  if (insertErr) throw insertErr

  // 3. order_item의 actual_qty와 charged_price 업데이트
  //    여러 배치에 걸친 경우 가중평균 단가 계산
  const totalAllocated = allocations.reduce((s, a) => s + a.allocated_qty, 0)
  const weightedPrice  = Math.round(
    allocations.reduce((s, a) => s + a.allocated_qty * a.effective_price, 0) / totalAllocated
  )

  await supabase
    .from('order_items')
    .update({ actual_qty: totalAllocated, charged_price: weightedPrice })
    .eq('id', orderItemId)

  return { ok: true, allocations, shortage: remaining }
}

/**
 * 주문 전체의 모든 품목에 대해 FIFO 차감을 실행합니다.
 * @param {string} orderId
 * @returns {{ ok: boolean, shortages: Array }}
 */
export async function shipOrder(orderId, staffId) {
  const { data: items } = await supabase
    .from('order_items')
    .select('id, product_id, requested_qty')
    .eq('order_id', orderId)

  const shortages = []

  for (const item of items) {
    const result = await allocateFifo(item.id, item.product_id, item.requested_qty)
    if (result.shortage > 0) {
      shortages.push({ product_id: item.product_id, shortage: result.shortage })
    }
  }

  // orders 상태 업데이트
  await supabase
    .from('orders')
    .update({ status: 'shipped', shipped_by: staffId, shipped_at: new Date().toISOString() })
    .eq('id', orderId)

  return { ok: true, shortages }
}
