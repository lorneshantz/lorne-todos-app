const OWNER='lorneshantz',REPO='lorne-todos',PATH='todos.json',BRANCH='main';
const API=`https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
const $=s=>document.querySelector(s);let data=null,sha=null,editing=null;
const tok=()=>localStorage.getItem('gh_token');
const b64d=s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g,'')),c=>c.charCodeAt(0)));
const b64e=s=>{const b=new TextEncoder().encode(s);let r='';b.forEach(x=>r+=String.fromCharCode(x));return btoa(r)};
const now=()=>new Date().toISOString();const status=m=>$('#status').textContent=m||'';
function norm(d){d=d||{};d.schemaVersion=d.schemaVersion||1;d.todos=(d.todos||[]).map(t=>({steps:[],status:'open',list:'Inbox',...t}));
 const s=new Set(d.lists||['Inbox']);d.todos.forEach(t=>s.add(t.list));d.lists=[...s];d.favorites=(d.favorites||[]).filter(x=>d.lists.includes(x));if(d.schemaVersion<2)d.schemaVersion=2;return d}
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
function render(){const m=$('#lists');m.innerHTML='';if(!data)return;
 const f=$('#filter').value.trim().toLowerCase(),showDone=$('#showDone').checked;
 const as=new Set(data.todos.map(t=>t.assignee).filter(Boolean));$('#assignees').innerHTML=[...as].map(a=>`<option value="${esc(a)}">`).join('');
 $('#listNames').innerHTML=sorted(data).map(a=>`<option value="${esc(a)}">`).join('');
 let any=false;for(const L of sorted(data)){const items=data.todos.filter(t=>t.list===L&&(showDone||t.status!=='complete')&&(!f||(t.assignee||'').toLowerCase().includes(f)));
  any=true;const fav=data.favorites.includes(L);const s=document.createElement('section');s.innerHTML=`<h2><button class="star${fav?' on':''}" title="${fav?'Unstar':'Star'} list">${fav?'★':'☆'}</button> ${esc(L)} (${items.length})</h2>`;
  s.querySelector('.star').onclick=()=>commit(D=>{const i=D.favorites.indexOf(L);if(i>=0)D.favorites.splice(i,1);else D.favorites.push(L)},`${fav?'Unstar':'Star'} list ${L}`);
  if(!items.length){const e=document.createElement('p');e.className='empty';e.textContent='No items';s.appendChild(e)}
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
// ---- People ----
const PAPI=`https://api.github.com/repos/${OWNER}/${REPO}/contents/people.json`;
let people=null,psha=null,pidx=null,view=localStorage.getItem('view')||'todos';
async function fetchPeople(){const r=await fetch(PAPI+'?ref='+BRANCH+'&t='+Date.now(),{headers:{Authorization:'Bearer '+tok(),Accept:'application/vnd.github+json'},cache:'no-store'});
 if(r.status===404){people={people:[]};psha=null;return}if(!r.ok)throw new Error('HTTP '+r.status);
 const j=await r.json();psha=j.sha;people=JSON.parse(b64d(j.content));people.people=people.people||[];localStorage.setItem('pcache',JSON.stringify(people))}
async function loadPeople(){if(!tok())return;try{await fetchPeople()}catch(e){const c=localStorage.getItem('pcache');if(c)people=JSON.parse(c)}renderPeople()}
async function commitPeople(change,msg){if(!navigator.onLine){alert('Offline — changes need a connection');return}
 for(let i=0;i<3;i++){change(people);renderPeople();const body={message:msg,content:b64e(JSON.stringify(people,null,2)+'\n'),branch:BRANCH};if(psha)body.sha=psha;
  const r=await fetch(PAPI,{method:'PUT',headers:{Authorization:'Bearer '+tok(),Accept:'application/vnd.github+json'},body:JSON.stringify(body)});
  if(r.ok){psha=(await r.json()).content.sha;localStorage.setItem('pcache',JSON.stringify(people));status('Saved');return}
  if(r.status===409||r.status===422){status('Conflict — retrying');await fetchPeople();continue}status('Save failed: HTTP '+r.status);return}
 status('Save failed after retries');await loadPeople()}
function renderPeople(){if(!people)return;const ps=[...people.people].map((p,i)=>({...p,i})).sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));
 $('#peopleNames').innerHTML=ps.map(p=>`<option value="${esc(p.name)}">`).join('');
 $('#plist').innerHTML=ps.map(p=>`<div class="item"><div class="body"><div class="t">${esc(p.name)}</div><div class="meta">${p.email?`✉ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`:'✉ —'}${p.cell?` · 📱 <a href="tel:${esc(p.cell)}">${esc(p.cell)}</a>`:''}</div></div><button class="ed" data-i="${p.i}">✎</button></div>`).join('')||'<p class="empty">No people yet.</p>';
 $('#plist').querySelectorAll('.ed').forEach(b=>b.onclick=()=>openPerson(+b.dataset.i))}
function openPerson(i){pidx=i;const p=i==null?{name:'',email:'',cell:''}:people.people[i],F=$('#pForm');$('#pTitle').textContent=i==null?'Add person':'Edit person';
 F.name.value=p.name||'';F.email.value=p.email||'';F.cell.value=p.cell||'';$('#pedit').showModal()}
$('#pedit').addEventListener('close',()=>{if($('#pedit').returnValue!=='save')return;const F=$('#pForm'),old=pidx==null?null:people.people[pidx].name;
 const v={name:F.name.value.trim(),email:F.email.value.trim()||null,cell:F.cell.value.trim()||null};if(!v.name)return;
 commitPeople(P=>{const j=old==null?-1:P.people.findIndex(x=>x.name===old);if(j>=0)Object.assign(P.people[j],v);else if(!P.people.some(x=>x.name===v.name))P.people.push(v)},`${old==null?'Add':'Edit'} person ${v.name}`)});
$('#addPerson').onclick=()=>openPerson(null);
function setView(v){view=v;localStorage.setItem('view',v);const p=v==='people';$('#people').hidden=!p;$('#lists').hidden=p;$('#bar').hidden=p;
 $('#ttl').textContent=p?'People':'To-Dos';$('#tabBtn').textContent=p?'☑':'👥';if(p)loadPeople()}
$('#tabBtn').onclick=()=>setView(view==='people'?'todos':'people');
const _load=load;$('#refresh').onclick=()=>view==='people'?loadPeople():_load();
setView(view);loadPeople();
