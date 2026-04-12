import { supabase } from '../supabaseClient'

async function pushToUsers(userIds, payload) {
  console.log('pushToUsers 호출:', userIds, payload)
  if (!userIds?.length) {
    console.log('유저 없음 — 종료')
    return
  }
  try {
    const { data: { session } } = await supabase.auth.getSession()
    console.log('세션:', session?.access_token ? '있음' : '없음')

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`
    console.log('요청 URL:', url)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ user_ids: userIds, ...payload }),
    })
    const text = await res.text()
    console.log('응답 status:', res.status, '내용:', text)
  } catch (err) {
    console.error('pushToUsers 에러:', err)
  }
}

async function pushToRole(role, payload) {
  console.log('pushToRole 시작 — role:', role)
  const { data: users, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', role)
    .eq('is_active', true)
  console.log('유저 조회 결과:', users, '에러:', error)
  if (users?.length) await pushToUsers(users.map(u => u.id), payload)
}

async function pushToBranchManager(branchId, payload) {
  console.log('pushToBranchManager — branchId:', branchId)
  const { data: users, error } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'manager')
    .eq('branch_id', branchId)
    .eq('is_active', true)
  console.log('점장 조회 결과:', users, '에러:', error)
  if (users?.length) await pushToUsers(users.map(u => u.id), payload)
}

export async function notifyNewOrder(branchName, orderNumber) {
  console.log('notifyNewOrder 호출:', branchName, orderNumber)
  await pushToRole('owner', {
    title: '새 주문이 들어왔습니다',
    body:  `${branchName} — ${orderNumber}`,
    url:   '/gyeopgyeopi-supply/owner/orders',
  })
}

export async function notifyOrderApproved(branchId, branchName, orderNumber) {
  console.log('notifyOrderApproved 호출:', branchId, branchName, orderNumber)
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
  console.log('notifyOrderShipped 호출:', branchId, branchName, orderNumber)
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
  console.log('notifyAgeWarning 호출:', productName, batchCode, days)
  await pushToRole('owner', {
    title: '재고 경과 경고',
    body:  `${productName} ${batchCode} — ${days}일 경과. 우선 출고 필요`,
    url:   '/gyeopgyeopi-supply/owner/inventory',
  })
}

export async function notifyStockShortage(branchName, productName, shortage) {
  console.log('notifyStockShortage 호출:', branchName, productName, shortage)
  await pushToRole('owner', {
    title: '재고 부족 알림',
    body:  `${branchName} ${productName} — ${shortage}kg 부족 출고됨`,
    url:   '/gyeopgyeopi-supply/owner/inventory',
  })
}
