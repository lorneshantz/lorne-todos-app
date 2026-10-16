const OWNER='lorneshantz',REPO='lorne-todos',PATH='todos.json',BRANCH='main';
const API=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
const $=s=>document.querySelector(s);let data=null,sha=null,editing=null;
const tok=()=>localStorage.getItem('gh_token');
const b64d=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g,'')),c=>c.charCodeAt(0)));
const b64e=s=>{const b=new TextEncoder().encode(s);let r='';b.forEach(x=>r+=String.fromCharCode(x));return btoa(r)};
const now=()=>new Date().toISOString();const status=m=>$('#status').textContent=m||'';
function norm(d){d=d||{};d.schemaVersion=d.schemaVersion||1;d.todos=(d.todos||[]).map(t=>({steps:[],status:'open',list:'Inbox',...t}));
 const s=new Set(d.lists||['Inbox']);d.todos.forEach(t=>s.add(t.list));d.lists=[...s];d.favorites=(d.favorites||[]).filter(x=>d.lists.includes(x));if(d.schemaVersion<4)d.schemaVersion=4;return d}
function sorted(d){const f=d.favorites,r=d.lists.filter(x=>!f.includes(x)).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:'base'}));return [...f,...r]}
async function fetchData(){
 const r=await fetch(API+'?ref='+BRANCH+'&t='+Date.now(),{headers:{Authorization:'Bearer '+tok(),Accept:'application/vnd.github+json'},cache:'no-store'});
 if(r.status===401||r.status===403||r.status===404)throw new Error('auth');if(!r.ok)throw new Error('HTTP '+r.status);
 const j=await r.json();sha=j.sha;data=norm(JSON.parse(b64d(j.content)));localStorage.setItem('cache',JSON.stringify(data));}
async function load(){if(!tok())return openSettings();status('Loading…');
 try{await fetchData();status('Updated '+new Date().toLocaleTimeString())}
 catch(e){if(e.message==='auth'){status('Token rejected — check settings');return openSettings()}
  const c=localStorage.getItem('cache');if(c){data=norm(JSON.parse(c));status('Offline — showing last saved copy')}else status('Could not load: '+e.message)}
 render()}
// change = function(data) applied; on conflict refetch and reapply
async function commit(change,msg){if(!navigator.onLine){alert('Offline — changes need a connection');return}
 for(let i=0;i<3;i++){change(data);data.updated=now();render();
  const r=await fetch(API,{method:'PUT',headers:{Authorization:'Bearer '+tok(),Accept:'application/vnd.github+json'},
   body:JSON.stringify({message:msg,content:b64e(JSON.stringify(data,null,2)+'\n'),sha,branch:BRANCH})});
  if(r.ok){sha=(await r.json()).content.sha;localStorage.setItem('cache',JSON.stringify(data));status('Saved');return}
  if(r.status===409||r.status===422){status('Conflict — retrying');await fetchData();continue}
  status('Save failed: HTTP '+r.status);return}status('Save failed after retries');await load()}
function esc(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
var render=function(){const m=$('#lists');m.innerHTML='';if(!data)return;
 const f=$('#filter').value.trim().toLowerCase(),showDone=$('#showDone').checked;
 const as=new Set(data.todos.map(t=>t.assignee).filter(Boolean));$('#assignees').innerHTML=[...as].map(a=>`<option value="${esc(a)}">`).join('');
 $('#listNames').innerHTML=sorted(data).map(a=>`<option value="${esc(a)}">`).join('');
 let any=false;for(const L of sorted(data)){const items=data.todos.filter(t=>t.list===L&&(showDone||t.status!=='complete')&&(!f||(t.assignee||'').toLowerCase().includes(f)));
  any=true;const fav=data.favorites.includes(L);const s=document.createElement('section');s.innerHTML=`<h2><button class="star${fav?' on':''}" title="${fav?'Unstar':'Star'} list">${fav?'★':'☆'}</button> ${esc(L)} (${items.length})</h2>`;
  s.querySelector('.star').onclick=()=>commit(D=>{const i=D.favorites.indexOf(L);if(i>=0)D.favorites.splice(i,1);else D.favorites.push(L)},`${fav?'Unstar':'Star'} list ${L}`);
  if(!items.length){const e=document.createElement('p');e.className='empty';e.textContent='No items';s.appendChild(e)}
  for(const t of items){const d=document.createElement('div');d.className='item'+(t.status==='complete'?' done':'');
   d.innerHTML=`<button class="chk">${t.status==='complete'?'✓':''}</button><div class="body"><div class="t">${t.recurrence?'<span title="Repeats">🔁</span> ':''}${esc(t.title)}</div>
   <div class="meta">${t.assignee?'👤 '+esc(t.assignee)+' ':''}${t.due?`<span class="due${t.status!=='complete'&&dueAt(t)<Date.now()?' late':''}">📅 ${esc(fmtDue(t))}</span>`:''}</div>${t.steps&&t.steps.length?'<ul>'+t.steps.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>':''}</div>${isOverdueRec(t)?'<button class="cu" title="Bring up to date">⏭</button>':''}<button class="ed">✎</button>`;
   d.querySelector('.chk').onclick=()=>{const nid=newId();commit(D=>{const x=D.todos.find(y=>y.id===t.id);if(x){x.status=x.status==='complete'?'open':'complete';x.updated=now();if(x.status==='complete')spawnNext(D,x,nid)}},`Toggle ${t.title}`)}
   d.querySelector('.ed').onclick=()=>openEdit(t);{const cb=d.querySelector('.cu');if(cb)cb.onclick=()=>catchUpItem(t.id)}s.appendChild(d)}m.appendChild(s)}
 if(!any)m.innerHTML='<p style="padding:14px;color:#666">Nothing to show.</p>'}
function openEdit(t){editing=t.id;const F=$('#editForm');F.title.value=t.title;F.list.value=t.list;F.assignee.value=t.assignee||'';F.steps.value=(t.steps||[]).join('\n');F.status.value=t.status;F.due.value=t.due||'';F.dueTime.value=t.due?(t.dueTime||''):'';F.dueTime.disabled=!t.due;const rc=t.recurrence||{};F.rtype.value=rc.type||'';F.rint.value=rc.interval||1;F.rwd.value=String(rc.weekday??(t.due?pd(t.due).getDay():new Date().getDay()));F.rmd.value=rc.monthDay||(t.due?pd(t.due).getDate():new Date().getDate());rUI();{const od=isOverdueRec(t);$('#catchL').hidden=!od;if(od){const c=catchUpCalc(t.recurrence,t.due);$('#catchInfo').textContent=`missed ${c.skipped}, next ${c.next}`}}$('#edit').showModal()}
$('#edit').addEventListener('close',()=>{if($('#edit').returnValue!=='save')return;const F=$('#editForm'),id=editing;
 const v={title:F.title.value.trim(),list:F.list.value.trim()||'Inbox',assignee:F.assignee.value.trim(),steps:F.steps.value.split('\n').map(s=>s.trim()).filter(Boolean),status:F.status.value,due:F.due.value||'',dueTime:F.due.value?(F.dueTime.value||''):''};const rec=readRec(F),nid=newId();
 commit(D=>{const x=D.todos.find(y=>y.id===id);if(!x)return;const wasDone=x.status==='complete';if(rec)x.recurrence=rec;else delete x.recurrence;const oldDue=x.due,oldTime=x.dueTime;Object.assign(x,v,{updated:now()});if(!x.assignee)delete x.assignee;if(!x.due)delete x.due;if(!x.dueTime||!x.due)delete x.dueTime;if(x.due!==oldDue||x.dueTime!==oldTime)unmark(x.id);if(!D.lists.includes(v.list))D.lists.push(v.list);if(!wasDone&&x.status==='complete')spawnNext(D,x,nid)},`Edit ${v.title}`)});
function openSettings(){$('#setForm').token.value='';$('#settings').showModal()}
$('#settings').addEventListener('close',()=>{const v=$('#settings').returnValue;
 if(v==='save'){const t=$('#setForm').token.value.trim();{const w=$('#setForm').wcid.value.trim();if(w)localStorage.setItem('withingsClientId',w)}if(t){localStorage.setItem('gh_token',t);load();people=null;loadPeople()}}
 if(v==='signout'){localStorage.removeItem('gh_token');localStorage.removeItem('cache');localStorage.removeItem('pcache');people=null;pmsg('Add your GitHub key in ⚙ to load people.');data=null;render();status('Signed out')}});
$('#settingsBtn').onclick=openSettings;$('#refresh').onclick=load;$('#filter').oninput=render;
$('#showDone').checked=localStorage.getItem('showDone')==='1';$('#showDone').onchange=e=>{localStorage.setItem('showDone',e.target.checked?'1':'0');render()};
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(r=>{if(!r)return;r.update();document.addEventListener('visibilitychange',()=>{if(!document.hidden)r.update()})});
 let reloaded=false;const hadCtl=!!navigator.serviceWorker.controller;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadCtl&&!reloaded){reloaded=true;location.reload()}})}load();
