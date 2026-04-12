// 겹겹 서비스 워커 — 웹 푸시 알림 처리

self.addEventListener('push', event => {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body:    data.body ?? '',
    icon:    '/gyeopgyeopi-supply/logo.png',
    badge:   '/gyeopgyeopi-supply/logo.png',
    vibrate: [200, 100, 200],
    data:    { url: data.url ?? '/gyeopgyeopi-supply/' },
    actions: data.actions ?? [],
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? '겹겹', options)
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('gyeopgyeopi-supply') && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
