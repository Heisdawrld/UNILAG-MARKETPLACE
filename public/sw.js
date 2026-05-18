// UNILAG Marketplace Service Worker
// Handles push notifications and PWA install requirements

const CACHE_NAME = 'unilag-v1';

// Install: cache essential assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll([
        '/logo.png',
        '/icon-192.png',
        '/icon-512.png',
      ]);
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Fetch: network-first with cache fallback for images
self.addEventListener('fetch', function(event) {
  // Only cache GET requests
  if (event.request.method !== 'GET') return;

  // For navigation requests, always go to network
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match('/') || new Response('Offline', { status: 503 });
      })
    );
    return;
  }

  // For static assets, try cache first then network
  if (event.request.url.match(/\.(png|jpg|jpeg|svg|ico|webp)$/)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        return cached || fetch(event.request).then(function(response) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
          return response;
        });
      })
    );
    return;
  }
});

// Push notification received
self.addEventListener('push', function(event) {
  if (!event.data) return;

  var data;
  try {
    data = event.data.json();
  } catch(e) {
    data = { title: 'UNILAG Marketplace', body: event.data.text() };
  }

  var options = {
    body: data.body || data.message || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: true,
    requireInteraction: data.requireInteraction || false,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'UNILAG Marketplace', options)
  );
});

// Notification click — deep link into the app
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var data = event.notification.data || {};
  var url = '/';

  if (data.chatId) {
    url = '/?tab=messages';
    if (data.chatId) url += '&chatId=' + encodeURIComponent(data.chatId);
  }
  else if (data.taskId) {
    url = '/?tab=tasks';
    if (data.taskId) url += '&taskId=' + encodeURIComponent(data.taskId);
  }
  else if (data.type === 'new_follower') url = '/?tab=profile';
  else if (data.type === 'boost_expiry') url = '/?tab=profile';
  else if (data.url) url = data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
