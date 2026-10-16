// LibreLinkUp -> glucose.json (unofficial API). Never logs credentials or glucose values.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const D=process.env.DATA_DIR,F=path.join(D,'glucose.json');
const {LIBRE_EMAIL:EMAIL,LIBRE_PASSWORD:PASS}=process.env;const REGION=(process.env.LIBRE_REGION||'auto').trim().toLowerCase();
let g;try{g=JSON.parse(fs.readFileSync(F,'utf8'))}catch(e){g={}}
g={schemaVersion:1,unit:'mg/dL',readings:[],current:null,lastSync:null,lastError:null,...g};
const save=()=>fs.writeFileSync(F,JSON.stringify(g,null,1)+'\n');
const fail=m=>{console.log('::warning::'+m);g.lastError={at:new Date().toISOString(),message:m};save();process.exit(0)};
if(!EMAIL||!PASS){console.log('::notice::LIBRE_EMAIL / LIBRE_PASSWORD secrets not set; skipping glucose sync.');process.exit(0)}
const VERSIONS=['4.12.0','4.7.0'];
const hdr=(v,extra={})=>({'content-type':'application/json',accept:'application/json','accept-encoding':'gzip',product:'llu.ios',version:v,'cache-control':'no-cache',connection:'Keep-Alive',...extra});
async function call(base,p,v,opt={}){const r=await fetch(base+p,{...opt,headers:hdr(v,opt.headers)});let j=null;try{j=await r.json()}catch(e){}return {http:r.status,j}}
function parseTs(s){// "10/16/2026 8:01:02 PM" in UTC (FactoryTimestamp)
 const m=/^(\d+)\/(\d+)\/(\d+) (\d+):(\d+):(\d+) ?(AM|PM)?$/i.exec(String(s||'').trim());if(!m)return null;let h=+m[4];
 if(m[7]){if(/pm/i.test(m[7])&&h<12)h+=12;if(/am/i.test(m[7])&&h===12)h=0}return new Date(Date.UTC(+m[3],+m[1]-1,+m[2],h,+m[5],+m[6])).toISOString()}
const rd=x=>{if(!x)return null;const t=parseTs(x.FactoryTimestamp)||parseTs(x.Timestamp);const mg=+(x.ValueInMgPerDl??x.Value);if(!t||!mg)return null;
 return {t,mgdl:Math.round(mg),mmol:Math.round(mg/18.0182*10)/10,trend:x.TrendArrow??null}};
(async()=>{let base=REGION==='auto'?'https://api.libreview.io':`https://api-${REGION}.libreview.io`,v=null,login=null;
 for(const ver of VERSIONS){let r=await call(base,'/llu/auth/login',ver,{method:'POST',body:JSON.stringify({email:EMAIL,password:PASS})});
  if(r.j&&r.j.status===0&&r.j.data&&r.j.data.redirect&&r.j.data.region){base=`https://api-${r.j.data.region}.libreview.io`;console.log('region redirect ->',r.j.data.region);
   r=await call(base,'/llu/auth/login',ver,{method:'POST',body:JSON.stringify({email:EMAIL,password:PASS})})}
  if(r.j&&r.j.status===920){console.log('app version',ver,'rejected; trying next');continue}
  if(r.j&&r.j.status===4)return fail('LibreLinkUp needs you to accept new terms/privacy policy ('+((r.j.data&&r.j.data.step&&r.j.data.step.type)||'step')+'). Open the LibreLinkUp app, sign in, accept, then sync resumes.');
  if(r.j&&r.j.status===2)return fail('LibreLinkUp login failed: wrong email or password.');
  if(r.http===429)return fail('LibreLinkUp rate-limited the login (HTTP 429). Will retry next run.');
  if(!r.j||r.j.status!==0||!r.j.data||!r.j.data.authTicket)return fail('LibreLinkUp login failed (HTTP '+r.http+', status '+(r.j&&r.j.status)+').');
  v=ver;login=r.j.data;break}
 if(!login)return fail('LibreLinkUp rejected all known app versions; the unofficial API may have changed.');
 const auth={authorization:'Bearer '+login.authTicket.token,'account-id':crypto.createHash('sha256').update(String(login.user.id)).digest('hex')};
 const c=await call(base,'/llu/connections',v,{headers:auth});
 if(c.http!==200||!c.j||!Array.isArray(c.j.data))return fail('Could not list LibreLinkUp connections (HTTP '+c.http+').');
 if(!c.j.data.length)return fail('No LibreLinkUp connections. Accept the invite from your Libre 3 app in LibreLinkUp first.');
 const pid=c.j.data[0].patientId;const gr=await call(base,`/llu/connections/${pid}/graph`,v,{headers:auth});
 if(gr.http!==200||!gr.j||!gr.j.data)return fail('Could not read glucose graph (HTTP '+gr.http+').');
 const fresh=[...(gr.j.data.graphData||[]).map(rd)];const cur=rd(gr.j.data.connection&&gr.j.data.connection.glucoseMeasurement);if(cur)fresh.push(cur);
 const map=new Map(g.readings.map(r=>[r.t,r]));let added=0;for(const r of fresh.filter(Boolean)){if(!map.has(r.t))added++;map.set(r.t,{...map.get(r.t),...r})}
 const cutoff=Date.now()-400*864e5;g.readings=[...map.values()].filter(r=>Date.parse(r.t)>cutoff).sort((a,b)=>a.t<b.t?-1:1);
 if(cur)g.current=cur;g.lastSync=new Date().toISOString();g.lastError=null;save();
 console.log(`ok: api version ${v}, +${added} new readings, total ${g.readings.length}`)})().catch(e=>fail('Glucose sync error: '+e.message));
