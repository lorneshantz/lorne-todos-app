const OWNER='lorneshantz',REPO='lorne-todos',PATH='todos.json',BRANCH='main';
const API=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
const $=s=>document.querySelector(s);let data=null,sha=null,editing=null;
const tok=()=>localStorage.getItem('gh_token');
const b64d=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g,'')),c=>c.charCodeAt(0)));
const b64e=s=>{const b=new TextEncoder().encode(s);let r='';b.forEach(x=>r+=String.fromCharCode(x));return btoa(r)};
const now=()=>new Date().toISOString();const status=m=>$('#status').textContent=m||'';
function norm(d){d=d||{};d.schemaVersion=d.schemaVersion||1;d.todos=(d.todos||[]).map(t=>({steps:[],status:'open',list:'Inbox',...t}));
 const s=new Set(d.lists||['Inbox']);d.todos.forEach(t=>s.add(t.list));d.lists=[...s];d.favorites=(d.favorites||[]).filter(x=>d.lists.includes(x));if(d.schemaVersion<3)d.schemaVersion=3;return d}
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
   d.innerHTML=`<button class="chk">${t.status==='complete'?'✓':''}</button><div class="body"><div class="t">${esc(t.title)}</div>
   <div class="meta">${t.assignee?'👤 '+esc(t.assignee)+' ':''}${t.due?`<span class="due${t.status!=='complete'&&dueAt(t)<Date.now()?' late':''}">📅 ${esc(fmtDue(t))}</span>`:''}</div>${t.steps&&t.steps.length?'<ul>'+t.steps.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>':''}</div><button class="ed">✎</button>`;
   d.querySelector('.chk').onclick=()=>commit(D=>{const x=D.todos.find(y=>y.id===t.id);if(x){x.status=x.status==='complete'?'open':'complete';x.updated=now()}},`Toggle ${t.title}`);
   d.querySelector('.ed').onclick=()=>openEdit(t);s.appendChild(d)}m.appendChild(s)}
 if(!any)m.innerHTML='<p style="padding:14px;color:#666">Nothing to show.</p>'}
function openEdit(t){editing=t.id;const F=$('#editForm');F.title.value=t.title;F.list.value=t.list;F.assignee.value=t.assignee||'';F.steps.value=(t.steps||[]).join('\n');F.status.value=t.status;F.due.value=t.due||'';F.dueTime.value=t.due?(t.dueTime||''):'';F.dueTime.disabled=!t.due;$('#edit').showModal()}
$('#edit').addEventListener('close',()=>{if($('#edit').returnValue!=='save')return;const F=$('#editForm'),id=editing;
 const v={title:F.title.value.trim(),list:F.list.value.trim()||'Inbox',assignee:F.assignee.value.trim(),steps:F.steps.value.split('\n').map(s=>s.trim()).filter(Boolean),status:F.status.value,due:F.due.value||'',dueTime:F.due.value?(F.dueTime.value||''):''};
 commit(D=>{const x=D.todos.find(y=>y.id===id);if(!x)return;const oldDue=x.due,oldTime=x.dueTime;Object.assign(x,v,{updated:now()});if(!x.assignee)delete x.assignee;if(!x.due)delete x.due;if(!x.dueTime||!x.due)delete x.dueTime;if(x.due!==oldDue||x.dueTime!==oldTime)unmark(x.id);if(!D.lists.includes(v.list))D.lists.push(v.list)},`Edit ${v.title}`)});