// ---- People ----
const PAPI=`https://api.github.com/repos/${OWNER}/${REPO}/contents/people.json`;
let people=null,psha=null,pidx=null,view=localStorage.getItem('view')||'todos';
async function fetchPeople(){const r=await fetch(PAPI+'?ref='+BRANCH+'&t='+Date.now(),{headers:{Authorization:'Bearer '+tok(),Accept:'application/vnd.github+json'},cache:'no-store'});
 if(r.status===404){people={people:[]};psha=null;return}if(r.status===401||r.status===403)throw new Error('auth');if(!r.ok)throw new Error('HTTP '+r.status);
 const j=await r.json();psha=j.sha;people=JSON.parse(b64d(j.content));people.people=people.people||[];localStorage.setItem('pcache',JSON.stringify(people))}
function pmsg(m){$('#plist').innerHTML=`<p class="empty">${esc(m)}</p>`}
async function loadPeople(){if(!tok()){pmsg('Add your GitHub key in ⚙ to load people.');return}
 if(!people)pmsg('Loading people…');
 try{await fetchPeople()}catch(e){const c=localStorage.getItem('pcache');
  if(c){people=JSON.parse(c);status('Offline/error — showing saved people ('+e.message+')')}
  else{people=null;pmsg(e.message==='auth'?'GitHub key was rejected. Update it in ⚙ (needs Contents read/write on lorne-todos).':'Could not load people: '+e.message+'. Tap ⟳ to retry.');return}}
 renderPeople()}
async function commitPeople(change,msg){if(!navigator.onLine){alert('Offline — changes need a connection');return}
 for(let i=0;i<3;i++){change(people);renderPeople();const body={message:msg,content:b64e(JSON.stringify(people,null,2)+'\n'),branch:BRANCH};if(psha)body.sha=psha;
  const r=await fetch(PAPI,{method:'PUT',headers:{Authorization:'Bearer '+tok(),Accept:'application/vnd.github+json'},body:JSON.stringify(body)});
  if(r.ok){psha=(await r.json()).content.sha;localStorage.setItem('pcache',JSON.stringify(people));status('Saved');return}
  if(r.status===409||r.status===422){status('Conflict — retrying');await fetchPeople();continue}status('Save failed: HTTP '+r.status);return}
 status('Save failed after retries');await loadPeople()}
function renderPeople(){if(!people)return;if(!people.people.length){$('#peopleNames').innerHTML='';pmsg('No people yet — tap + Add person.');return}const ps=[...people.people].map((p,i)=>({...p,i})).sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));
 $('#peopleNames').innerHTML=ps.map(p=>`<option value="${esc(p.name)}">`).join('');
 $('#plist').innerHTML=ps.map(p=>`<div class="item"><div class="body"><div class="t">${esc(p.name)}</div><div class="meta">${p.email?`✉ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`:'✉ —'}${p.cell?` · 📱 <a href="tel:${esc(p.cell)}">${esc(p.cell)}</a>`:''}</div></div><button class="ed" data-i="${p.i}">✎</button></div>`).join('')||'<p class="empty">No people yet.</p>';
 $('#plist').querySelectorAll('.ed').forEach(b=>b.onclick=()=>openPerson(+b.dataset.i))}
function openPerson(i){pidx=i;const p=i==null?{name:'',email:'',cell:''}:people.people[i],F=$('#pForm');$('#pTitle').textContent=i==null?'Add person':'Edit person';
 F.name.value=p.name||'';F.email.value=p.email||'';F.cell.value=p.cell||'';$('#pedit').showModal()}
$('#pedit').addEventListener('close',()=>{if($('#pedit').returnValue!=='save')return;const F=$('#pForm'),old=pidx==null?null:people.people[pidx].name;
 const v={name:F.name.value.trim(),email:F.email.value.trim()||null,cell:F.cell.value.trim()||null};if(!v.name)return;
 commitPeople(P=>{const j=old==null?-1:P.people.findIndex(x=>x.name===old);if(j>=0)Object.assign(P.people[j],v);else if(!P.people.some(x=>x.name===v.name))P.people.push(v)},`${old==null?'Add':'Edit'} person ${v.name}`)});
$('#addPerson').onclick=()=>{if(!tok())return openSettings();if(!people)return alert('People list not loaded yet — tap ⟳');openPerson(null)};
const VIEWS={people:['#people','👥','People'],exercise:['#exercise','🏃','Exercise'],meals:['#meals','🍽','Meals'],glucose:['#glucose','🩸','Glucose'],weight:['#weight','⚖️','Weight']};
const BTN={people:'#tabBtn',exercise:'#exBtn',meals:'#mlBtn',glucose:'#glBtn',weight:'#wtBtn'};
function setView(v){if(v!=='todos'&&!VIEWS[v])v='todos';view=v;localStorage.setItem('view',v);
 for(const k in VIEWS){$(VIEWS[k][0]).hidden=k!==v;$(BTN[k]).textContent=k===v?'☑':VIEWS[k][1]}
 $('#lists').hidden=v!=='todos';$('#bar').hidden=v!=='todos';$('#ttl').textContent=v==='todos'?'To-Dos':VIEWS[v][2];
 if(v==='people')loadPeople();if(v==='exercise')loadEx();if(v==='meals')loadMl();if(v==='glucose')loadGl();if(v==='weight')loadWt()}
