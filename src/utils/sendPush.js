import { supabase } from '../supabaseClient'

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`

/**
 * 특정 유저들에게 푸시 알림 발송
 * @param {string[]} userIds
 * @param {object}   payload { title, body, url }
 */
async function pushToUsers(userIds, payload) {
  if (!userIds?.length) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ user_ids: userIds, ...payload }),
    })
  } catch (err) {
    console.error('푸시 발송 실패:', err)
  }
}

/**
 * 특정 역할의 모든 유저에게 푸시
 */
async function pushToRole(role, payload) {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('role', role)
    .eq('is_active', true)
  if (users?.length) await pushToUsers(users.map(u => u.id), payload)
}

/**
 * 특정 지점 점장에게 푸시
 */
async function pushToBranchManager(branchId, payload) {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'manager')
    .eq('branch_id', branchId)
    .eq('is_active', true)
  if (users?.length) await pushToUsers(users.map(u => u.id), payload)
}

// ── 상황별 알림 함수들 ─────────────────────────────────────

/** 점장 → 사장: 신규 주문 */
export async function notifyNewOrder(branchName, orderNumber) {
  await pushToRole('owner', {
    title: '새 주문이 들어왔습니다',
    body:  `${branchName} — ${orderNumber}`,
    url:   '/gyeopgyeopi-supply/owner/orders',
  })
}

/** 사장 → 스태프 + 점장: 주문 승인 */
export async function notifyOrderApproved(branchId, branchName, orderNumber) {
  await pushToRole('staff', {
    title: '주문이 승인됐습니다',
    body:  `${branchName} ${orderNumber} — 출고 준비를 시작해주세요`,
    url:   '/gyeopgyeopi-supply/staff/orders',
  })
  await pushToBranchManager(branchId, {
    title: '주문이 승인됐습니다',
    body:  `${orderNumber} — 본사에서 준비 중입니다`,
    url:   '/gyeopgyeopi-supply/manager/orders',
  })
}

/** 스태프 → 사장 + 점장: 출고 완료 */
export async function notifyOrderShipped(branchId, branchName, orderNumber) {
  await pushToRole('owner', {
    title: '출고가 완료됐습니다',
    body:  `${branchName} ${orderNumber} 출고 완료`,
    url:   '/gyeopgyeopi-supply/owner/orders',
  })
  await pushToBranchManager(branchId, {
    title: '물건을 준비했습니다',
    body:  `${orderNumber} — 배송 예정입니다`,
    url:   '/gyeopgyeopi-supply/manager/orders',
  })
}

/** 스태프 → 사장: 재고 경과 경고 */
export async function notifyAgeWarning(productName, batchCode, days) {
  await pushToRole('owner', {
    title: '재고 경과 경고',
    body:  `${productName} ${batchCode} — ${days}일 경과. 우선 출고 필요`,
    url:   '/gyeopgyeopi-supply/owner/inventory',
  })
}

/** 출고 시 재고 부족 */
export async function notifyStockShortage(branchName, productName, shortage) {
  await pushToRole('owner', {
    title: '재고 부족 알림',
    body:  `${branchName} ${productName} — ${shortage}kg 부족 출고됨`,
    url:   '/gyeopgyeopi-supply/owner/inventory',
  })
}
