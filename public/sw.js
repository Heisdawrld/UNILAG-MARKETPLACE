// UNILAG Marketplace Push Notification Service Worker
// This runs in the background to receive push notifications

self.addEventListener('push', function(event) {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'UNILAG Marketplace', body: event.data.text() };
  }

  const options = {
    body: data.body || data.message || '',
    icon: '/logo.png',
    badge: '/logo.png',
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

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  // Deep link based on notification type
  if (data.type === 'new_message') url = '/?tab=messages';
  else if (data.type === 'task_accepted') url = '/?tab=tasks';
  else if (data.type === 'new_follower') url = '/?tab=profile';
  else if (data.type === 'boost_expiry') url = '/?tab=profile';
  else if (data.url) url = data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return clients.openWindow(url);
    })
  );
});

// Activate immediately
self.addEventListener('activate', function(event) {
  event.waitUntil(self.clients.claim());
});
