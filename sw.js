const C='todos-shell-v28',SHELL=['./','index.html','app.js','goals-core.js','styles.css','manifest.json','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL.map(u=>new Request(u,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
// v24: shell served from cache first (fast, no radio wake), refreshed in the background; new versions arrive via the cache-name bump
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin||e.request.method!=='GET')return;
 e.respondWith(caches.open(C).then(async c=>{const hit=await c.match(e.request,{ignoreSearch:true});
  const net=fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok&&r.type==='basic')c.put(u.origin+u.pathname,r.clone());return r});
  if(hit){e.waitUntil(net.catch(()=>{}));return hit}return net}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window'}).then(cs=>cs.length?cs[0].focus():clients.openWindow('./')))});
// periodicsync: shell refresh only (data needs token kept in page storage; reminders fire from the open app)
self.addEventListener('periodicsync',e=>{if(e.tag==='due-check')e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).catch(()=>{}))});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch(x){d={title:'To-Do due',body:e.data&&e.data.text()}}
 e.waitUntil(self.registration.showNotification(d.title||'To-Do due',{body:d.body||'',tag:d.tag,icon:'icon-192.png',badge:'icon-192.png'}))});
