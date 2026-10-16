const OWNER='lorneshantz',REPO='lorne-todos',PATH='todos.json',BRANCH='main';
const API=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
const $=s=>document.querySelector(s);let data=null,sha=null,editing=null;
const tok=()=>localStorage.getItem('gh_token');
const b64d=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g,'')),c=>c.charCodeAt(0)));
const b64e=s=>{const b=new TextEncoder().encode(s);let r='';b.forEach(x=>r+=String.fromCharCode(x));return btoa(r)};
const now=()=>new Date().toISOString();const status=m=>$('#status').textContent=m||'';
function norm(d){d=d||{};d.schemaVersion=d.schemaVersion||1;d.todos=(d.todos||[]).map(t=>({steps:[],status:'open',list:'Inbox',...t}));
 const s=new Set(d.lists||['Inbox']);d.todos.forEach(t=>s.add(t.list));d.lists=[...s];return d}
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
function render(){const m=$('#lists');m.innerHTML='';if(!data)return;
 const f=$('#filter').value.trim().toLowerCase(),showDone=$('#showDone').checked;
 const as=new Set(data.todos.map(t=>t.assignee).filter(Boolean));$('#assignees').innerHTML=[...as].map(a=>`<option value="${esc(a)}">`).join('');
 $('#listNames').innerHTML=data.lists.map(a=>`<option value="${esc(a)}">`).join('');
 let any=false;for(const L of data.lists){const items=data.todos.filter(t=>t.list===L&&(showDone||t.status!=='complete')&&(!f||(t.assignee||'').toLowerCase().includes(f)));
  if(!items.length)continue;any=true;const s=document.createElement('section');s.innerHTML=`<h2>${esc(L)} (${items.length})</h2>`;
  for(const t of items){const d=document.createElement('div');d.className='item'+(t.status==='complete'?' done':'');
   d.innerHTML=`<button class="chk">${t.status==='complete'?'✓':''}</button><div class="body"><div class="t">${esc(t.title)}</div>
   <div class="meta">${t.assignee?'👤 '+esc(t.assignee):''}</div>${t.steps&&t.steps.length?'<ul>'+t.steps.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>':''}</div><button class="ed">✎</button>`;
   d.querySelector('.chk').onclick=()=>commit(D=>{const x=D.todos.find(y=>y.id===t.id);if(x){x.status=x.status==='complete'?'open':'complete';x.updated=now()}},`Toggle ${t.title}`);
   d.querySelector('.ed').onclick=()=>openEdit(t);s.appendChild(d)}m.appendChild(s)}
 if(!any)m.innerHTML='<p style="padding:14px;color:#666">Nothing to show.</p>'}
function openEdit(t){editing=t.id;const F=$('#editForm');F.title.value=t.title;F.list.value=t.list;F.assignee.value=t.assignee||'';F.steps.value=(t.steps||[]).join('\n');F.status.value=t.status;$('#edit').showModal()}
$('#edit').addEventListener('close',()=>{if($('#edit').returnValue!=='save')return;const F=$('#editForm'),id=editing;
 const v={title:F.title.value.trim(),list:F.list.value.trim()||'Inbox',assignee:F.assignee.value.trim(),steps:F.steps.value.split('\n').map(s=>s.trim()).filter(Boolean),status:F.status.value};
 commit(D=>{const x=D.todos.find(y=>y.id===id);if(!x)return;Object.assign(x,v,{updated:now()});if(!x.assignee)delete x.assignee;if(!D.lists.includes(v.list))D.lists.push(v.list)},`Edit ${v.title}`)});
function openSettings(){$('#setForm').token.value='';$('#settings').showModal()}
$('#settings').addEventListener('close',()=>{const v=$('#settings').returnValue;
 if(v==='save'){const t=$('#setForm').token.value.trim();if(t){localStorage.setItem('gh_token',t);load()}}
 if(v==='signout'){localStorage.removeItem('gh_token');localStorage.removeItem('cache');data=null;render();status('Signed out')}});
$('#settingsBtn').onclick=openSettings;$('#refresh').onclick=load;$('#filter').oninput=render;
$('#showDone').checked=localStorage.getItem('showDone')==='1';$('#showDone').onchange=e=>{localStorage.setItem('showDone',e.target.checked?'1':'0');render()};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');load();
