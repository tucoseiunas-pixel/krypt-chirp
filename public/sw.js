// public/sw.js
const CACHE_NAME = 'kchirp-cache-v1';

self.addEventListener('install', (event) => {
  console.log('[K-CHIRP SW] Instalado com sucesso.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[K-CHIRP SW] Ativado e pronto para segundo plano.');
  return self.clients.claim();
});

// Listener para receber as notificações Push que vão acordar o Android
self.addEventListener('push', (event) => {
  let data = { title: 'K-CHIRP', body: 'Chamada recebida...' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'K-CHIRP', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [500, 250, 500, 250, 500, 250, 500], // Vibração agressiva estilo Nextel
    tag: 'kchirp-call',
    renew: true,
    data: {
      url: '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});