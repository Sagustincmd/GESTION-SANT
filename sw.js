// sw.js — Avisos de la Bandeja del agente (notificaciones push)

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Bandeja del agente', {
    body: d.body || 'Hay un mensaje para revisar.',
    tag: d.tag || 'bandeja',
    renotify: true,
    requireInteraction: true,
    data: { cliente: d.cliente || '' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const cliente = (e.notification.data && e.notification.data.cliente) || '';
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const v of ventanas) {
      if (new URL(v.url).origin === self.location.origin) {
        v.postMessage({ tipo: 'abrir-bandeja', cliente });
        return v.focus();
      }
    }
    const url = new URL('/', self.location.origin);
    if (cliente && cliente !== 'prueba') url.searchParams.set('bandeja', cliente);
    else url.searchParams.set('bandeja', '');
    return self.clients.openWindow(url.href);
  })());
});
