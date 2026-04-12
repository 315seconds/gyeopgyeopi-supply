import { supabase } from '../supabaseClient'

async function pushToUsers(userIds, payload) {
  if (!userIds?.length) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
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

async function pushToRole(role, payload) {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('role', role)
    .eq('is_active', true)
  if (users?.length) await pushToUsers(users.map(u => u.id), payload)
}

async function pushToBranchManager(branchId, payload) {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'manager')
    .eq('branch_id', branchId)
    .eq('is_active', true)
  if (users?.length) await pushToUsers(users.map(u => u.id), payload)
}

export async function notifyNewOrder(branchName, orderNumber) {
  await pushToRole('owner', {
    title: '새 주문이 들어왔습니다',
    body:  `${branchName} — ${orderNumber}`,
    url:   '/gyeopgyeopi-supply/owner/orders',
  })
}

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

export async function notifyAgeWarning(productName, batchCode, days) {
  await pushToRole('owner', {
    title: '재고 경과 경고',
    body:  `${productName} ${batchCode} — ${days}일 경과. 우선 출고 필요`,
    url:   '/gyeopgyeopi-supply/owner/inventory',
  })
}

export async function notifyStockShortage(branchName, productName, shortage) {
  await pushToRole('owner', {
    title: '재고 부족 알림',
    body:  `${branchName} ${productName} — ${shortage}kg 부족 출고됨`,
    url:   '/gyeopgyeopi-supply/owner/inventory',
  })
}
