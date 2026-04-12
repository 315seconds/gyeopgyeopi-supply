// Supabase Edge Function — 웹 푸시 발송
// 배포: supabase functions deploy send-push

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT     = 'mailto:admin@gyeobgyeob.com'

// web-push 라이브러리 (Deno용)
import webpush from 'https://esm.sh/web-push@3.6.7'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const { user_ids, title, body, url } = await req.json()

    if (!user_ids?.length) {
      return new Response(JSON.stringify({ error: 'user_ids 필수' }), { status: 400 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // 해당 유저들의 구독 정보 조회
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .in('user_id', user_ids)

    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0, message: '구독자 없음' }), { status: 200 })
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

    const payload = JSON.stringify({ title, body, url: url ?? '/' })

    const results = await Promise.allSettled(
      subs.map(sub =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    )

    const sent   = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return new Response(
      JSON.stringify({ sent, failed }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