function openSettings(){$('#setForm').token.value='';$('#settings').showModal()}
$('#settings').addEventListener('close',()=>{const v=$('#settings').returnValue;
 if(v==='save'){const t=$('#setForm').token.value.trim();if(t){localStorage.setItem('gh_token',t);load();people=null;loadPeople()}}
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
function setView(v){view=v;localStorage.setItem('view',v);const p=v==='people',x=v==='exercise',m=v==='meals';
 $('#people').hidden=!p;$('#exercise').hidden=!x;$('#meals').hidden=!m;$('#lists').hidden=p||x||m;$('#bar').hidden=p||x||m;
 $('#ttl').textContent=p?'People':x?'Exercise':m?'Meals':'To-Dos';$('#tabBtn').textContent=p?'☑':'👥';$('#exBtn').textContent=x?'☑':'🏃';$('#mlBtn').textContent=m?'☑':'🍽';
 if(p)loadPeople();if(x)loadEx();if(m)loadMl()}
$('#tabBtn').onclick=()=>setView(view==='people'?'todos':'people');$('#exBtn').onclick=()=>setView(view==='exercise'?'todos':'exercise');$('#mlBtn').onclick=()=>setView(view==='meals'?'todos':'meals');
$('#refresh').onclick=()=>view==='people'?loadPeople():view==='exercise'?loadEx():view==='meals'?loadMl():load();


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
const VAPID_PUBLIC='BMtG5QeCMcwcbWvjm_PeF63JA_0gTYoNcCTBLZRBWqQoEDkrT2UkDiqYEhI9FN0XR6XdXu3ykBORpQ9rT_btdno';
const SAPI=`https://api.github.com/repos/${OWNER}/${REPO}/contents/subscriptions.json`;
function u8(b){const p='='.repeat((4-b.length%4)%4),s=atob((b+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(s,c=>c.charCodeAt(0))}
function pushState(m){document.querySelectorAll('.pushState').forEach(e=>e.textContent=m);document.querySelectorAll('.pushBtn').forEach(b=>b.textContent=localStorage.getItem('pushOn')==='1'?'Push is on ✓ (re-register)':'Turn on push')}
async function saveSub(sub){const H={Authorization:'Bearer '+tok(),Accept:'application/vnd.github+json'};
 for(let i=0;i<3;i++){let sha=null,f={subscriptions:[]};const g=await fetch(SAPI+'?ref='+BRANCH+'&t='+Date.now(),{headers:H,cache:'no-store'});
  if(g.ok){const j=await g.json();sha=j.sha;f=JSON.parse(b64d(j.content));f.subscriptions=f.subscriptions||[]}else if(g.status!==404)throw new Error('HTTP '+g.status);
  const s=sub.toJSON();if(f.subscriptions.some(x=>x.endpoint===s.endpoint))return;f.subscriptions.push({...s,added:now(),ua:navigator.userAgent.slice(0,120)});
  const body={message:'Add push subscription',content:b64e(JSON.stringify(f,null,2)+'\n'),branch:BRANCH};if(sha)body.sha=sha;
  const r=await fetch(SAPI,{method:'PUT',headers:H,body:JSON.stringify(body)});if(r.ok)return;if(r.status!==409&&r.status!==422)throw new Error('HTTP '+r.status)}
 throw new Error('conflict')}
async function turnOnPush(){try{if(!tok())return openSettings();
 if(!('serviceWorker' in navigator)||!('PushManager' in window))throw new Error('Push not supported here. iPhone: add to Home Screen and open from the icon (iOS 16.4+).');
 if(await Notification.requestPermission()!=='granted')throw new Error('Notifications are blocked — enable them in phone Settings.');
 const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
 if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:u8(VAPID_PUBLIC)});
 pushState('Saving…');await saveSub(sub);localStorage.setItem('pushOn','1');pushState('Push is on for this device.');notifUI();status('Push turned on')}
 catch(e){pushState(e.message);alert(e.message)}}
document.querySelectorAll('.pushBtn').forEach(b=>b.onclick=turnOnPush);pushState('');

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
const mlNorm=d=>{d=d||{};d.schemaVersion=d.schemaVersion||1;d.entries=d.entries||[];return d};
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
function renderMl(){if(!ml)return;const F=$('#mlAdd');if(!F.at.value)F.at.value=localDT(Date.now());
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
setView(view);loadPeople();
