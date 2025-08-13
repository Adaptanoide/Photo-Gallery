// SERVICE WORKER v4 - Cache Inteligente Melhorado
const CACHE_NAME = 'sunshine-cache-v4';
const CACHE_TIMES = {
    thumbnails: 24 * 60 * 60 * 1000,  // 24 horas
    folders: 60 * 60 * 1000,           // 1 hora
    api: 5 * 60 * 1000                 // 5 minutos
};

self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker v4: Instalando...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('✅ Service Worker v4: Ativado!');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    
    // CACHE 1: Navegação de pastas (1 hora)
    if (url.includes('/api/drive/explore')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cached => {
                    const now = Date.now();
                    
                    // Se tem cache e é recente (1 hora)
                    if (cached) {
                        const cachedTime = cached.headers.get('cache-time');
                        if (cachedTime && (now - parseInt(cachedTime)) < CACHE_TIMES.folders) {
                            console.log('📁 Pasta do cache:', url.slice(-20));
                            return cached;
                        }
                    }
                    
                    // Buscar nova versão
                    return fetch(event.request).then(response => {
                        if (response.ok) {
                            const responseToCache = response.clone();
                            const headers = new Headers(responseToCache.headers);
                            headers.append('cache-time', now.toString());
                            
                            const cachedResponse = new Response(responseToCache.body, {
                                status: responseToCache.status,
                                statusText: responseToCache.statusText,
                                headers: headers
                            });
                            
                            cache.put(event.request, cachedResponse);
                            console.log('💾 Pasta cacheada');
                        }
                        return response;
                    });
                });
            })
        );
        return;
    }
    
    // CACHE 2: Thumbnails (24 horas)
    if (url.includes('googleusercontent.com') && url.includes('=s')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cached => {
                    if (cached) {
                        console.log('📦 Thumb do cache');
                        return cached;
                    }
                    
                    return fetch(event.request).then(response => {
                        if (response.ok) {
                            cache.put(event.request, response.clone());
                            console.log('💾 Thumb salva');
                        }
                        return response;
                    });
                });
            })
        );
        return;
    }
    
    // CACHE 3: Status de reservas (30 segundos)
    if (url.includes('/api/cart/reserved-status')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return cache.match(event.request).then(cached => {
                    const now = Date.now();
                    
                    // Cache por apenas 30 segundos
                    if (cached) {
                        const cachedTime = cached.headers.get('cache-time');
                        if (cachedTime && (now - parseInt(cachedTime)) < 30000) {
                            return cached;
                        }
                    }
                    
                    return fetch(event.request);
                });
            })
        );
        return;
    }
    
    // Resto: sem cache
    event.respondWith(fetch(event.request));
});

console.log('🚀 Service Worker v4 com cache inteligente!');