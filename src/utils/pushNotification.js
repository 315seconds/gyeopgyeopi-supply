import { supabase } from '../supabaseClient'

// .env에 추가해야 할 값:
// VITE_VAPID_PUBLIC_KEY=BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxA
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/**
 * Base64 URL → Uint8Array 변환 (VAPID 키 변환용)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

/**
 * 푸시 알림 권한 요청 + 구독 등록
 * 로그인 후 한 번 호출하면 됨
 */
export async function registerPush(userId) {
  try {
    // 브라우저 지원 확인
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('이 브라우저는 푸시 알림을 지원하지 않습니다')
      return false
    }

    // 서비스 워커 등록
    const reg = await navigator.serviceWorker.register(
      '/gyeopgyeopi-supply/sw.js',
      { scope: '/gyeopgyeopi-supply/' }
    )
    await navigator.serviceWorker.ready

    // 알림 권한 요청
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('알림 권한이 거부됐습니다')
      return false
    }

    // 기존 구독 확인 또는 새로 구독
    let subscription = await reg.pushManager.getSubscription()
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const { endpoint, keys } = subscription.toJSON()

    // Supabase에 구독 정보 저장 (중복이면 무시)
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint,
      p256dh:  keys.p256dh,
      auth:    keys.auth,
    }, { onConflict: 'user_id, endpoint' })

    console.log('푸시 알림 등록 완료')
    return true
  } catch (err) {
    console.error('푸시 알림 등록 실패:', err)
    return false
  }
}

/**
 * 구독 해제
 */
export async function unregisterPush(userId) {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/gyeopgyeopi-supply/')
    if (!reg) return

    const subscription = await reg.pushManager.getSubscription()
    if (subscription) {
      await subscription.unsubscribe()
      await supabase.from('push_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint)
    }
  } catch (err) {
    console.error('구독 해제 실패:', err)
  }
}