for(const k in BTN)$(BTN[k]).onclick=()=>setView(view===k?'todos':k);
$('#refresh').onclick=()=>view==='people'?loadPeople():view==='exercise'?loadEx():view==='meals'?loadMl():view==='glucose'?loadGl():view==='weight'?loadWt():load();


// ---- Due dates & reminders ----
function dueAt(t){if(!t.due)return Infinity;const [y,m,d]=t.due.split('-').map(Number);const [hh,mm]=(t.dueTime||'23:59').split(':').map(Number);return new Date(y,m-1,d,hh,mm).getTime()}
function fmtDue(t){const d=new Date(dueAt(t));let s=d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});if(t.dueTime)s+=' '+d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});return s}
const notified=()=>JSON.parse(localStorage.getItem('notified')||'{}');
function unmark(id){const n=notified();delete n[id];localStorage.setItem('notified',JSON.stringify(n))}
async function checkDue(){if(!data||!('Notification' in window)||Notification.permission!=='granted')return;const n=notified(),now=Date.now();let reg=null;
 try{reg=await navigator.serviceWorker.ready}catch(e){}
 for(const t of data.todos){if(t.status==='complete'||!t.due||!t.dueTime)continue;const at=dueAt(t),key=t.due+'T'+(t.dueTime||'');
  if(at<=now&&n[t.id]!==key){n[t.id]=key;const o={body:'List: '+t.list,tag:'todo-'+t.id,icon:'icon-192.png'};
   if(localStorage.getItem('pushOn')==='1')continue;if(reg)reg.showNotification(t.title,o);else new Notification(t.title,o)}
  else if(localStorage.getItem('pushOn')!=='1'&&at>now&&reg&&'showTrigger' in Notification.prototype&&'TimestampTrigger' in window&&n['trig_'+t.id]!==key){ // bonus: Notification Triggers
   try{reg.showNotification(t.title,{body:'List: '+t.list,tag:'todo-'+t.id,icon:'icon-192.png',showTrigger:new TimestampTrigger(at)});n['trig_'+t.id]=key;n[t.id]=key}catch(e){}}}
 localStorage.setItem('notified',JSON.stringify(n))}
function notifUI(){const b=$('#notif');if(!('Notification' in window)){b.hidden=false;$('#notifMsg').textContent='Reminders not supported here. On iPhone, open from the Home Screen icon (iOS 16.4+).';$('#notifBtn').hidden=true;return}
 const p=Notification.permission;b.hidden=p==='granted'&&localStorage.getItem('pushOn')==='1';$('#notifBtn').hidden=p==='denied';
 $('#notifMsg').textContent=p==='denied'?'Reminders are blocked. Turn on notifications for this app in your phone Settings (iPhone: Settings › Notifications › To-Dos; Android: long-press icon › App info › Notifications).':'Get a reminder when a to-do is due.'}
$('#notifBtn').onclick=async()=>{await Notification.requestPermission();notifUI();checkDue()};
setInterval(()=>{checkDue();},60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkDue();render()}});
const _render=render;render=function(){_render();checkDue()};notifUI();
navigator.serviceWorker&&navigator.serviceWorker.ready.then(async r=>{try{if('periodicSync' in r&&(await navigator.permissions.query({name:'periodic-background-sync'})).state==='granted')await r.periodicSync.register('due-check',{minInterval:15*60*1000})}catch(e){}});
$('#editForm').due.addEventListener('input',e=>{const T=$('#editForm').dueTime;T.disabled=!e.target.value;if(!e.target.value)T.value=''});

// ---- Web Push ----
const VAPID_PUBLIC='BNwHpc_ScVlB-gQxp1Riga3S52Vqg5e2ZuG6rbWeOxDHRSJyXduDNlZj9_afn3k3iDBhNXV4afG2_e49WJFU_gg';
const SAPI=`https://api.github.com/repos/${OWNER}/${REPO}/contents/subscriptions.json`;
function u8(b){const p='='.repeat((4-b.length%4)%4),s=atob((b+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(s,c=>c.charCodeAt(0))}
function pushState(m){document.querySelectorAll('.pushState').forEach(e=>e.textContent=m)}
async function saveSub(sub){const H={Authorization:'Bearer '+tok(),Accept:'application/vnd.github+json'};
 for(let i=0;i<3;i++){let sha=null,f={subscriptions:[]};const g=await fetch(SAPI+'?ref='+BRANCH+'&t='+Date.now(),{headers:H,cache:'no-store'});
  if(g.ok){const j=await g.json();sha=j.sha;f=JSON.parse(b64d(j.content));f.subscriptions=f.subscriptions||[]}else if(g.status===401||g.status===403)throw new Error('GitHub key rejected (needs Contents write on lorne-todos)');else if(g.status!==404)throw new Error('HTTP '+g.status);
  const s=sub.toJSON();if(f.subscriptions.some(x=>x.endpoint===s.endpoint))return 'exists';
  f.subscriptions.push({...s,added:now(),key:VAPID_PUBLIC.slice(0,12),ua:navigator.userAgent.slice(0,120)});
  const body={message:'Add push subscription',content:b64e(JSON.stringify(f,null,2)+'\n'),branch:BRANCH};if(sha)body.sha=sha;
  const r=await fetch(SAPI,{method:'PUT',headers:H,body:JSON.stringify(body)});if(r.ok)return 'added';if(r.status!==409&&r.status!==422)throw new Error('Save failed: HTTP '+r.status)}
 throw new Error('Save failed: conflict')}
function sameKey(sub){try{const k=sub.options&&sub.options.applicationServerKey;if(!k)return true;const a=new Uint8Array(k),b=u8(VAPID_PUBLIC);return a.length===b.length&&a.every((x,i)=>x===b[i])}catch(e){return true}}
// mode: 'auto' (on open, silent), 'tap' (Turn on push), 'fresh' (Re-register)
async function ensurePush(mode){try{
 if(!tok()){if(mode!=='auto')openSettings();return}
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window))throw new Error('Push not supported here. iPhone: add to Home Screen and open from the icon (iOS 16.4+).');
 if(mode==='auto'&&Notification.permission!=='granted')return;
 if(Notification.permission!=='granted'&&await Notification.requestPermission()!=='granted')throw new Error('Notifications are blocked — enable them in phone Settings.');
 const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
 if(sub&&(mode==='fresh'||!sameKey(sub))){await sub.unsubscribe().catch(()=>{});sub=null}
 if(!sub){if(mode==='auto'&&localStorage.getItem('pushOn')!=='1')return;pushState('Subscribing…');sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(VAPID_PUBLIC)})}
 pushState('Saving to server…');const r=await saveSub(sub);localStorage.setItem('pushOn','1');
 pushState('Saved to server ✓'+(r==='added'?' (new)':''));if(mode!=='auto')status('Push on — saved to server ✓');notifUI()}
 catch(e){if(mode!=='auto')localStorage.removeItem('pushOn');pushState('⚠ '+e.message);if(mode!=='auto')alert(e.message);notifUI()}}
