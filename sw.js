// sw.js - положите в корень сайта
const CACHE_NAME = 'schedule-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/icon-192.png'
];

// Установка Service Worker
self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Кэш открыт');
                return cache.addAll(urlsToCache);
            })
    );
});

// Активация и очистка старых кэшей
self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Перехват запросов (для офлайн-режима)
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// ===== ПУШ УВЕДОМЛЕНИЯ =====
self.addEventListener('push', function(event) {
    let data = { title: '📚 Расписание', body: 'Обновление!' };
    
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: '📚 Расписание', body: event.data.text() };
        }
    }
    
    const options = {
        body: data.body || 'Расписание было обновлено!',
        icon: data.icon || '/icon-192.png',
        badge: '/badge-72.png',
        vibrate: [200, 100, 200, 100, 200],
        sound: '/notification.mp3',
        tag: 'schedule-update',
        requireInteraction: true,
        data: {
            url: data.url || '/'
        },
        actions: [
            {
                action: 'open',
                title: '📖 Открыть расписание'
            },
            {
                action: 'close',
                title: 'Закрыть'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(
            data.title || '📚 Обновление расписания',
            options
        )
    );
});

// Обработчик клика по уведомлению
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    if (event.action === 'open' || event.action === '') {
        const url = event.notification.data.url || '/';
        event.waitUntil(
            clients.openWindow(url)
        );
    }
});

// Обработчик закрытия уведомления
self.addEventListener('notificationclose', function(event) {
    console.log('Уведомление закрыто');
});