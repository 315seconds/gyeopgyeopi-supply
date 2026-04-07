import { supabase } from '../supabaseClient'

/**
 * 특정 역할의 모든 유저에게 알림 전송
 * @param {'owner'|'staff'|'manager'} role
 * @param {object} payload { type, title, body, ref_id? }
 */
export async function notifyRole(role, payload) {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('role', role)
    .eq('is_active', true)

  if (!users?.length) return

  const rows = users.map(u => ({ user_id: u.id, ...payload }))
  await supabase.from('notifications').insert(rows)
}

/**
 * 특정 지점의 점장에게 알림 전송
 */
export async function notifyBranchManager(branchId, payload) {
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'manager')
    .eq('branch_id', branchId)
    .eq('is_active', true)

  if (!users?.length) return
  const rows = users.map(u => ({ user_id: u.id, ...payload }))
  await supabase.from('notifications').insert(rows)
}

/**
 * 특정 유저에게 직접 알림
 */
export async function notifyUser(userId, payload) {
  await supabase.from('notifications').insert({ user_id: userId, ...payload })
}

/** 읽음 처리 */
export async function markRead(notificationId) {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
}

/** 전체 읽음 처리 */
export async function markAllRead(userId) {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
}