document.querySelectorAll('.pushBtn').forEach(b=>b.onclick=()=>ensurePush('tap'));
document.querySelectorAll('.pushReBtn').forEach(b=>b.onclick=()=>ensurePush('fresh'));
pushState(localStorage.getItem('pushOn')==='1'?'Checking…':'');ensurePush('auto');

// ---- Exercise ----
const EAPI=`https://api.github.com/repos/${OWNER}/${REPO}/contents/exercise.json`;let ex=null,esha=null,eid=null;
const H=()=>({Authorization:'Bearer '+tok(),Accept:'application/vnd.github+json'});
function emsg(m){$('#exlist').innerHTML=`<p class="empty">${esc(m)}</p>`}
function exNorm(d){d=d||{};d.schemaVersion=d.schemaVersion||1;d.activityTypes=d.activityTypes||['walk','treadmill'];d.entries=d.entries||[];return d}
async function fetchEx(){const r=await fetch(EAPI+'?ref='+BRANCH+'&t='+Date.now(),{headers:H(),cache:'no-store'});
 if(r.status===404){ex=exNorm();esha=null;return}if(r.status===401||r.status===403)throw new Error('auth');if(!r.ok)throw new Error('HTTP '+r.status);
 const j=await r.json();esha=j.sha;ex=exNorm(JSON.parse(b64d(j.content)));localStorage.setItem('ecache',JSON.stringify(ex))}
async function loadEx(){if(!tok()){emsg('Add your GitHub key in ⚙ to load your exercise log.');return}
 if(!ex)emsg('Loading exercise log…');
 try{await fetchEx()}catch(e){const c=localStorage.getItem('ecache');
  if(c){ex=exNorm(JSON.parse(c));status('Offline/error — showing saved log ('+e.message+')')}
  else{ex=null;emsg(e.message==='auth'?'GitHub key was rejected. Update it in ⚙.':'Could not load exercise log: '+e.message+'. Tap ⟳ to retry.');return}}
 renderEx()}
async function commitEx(change,msg){if(!navigator.onLine){alert('Offline — changes need a connection');return}
 for(let i=0;i<3;i++){change(ex);renderEx();const body={message:msg,content:b64e(JSON.stringify(ex,null,2)+'\n'),branch:BRANCH};if(esha)body.sha=esha;
  const r=await fetch(EAPI,{method:'PUT',headers:H(),body:JSON.stringify(body)});
  if(r.ok){esha=(await r.json()).content.sha;localStorage.setItem('ecache',JSON.stringify(ex));status('Saved');return}
  if(r.status===409||r.status===422){status('Conflict — retrying');await fetchEx();continue}status('Save failed: HTTP '+r.status);return}
 status('Save failed after retries');await loadEx()}
