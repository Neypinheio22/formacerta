// Service worker do FormaCerta: mostra as notificações (mensagem no chat, aluno
// chamando por vídeo, lembrete do treino agendado) mesmo com o app fechado.
// Não guarda nada em cache: o app continua sempre atualizado.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (evento) => {
  let dados = {}
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = { titulo: 'FormaCerta', corpo: evento.data ? evento.data.text() : '' }
  }
  const chamada = dados.tipo === 'chamada'
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // Com o app aberto na frente, quem avisa é o próprio app (o chat ou o toque da chamada).
      if (janelas.some((j) => j.visibilityState === 'visible' && j.focused)) return
      return self.registration.showNotification(dados.titulo || 'FormaCerta', {
        body: dados.corpo || '',
        icon: './icon-192.png',
        badge: './favicon-32.png',
        tag: dados.tag || undefined,
        renotify: !!dados.tag,
        requireInteraction: chamada,
        vibrate: chamada ? [400, 200, 400, 200, 400] : [200],
        data: { url: dados.url || './' },
      })
    }),
  )
})

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = new URL(evento.notification.data?.url || './', self.registration.scope).href
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => j.url.startsWith(self.registration.scope))
      if (aberta) {
        aberta.postMessage({ tipo: 'abrir', url: destino })
        return aberta.focus()
      }
      return self.clients.openWindow(destino)
    }),
  )
})