const pad=n=>String(n).padStart(2,'0');
function localDT(d){d=new Date(d);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
function actOpts(sel,cur){sel.innerHTML=ex.activityTypes.map(t=>`<option${t===cur?' selected':''}>${esc(t)}</option>`).join('')+'<option value="__new">+ New type…</option>';sel.dataset.prev=sel.value}
function onAct(sel){sel.onchange=()=>{if(sel.value!=='__new'){sel.dataset.prev=sel.value;return}
 const n=(prompt('New activity type')||'').trim();if(!n){sel.value=sel.dataset.prev||ex.activityTypes[0];return}
 if(!ex.activityTypes.includes(n))ex.activityTypes.push(n);actOpts($('#exAct'),sel.id==='exAct'?n:$('#exAct').value);actOpts($('#exEAct'),sel.id==='exEAct'?n:$('#exEAct').value)}}
onAct($('#exAct'));onAct($('#exEAct'));
function renderEx(){if(!ex)return;renderTypes();const keep=$('#exAct').value;actOpts($('#exAct'),keep&&keep!=='__new'?keep:ex.activityTypes[0]);
 const F=$('#exAdd');if(!F.at.value)F.at.value=localDT(Date.now());
 if(!ex.entries.length){emsg('No entries yet — add one above.');return}
 const es=[...ex.entries].sort((a,b)=>new Date(b.at)-new Date(a.at)),days=new Map();
 for(const e of es){const k=new Date(e.at).toDateString();if(!days.has(k))days.set(k,[]);days.get(k).push(e)}
 let html='';for(const [k,list] of days){const tot=list.reduce((s,e)=>s+(+e.minutes||0),0);
  html+=`<section><h2>${esc(new Date(list[0].at).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}))} · ${tot} min</h2>`+
  list.map(e=>`<div class="item"><div class="body"><div class="t">${esc(e.activity)} — ${esc(e.minutes)} min</div><div class="meta">${esc(new Date(e.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))}</div></div><button class="ed" data-id="${esc(e.id)}">✎</button></div>`).join('')+'</section>'}
 $('#exlist').innerHTML=html;$('#exlist').querySelectorAll('.ed').forEach(b=>b.onclick=()=>openEx(b.dataset.id))}
$('#exAdd').onsubmit=ev=>{ev.preventDefault();if(!tok())return openSettings();if(!ex)return alert('Log not loaded yet — tap ⟳');const F=$('#exAdd');
 const e={id:Math.random().toString(16).slice(2,10),at:new Date(F.at.value).toISOString(),minutes:+F.minutes.value,activity:F.activity.value};
 if(!e.minutes||e.activity==='__new')return;const types=[...ex.activityTypes];F.minutes.value='';F.at.value=localDT(Date.now());
 commitEx(D=>{types.forEach(t=>{if(!D.activityTypes.includes(t))D.activityTypes.push(t)});if(!D.entries.some(x=>x.id===e.id))D.entries.push(e)},`Log ${e.minutes} min ${e.activity}`)};
function openEx(id){const e=ex.entries.find(x=>x.id===id);if(!e)return;eid=id;const F=$('#exForm');actOpts($('#exEAct'),e.activity);F.minutes.value=e.minutes;F.at.value=localDT(e.at);$('#exedit').showModal()}
$('#exedit').addEventListener('close',()=>{const v=$('#exedit').returnValue,id=eid,F=$('#exForm'),types=[...ex.activityTypes];
 if(v==='delete'){if(confirm('Delete this entry?'))commitEx(D=>{D.entries=D.entries.filter(x=>x.id!==id)},'Delete exercise entry');return}
 if(v!=='save'||F.activity.value==='__new')return;const u={activity:F.activity.value,minutes:+F.minutes.value,at:new Date(F.at.value).toISOString()};
 commitEx(D=>{types.forEach(t=>{if(!D.activityTypes.includes(t))D.activityTypes.push(t)});const x=D.entries.find(y=>y.id===id);if(x)Object.assign(x,u)},`Edit exercise ${u.activity}`)});

// ---- Meals ----
const MAPI=`https://api.github.com/repos/${OWNER}/${REPO}/contents/meals.json`;let ml=null,msha=null,mid=null;
function mmsg(m){$('#mllist').innerHTML=`<p class="empty">${esc(m)}</p>`}
const mlNorm=d=>{d=d||{};d.schemaVersion=d.schemaVersion||1;d.mealOptions=d.mealOptions||[];d.entries=d.entries||[];return d};
async function fetchMl(){const r=await fetch(MAPI+'?ref='+BRANCH+'&t='+Date.now(),{headers:H(),cache:'no-store'});
 if(r.status===404){ml=mlNorm();msha=null;return}if(r.status===401||r.status===403)throw new Error('auth');if(!r.ok)throw new Error('HTTP '+r.status);
 const j=await r.json();msha=j.sha;ml=mlNorm(JSON.parse(b64d(j.content)));localStorage.setItem('mcache',JSON.stringify(ml))}
async function loadMl(){if(!tok()){mmsg('Add your GitHub key in ⚙ to load your meals.');return}if(!ml)mmsg('Loading meals…');
 try{await fetchMl()}catch(e){const c=localStorage.getItem('mcache');if(c){ml=mlNorm(JSON.parse(c));status('Offline/error — showing saved meals ('+e.message+')')}
  else{ml=null;mmsg(e.message==='auth'?'GitHub key was rejected. Update it in ⚙.':'Could not load meals: '+e.message+'. Tap ⟳ to retry.');return}}renderMl()}
async function commitMl(change,msg){if(!navigator.onLine){alert('Offline — changes need a connection');return}
 for(let i=0;i<3;i++){change(ml);renderMl();const body={message:msg,content:b64e(JSON.stringify(ml,null,2)+'\n'),branch:BRANCH};if(msha)body.sha=msha;
  const r=await fetch(MAPI,{method:'PUT',headers:H(),body:JSON.stringify(body)});
  if(r.ok){msha=(await r.json()).content.sha;localStorage.setItem('mcache',JSON.stringify(ml));status('Saved');return}
  if(r.status===409||r.status===422){status('Conflict — retrying');await fetchMl();continue}status('Save failed: HTTP '+r.status);return}
 status('Save failed after retries');await loadMl()}
function renderMl(){if(!ml)return;renderOpts();const F=$('#mlAdd');if(!F.at.value)F.at.value=localDT(Date.now());
 if(!ml.entries.length){mmsg('No meals yet — add one above.');return}
 const es=[...ml.entries].sort((a,b)=>new Date(b.at)-new Date(a.at)),days=new Map();
 for(const e of es){const k=new Date(e.at).toDateString();if(!days.has(k))days.set(k,[]);days.get(k).push(e)}
 let html='';for(const [k,list] of days){html+=`<section><h2>${esc(new Date(list[0].at).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}))} · ${list.length} meal${list.length>1?'s':''}</h2>`+
  list.map(e=>`<div class="item"><div class="body"><div class="t">${esc(e.description)}</div><div class="meta">${esc(new Date(e.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}))}</div></div><button class="ed" data-id="${esc(e.id)}">✎</button></div>`).join('')+'</section>'}
 $('#mllist').innerHTML=html;$('#mllist').querySelectorAll('.ed').forEach(b=>b.onclick=()=>openMl(b.dataset.id))}
$('#mlAdd').onsubmit=ev=>{ev.preventDefault();if(!tok())return openSettings();if(!ml)return alert('Meals not loaded yet — tap ⟳');const F=$('#mlAdd');
 const e={id:Math.random().toString(16).slice(2,10),at:new Date(F.at.value).toISOString(),description:F.description.value.trim()};if(!e.description)return;
 F.description.value='';F.at.value=localDT(Date.now());commitMl(D=>{if(!D.entries.some(x=>x.id===e.id))D.entries.push(e)},'Log meal')};
function openMl(id){const e=ml.entries.find(x=>x.id===id);if(!e)return;mid=id;const F=$('#mlForm');F.description.value=e.description;F.at.value=localDT(e.at);$('#mledit').showModal()}
$('#mledit').addEventListener('close',()=>{const v=$('#mledit').returnValue,id=mid,F=$('#mlForm');
 if(v==='delete'){if(confirm('Delete this meal?'))commitMl(D=>{D.entries=D.entries.filter(x=>x.id!==id)},'Delete meal');return}
 if(v!=='save')return;const u={description:F.description.value.trim(),at:new Date(F.at.value).toISOString()};if(!u.description)return;
 commitMl(D=>{const x=D.entries.find(y=>y.id===id);if(x)Object.assign(x,u)},'Edit meal')});

// ---- Exercise types ----
function renderTypes(){$('#typeList').innerHTML=ex.activityTypes.map((t,i)=>`<div class="item"><div class="body"><div class="t">${esc(t)}</div><div class="meta">${ex.entries.filter(e=>e.activity===t).length} entries</div></div><button class="ed" data-i="${i}">✎</button></div>`).join('')||'<p class="empty">No types yet.</p>';
 $('#typeList').querySelectorAll('.ed').forEach(b=>b.onclick=()=>editType(ex.activityTypes[+b.dataset.i]))}
function editType(old){const n=prompt(`Rename "${old}" (leave empty to remove the type; past entries keep their name)`,old);if(n===null)return;const v=n.trim();
 if(!v){if(!confirm(`Remove type "${old}"?`))return;return commitEx(D=>{D.activityTypes=D.activityTypes.filter(t=>t!==old)},`Remove exercise type ${old}`)}
 if(v===old)return;commitEx(D=>{const i=D.activityTypes.indexOf(old);if(i<0)return;if(D.activityTypes.includes(v))D.activityTypes.splice(i,1);else D.activityTypes[i]=v;
  D.entries.forEach(e=>{if(e.activity===old)e.activity=v})},`Rename exercise type ${old} → ${v}`)}
$('#addType').onclick=()=>{if(!tok())return openSettings();if(!ex)return alert('Log not loaded yet — tap ⟳');const v=(prompt('New activity type')||'').trim();if(!v)return;
 commitEx(D=>{if(!D.activityTypes.includes(v))D.activityTypes.push(v)},`Add exercise type ${v}`)};

// ---- Glucose (read-only; synced by GitHub Action) ----
const GAPI=`https://api.github.com/repos/${OWNER}/${REPO}/contents/glucose.json`;let gl=null,glRange=localStorage.getItem('glRange')||'day';
function gmsg(m){$('#glCur').innerHTML=`<p class="empty">${esc(m)}</p>`;$('#glChart').innerHTML='';$('#glInfo').textContent=''}
async function loadGl(){if(!tok()){gmsg('Add your GitHub key in ⚙ to load glucose.');return}if(!gl)gmsg('Loading glucose…');
 try{const r=await fetch(GAPI+'?ref='+BRANCH+'&t='+Date.now(),{headers:{Authorization:'Bearer '+tok(),Accept:'application/vnd.github.raw+json'},cache:'no-store'});
  if(r.status===404){gl=null;gmsg('No glucose data yet. Once the LibreLinkUp secrets are added, the first sync appears within ~15 min.');return}
  if(r.status===401||r.status===403)throw new Error('auth');if(!r.ok)throw new Error('HTTP '+r.status);
  gl=await r.json();try{localStorage.setItem('gcache',JSON.stringify({...gl,readings:gl.readings.slice(-9000)}))}catch(e){}}
 catch(e){const c=localStorage.getItem('gcache');if(c){gl=JSON.parse(c);status('Offline/error — showing saved glucose ('+e.message+')')}
  else{gmsg(e.message==='auth'?'GitHub key was rejected. Update it in ⚙.':'Could not load glucose: '+e.message+'. Tap ⟳ to retry.');return}}
 renderGl()}
const ARROW={1:'↓',2:'↘',3:'→',4:'↗',5:'↑'};
function ago(t){const m=Math.round((Date.now()-Date.parse(t))/60000);return m<1?'just now':m<60?m+' min ago':m<1440?Math.floor(m/60)+' h '+(m%60)+' min ago':Math.floor(m/1440)+' days ago'}
const mm=r=>r.mmol??Math.round(r.mgdl/18.0182*10)/10;
function renderGl(){if(!gl)return;const c=gl.current||(gl.readings||[]).slice(-1)[0];
 if(!c){gmsg(gl.lastError?'Sync problem: '+gl.lastError.message:'No readings yet.');return}
 const v=mm(c),cls=v<3.9?'low':v>10?'high':'ok',old=Date.now()-Date.parse(c.t)>20*60000;
 $('#glCur').innerHTML=`<div class="big ${cls}">${v.toFixed(1)}<span class="arr">${ARROW[c.trend]||''}</span></div><div class="unit">mmol/L · ${esc(c.mgdl)} mg/dL</div><div class="meta${old?' stale':''}">${esc(ago(c.t))}${old?' — sensor/sync may be behind':''}</div>`;
 document.querySelectorAll('#glucose .seg button').forEach(b=>b.classList.toggle('on',b.dataset.r===glRange));
 const now=Date.now(),d0=new Date();d0.setHours(0,0,0,0);const from=glRange==='day'?d0.getTime():now-(glRange==='week'?7:30)*864e5;
 const pts=(gl.readings||[]).filter(r=>Date.parse(r.t)>=from);
 const W=360,Hh=200,pl=28,pb=18,ymax=Math.max(14,...pts.map(mm))+1,ymin=2,to=glRange==='day'?d0.getTime()+864e5:now;
 const X=t=>pl+(t-from)/(to-from)*(W-pl-4),Y=v=>(Hh-pb)-(v-ymin)/(ymax-ymin)*(Hh-pb-6);
 let s=`<svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Glucose chart"><rect x="${pl}" y="${Y(10)}" width="${W-pl-4}" height="${Y(3.9)-Y(10)}" fill="#10b98122"/>`;
 for(const g of [4,6,8,10,12,14,16,18].filter(g=>g<ymax))s+=`<line x1="${pl}" x2="${W-4}" y1="${Y(g)}" y2="${Y(g)}" stroke="#e5e7eb"/><text x="2" y="${Y(g)+4}" font-size="10" fill="#888">${g}</text>`;
 const ticks=glRange==='day'?[0,6,12,18].map(h=>[d0.getTime()+h*36e5,h===0?'12a':h===12?'12p':(h%12)+(h<12?'a':'p')]):[...Array(glRange==='week'?7:5)].map((_,i,A)=>{const t=from+(i+0.5)*(to-from)/A.length;return [t,new Date(t).toLocaleDateString(undefined,{month:'numeric',day:'numeric'})]});
 for(const [t,l] of ticks)s+=`<text x="${X(t)}" y="${Hh-4}" font-size="10" fill="#888" text-anchor="middle">${l}</text>`;
 if(pts.length){let dpath='',prev=null;for(const r of pts){const t=Date.parse(r.t);dpath+=(prev&&t-prev<40*60000?'L':'M')+X(t).toFixed(1)+','+Y(mm(r)).toFixed(1);prev=t}
  s+=`<path d="${dpath}" fill="none" stroke="#2563eb" stroke-width="${glRange==='day'?2:1.2}"/>`;
  const inR=pts.filter(r=>mm(r)>=3.9&&mm(r)<=10).length;$('#glInfo').textContent=`${pts.length} readings · ${Math.round(inR/pts.length*100)}% in range (3.9–10.0)`+(gl.lastSync?` · synced ${ago(gl.lastSync)}`:'')}
 else $('#glInfo').textContent='No readings in this range.'+(gl.lastSync?` Synced ${ago(gl.lastSync)}.`:'');
 if(gl.lastError)$('#glInfo').textContent+=` · ⚠ ${gl.lastError.message}`;
 $('#glChart').innerHTML=s+'</svg>'}
document.querySelectorAll('#glucose .seg button').forEach(b=>b.onclick=()=>{glRange=b.dataset.r;localStorage.setItem('glRange',glRange);renderGl()});
setInterval(()=>{if(view==='glucose'&&!document.hidden)loadGl()},5*60000);

// ---- Meal options ----
function renderOpts(){const o=ml.mealOptions;
 $('#mlChips').innerHTML=o.map((t,i)=>`<button type="button" class="chip" data-i="${i}">${esc(t)}</button>`).join('');
 $('#mlChips').querySelectorAll('.chip').forEach(b=>b.onclick=()=>{$('#mlAdd').description.value=ml.mealOptions[+b.dataset.i];$('#mlAdd').description.focus()});
 $('#mlOpts').innerHTML=o.map(t=>`<option value="${esc(t)}">`).join('');
 $('#optList').innerHTML=o.map((t,i)=>`<div class="item"><div class="body"><div class="t">${esc(t)}</div></div><button class="ed" data-i="${i}">✎</button></div>`).join('')||'<p class="empty">No options yet.</p>';
 $('#optList').querySelectorAll('.ed').forEach(b=>b.onclick=()=>editOpt(ml.mealOptions[+b.dataset.i]))}
function editOpt(old){const n=prompt(`Rename "${old}" (leave empty to remove; past meals are unchanged)`,old);if(n===null)return;const v=n.trim();
 if(!v){if(!confirm(`Remove option "${old}"?`))return;return commitMl(D=>{D.mealOptions=D.mealOptions.filter(t=>t!==old)},`Remove meal option ${old}`)}
 if(v===old)return;commitMl(D=>{const i=D.mealOptions.indexOf(old);if(i<0)return;if(D.mealOptions.includes(v))D.mealOptions.splice(i,1);else D.mealOptions[i]=v},`Rename meal option ${old} → ${v}`)}
$('#addOpt').onclick=()=>{if(!tok())return openSettings();if(!ml)return alert('Meals not loaded yet — tap ⟳');const v=(prompt('New meal option')||'').trim();if(!v)return;
 commitMl(D=>{D.mealOptions=D.mealOptions||[];if(!D.mealOptions.includes(v))D.mealOptions.push(v)},`Add meal option ${v}`)};

// ---- Weight (Withings; synced by GitHub Action) ----
const W_REDIRECT='https://lorneshantz.github.io/lorne-todos-app/';
const RAW=f=>`https://api.github.com/repos/${OWNER}/${REPO}/contents/${f}`;
let wt=null,wtRange=localStorage.getItem('wtRange')||'month';
async function ghRaw(f){const r=await fetch(RAW(f)+'?ref='+BRANCH+'&t='+Date.now(),{headers:{Authorization:'Bearer '+tok(),Accept:'application/vnd.github.raw+json'},cache:'no-store'});
 if(r.status===404)return null;if(r.status===401||r.status===403)throw new Error('auth');if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}
async function ghPut(f,obj,msg){const H={Authorization:'Bearer '+tok(),Accept:'application/vnd.github+json'};
 for(let i=0;i<3;i++){let sha=null;const g=await fetch(RAW(f)+'?ref='+BRANCH+'&t='+Date.now(),{headers:H,cache:'no-store'});if(g.ok)sha=(await g.json()).sha;else if(g.status!==404)throw new Error('HTTP '+g.status);
  const body={message:msg,content:b64e(JSON.stringify(obj,null,2)+'\n'),branch:BRANCH};if(sha)body.sha=sha;const r=await fetch(RAW(f),{method:'PUT',headers:H,body:JSON.stringify(body)});
  if(r.ok)return;if(r.status!==409&&r.status!==422)throw new Error('Save failed: HTTP '+r.status)}throw new Error('Save failed: conflict')}
function wmsg(m){$('#wtCur').innerHTML=`<p class="empty">${esc(m)}</p>`;$('#wtChart').innerHTML='';$('#wtInfo').textContent='';$('#wtComp').innerHTML=''}
async function withingsConnect(){try{if(!tok())return openSettings();let cid=null;
 try{const c=await ghRaw('withings-config.json');cid=c&&c.clientId}catch(e){}
 cid=cid||localStorage.getItem('withingsClientId');
 if(!cid){cid=(prompt('Paste your Withings client ID (from developer.withings.com). Or wait ~15 min after adding the GitHub secrets and try again.')||'').trim();if(!cid)return;localStorage.setItem('withingsClientId',cid)}
 const st=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem('wstate',st);
 location.href='https://account.withings.com/oauth2_user/authorize2?'+new URLSearchParams({response_type:'code',client_id:cid,scope:'user.metrics',redirect_uri:W_REDIRECT,state:st})}
 catch(e){alert('Could not start Withings connect: '+e.message)}}
document.querySelectorAll('.wConnect').forEach(b=>b.onclick=withingsConnect);
async function withingsCallback(){const q=new URLSearchParams(location.search);if(!q.has('code')&&!q.has('error'))return;
 const code=q.get('code'),st=q.get('state'),err=q.get('error');history.replaceState(null,'',location.pathname+location.hash);
 if(err){alert('Withings connect cancelled: '+err);return}
 if(!st||st!==localStorage.getItem('wstate')){alert('Withings connect failed: state mismatch. Tap Connect Withings again.');return}
 localStorage.removeItem('wstate');if(!tok()){alert('Add your GitHub key in ⚙ first, then tap Connect Withings again.');return}
 try{await ghPut('withings-auth.json',{code,redirect_uri:W_REDIRECT,at:now()},'Withings auth code');localStorage.setItem('wConnecting',String(Date.now()));setView('weight');status('Withings: connecting… up to ~15 min')}
 catch(e){alert('Could not save Withings connection: '+e.message)}}
const LB=2.20462;
async function loadWt(){if(!tok()){wmsg('Add your GitHub key in ⚙ to load weight.');return}if(!wt)wmsg('Loading weight…');
 try{wt=await ghRaw('weight-history.json');if(wt)localStorage.setItem('wcache',JSON.stringify(wt))}
 catch(e){const c=localStorage.getItem('wcache');if(c){wt=JSON.parse(c);status('Offline/error — showing saved weight ('+e.message+')')}
  else{wmsg(e.message==='auth'?'GitHub key was rejected. Update it in ⚙.':'Could not load weight: '+e.message+'. Tap ⟳ to retry.');return}}
 renderWt()}
function renderWt(){const conn=+localStorage.getItem('wConnecting')||0,b=$('#wtBanner');
 if(wt&&wt.lastSync&&Date.parse(wt.lastSync)>conn&&!wt.needsReconnect)localStorage.removeItem('wConnecting');
 const connecting=localStorage.getItem('wConnecting')&&Date.now()-conn<60*60000;
 b.hidden=false;if(connecting)b.textContent='Connecting to Withings… this can take up to ~15 min.';
 else if(wt&&wt.needsReconnect){b.innerHTML=`⚠ ${esc((wt.lastError&&wt.lastError.message)||'Withings needs reconnecting.')} <button type="button" class="wConnect">Reconnect Withings</button>`;b.querySelector('.wConnect').onclick=withingsConnect}
 else b.hidden=true;
 const rs=(wt&&wt.readings||[]).filter(r=>r.weightKg!=null);
 if(!rs.length){wmsg(connecting?'Waiting for the first Withings sync…':!wt?'No weight data yet. Add the Withings secrets in GitHub, then tap Connect Withings below.':'No weigh-ins yet. Step on the scale and wait for the next sync.');if(wt&&wt.lastError&&!wt.needsReconnect)$('#wtInfo').textContent='⚠ '+wt.lastError.message;return}
 const c=rs.at(-1),now=Date.now(),wk=rs.filter(r=>Date.parse(r.t)>=now-7*864e5),avg=wk.reduce((s,r)=>s+r.weightKg,0)/(wk.length||1);
 const d=c.weightKg-avg,arr=Math.abs(d)<0.25?'→':d>0?'↗':'↘';
 $('#wtCur').innerHTML=`<div class="big wt">${(c.weightKg*LB).toFixed(1)}<span class="u"> lb</span><span class="arr">${arr}</span></div><div class="unit">${c.weightKg.toFixed(1)} kg · 7-day avg ${(avg*LB).toFixed(1)} lb</div><div class="meta">${esc(ago(c.t))}</div>`;
 document.querySelectorAll('#wtSeg button').forEach(x=>x.classList.toggle('on',x.dataset.r===wtRange));
 const d0=new Date();d0.setHours(0,0,0,0);const from=wtRange==='day'?d0.getTime():now-(wtRange==='week'?7:30)*864e5,to=wtRange==='day'?d0.getTime()+864e5:now;
 const pts=rs.filter(r=>Date.parse(r.t)>=from),W=360,Hh=200,pl=34,pb=18;
 if(!pts.length){$('#wtChart').innerHTML='';$('#wtInfo').textContent='No weigh-ins in this range.'}
 else{const vs=pts.map(r=>r.weightKg*LB);let lo=Math.min(...vs),hi=Math.max(...vs);if(hi-lo<4){const m=(hi+lo)/2;lo=m-2;hi=m+2}lo=Math.floor(lo-0.5);hi=Math.ceil(hi+0.5);
  const X=t=>pl+(t-from)/(to-from)*(W-pl-6),Y=v=>(Hh-pb)-(v-lo)/(hi-lo)*(Hh-pb-8);let s=`<svg viewBox="0 0 ${W} ${Hh}" width="100%" role="img" aria-label="Weight chart">`;
  const step=Math.max(1,Math.ceil((hi-lo)/5));for(let g=Math.ceil(lo);g<=hi;g+=step)s+=`<line x1="${pl}" x2="${W-4}" y1="${Y(g)}" y2="${Y(g)}" stroke="#e5e7eb"/><text x="2" y="${Y(g)+4}" font-size="10" fill="#888">${g}</text>`;
  const pathD=pts.map((r,i)=>(i?'L':'M')+X(Date.parse(r.t)).toFixed(1)+','+Y(r.weightKg*LB).toFixed(1)).join('');
  s+=`<path d="${pathD}" fill="none" stroke="#7c3aed" stroke-width="2"/>`+pts.map(r=>`<circle cx="${X(Date.parse(r.t)).toFixed(1)}" cy="${Y(r.weightKg*LB).toFixed(1)}" r="3" fill="#7c3aed"/>`).join('');
  $('#wtChart').innerHTML=s+'</svg>';$('#wtInfo').textContent=`${pts.length} weigh-in${pts.length>1?'s':''}`+(wt.lastSync?` · synced ${ago(wt.lastSync)}`:'')+(wt.lastError&&!wt.needsReconnect?` · ⚠ ${wt.lastError.message}`:'')}
 const comp=[['fatPct','Body fat',v=>v.toFixed(1)+' %'],['fatKg','Fat mass',v=>(v*LB).toFixed(1)+' lb'],['muscleKg','Muscle',v=>(v*LB).toFixed(1)+' lb'],['waterKg','Water',v=>(v*LB).toFixed(1)+' lb'],['boneKg','Bone',v=>(v*LB).toFixed(1)+' lb'],['fatFreeKg','Fat-free mass',v=>(v*LB).toFixed(1)+' lb']];
 const last=k=>{for(let i=rs.length-1;i>=0;i--)if(rs[i][k]!=null)return rs[i][k];return null};const rows=comp.filter(([k])=>last(k)!=null);
 $('#wtComp').innerHTML=rows.length?'<section><h2>Body composition</h2>'+rows.map(([k,l,f])=>`<div class="item"><div class="body"><div class="t">${l}</div></div><div>${f(last(k))}</div></div>`).join('')+'</section>':''}
document.querySelectorAll('#wtSeg button').forEach(b=>b.onclick=()=>{wtRange=b.dataset.r;localStorage.setItem('wtRange',wtRange);renderWt()});
withingsCallback();
setView(view);loadPeople();

// ---- Recurring to-dos ----
const newId=()=>Math.random().toString(16).slice(2,10);
const pd=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const fd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const dim=(y,m)=>new Date(y,m+1,0).getDate();
function nextDue(rc,dueStr){const base=dueStr?pd(dueStr):(()=>{const d=new Date();d.setHours(0,0,0,0);return d})();const n=Math.max(1,+rc.interval||1);
 if(rc.type==='daily'){const d=new Date(base);d.setDate(d.getDate()+n);return fd(d)}
 if(rc.type==='weekly'){const w=rc.weekday??base.getDay();const d=new Date(base);do d.setDate(d.getDate()+1);while(d.getDay()!==w);d.setDate(d.getDate()+7*(n-1));return fd(d)}
 if(rc.type==='monthly'){const md=rc.monthDay||base.getDate();let y=base.getFullYear(),m=base.getMonth()+n;y+=Math.floor(m/12);m%=12;return fd(new Date(y,m,Math.min(md,dim(y,m))))}
 if(rc.type==='yearly'){const y=base.getFullYear()+n,m=base.getMonth();return fd(new Date(y,m,Math.min(base.getDate(),dim(y,m))))}return null}
function spawnNext(D,x,nid){if(!x.recurrence||x.spawnedNext)return;if(D.todos.some(y=>y.id===nid))return;
 const c={id:nid,title:x.title,list:x.list,steps:[...(x.steps||[])],status:'open',recurrence:{...x.recurrence},due:nextDue(x.recurrence,x.due),added:now(),updated:now(),spawnedFrom:x.id};
 if(x.assignee)c.assignee=x.assignee;if(x.dueTime)c.dueTime=x.dueTime;D.todos.push(c);x.spawnedNext=nid}
function readRec(F){const t=F.rtype.value;if(!t)return null;const r={type:t,interval:Math.max(1,+F.rint.value||1)};
 if(t==='weekly')r.weekday=+F.rwd.value;if(t==='monthly')r.monthDay=Math.min(31,Math.max(1,+F.rmd.value||1));return r}
function rUI(){const F=$('#editForm'),t=F.rtype.value;$('#rwdL').hidden=t!=='weekly';$('#rmdL').hidden=t!=='monthly';F.rint.disabled=!t}
$('#editForm').rtype.addEventListener('change',rUI);

// ---- Bring up to date ----
const todayStr=()=>fd(new Date());
const isOverdueRec=t=>!!(t.recurrence&&t.status!=='complete'&&t.due&&t.due<todayStr()&&!t.spawnedNext);
function catchUpCalc(rc,due){const td=todayStr();let d=due,skipped=0,guard=0;while(d<td&&guard++<5000){skipped++;d=nextDue(rc,d)}return {skipped,next:d}}
function catchUpItem(id){const nid=newId();if($('#edit').open)$('#edit').close('cancel');
 commit(D=>{const x=D.todos.find(y=>y.id===id);if(!x||!isOverdueRec(x))return;const c=catchUpCalc(x.recurrence,x.due);
  x.status='complete';x.updated=now();x.skippedCount=c.skipped;spawnNext(D,x,nid);const n=D.todos.find(y=>y.id===nid);if(n)n.due=c.next},'Bring up to date');}
$('#catchBtn').onclick=()=>catchUpItem(editing);
