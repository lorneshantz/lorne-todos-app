// Withings -> weight-history.json. Never logs tokens or measurement values. Always exits 0 so state is committed.
const fs=require('fs'),path=require('path');
const D=process.env.DATA_DIR,P=f=>path.join(D,f);
const rd=(f,d)=>{try{return JSON.parse(fs.readFileSync(P(f),'utf8'))}catch(e){return d}},wr=(f,o)=>fs.writeFileSync(P(f),JSON.stringify(o,null,1)+'\n');
const {WITHINGS_CLIENT_ID:CID,WITHINGS_CLIENT_SECRET:SEC}=process.env;
const API='https://wbsapi.withings.net';
let h={schemaVersion:1,readings:[],lastSync:null,lastError:null,needsReconnect:false,...rd('weight-history.json',{})};
const done=()=>{wr('weight-history.json',h);process.exit(0)};
const fail=(m,reconnect)=>{console.log('::warning::'+m);h.lastError={at:new Date().toISOString(),message:m};if(reconnect)h.needsReconnect=true;done()};
if(!CID||!SEC){console.log('::notice::WITHINGS_CLIENT_ID / WITHINGS_CLIENT_SECRET not set; skipping.');process.exit(0)}
const cfg=rd('withings-config.json',{});if(cfg.clientId!==CID)wr('withings-config.json',{clientId:CID});
async function post(url,params,token){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',...(token?{authorization:'Bearer '+token}:{})},body:new URLSearchParams(params)});
 let j=null;try{j=await r.json()}catch(e){}return {http:r.status,j}}
function saveTok(b){const t={access_token:b.access_token,refresh_token:b.refresh_token,expires_at:Date.now()+(+b.expires_in||10800)*1000,userid:b.userid,scope:b.scope};wr('withings-tokens.json',t);return t}
const TYPES={1:'weightKg',5:'fatFreeKg',6:'fatPct',8:'fatKg',76:'muscleKg',77:'waterKg',88:'boneKg'};
(async()=>{let tok=rd('withings-tokens.json',null);const auth=rd('withings-auth.json',null);
 if(auth&&auth.code){const r=await post(API+'/v2/oauth2',{action:'requesttoken',grant_type:'authorization_code',client_id:CID,client_secret:SEC,code:auth.code,redirect_uri:auth.redirect_uri});
  fs.rmSync(P('withings-auth.json'),{force:true});
  if(!r.j||r.j.status!==0||!r.j.body||!r.j.body.access_token)return fail('Withings connect failed (status '+(r.j&&r.j.status)+(r.j&&r.j.error?': '+r.j.error:'')+'). Tap Connect Withings again.',true);
  tok=saveTok(r.j.body);h.needsReconnect=false;h.lastError=null;console.log('connected (exchanged code)')}
 if(!tok)return fail('Withings not connected yet. Tap Connect Withings in the app.',true);
 if(Date.now()>tok.expires_at-30*60000){const r=await post(API+'/v2/oauth2',{action:'requesttoken',grant_type:'refresh_token',client_id:CID,client_secret:SEC,refresh_token:tok.refresh_token});
  if(!r.j||r.j.status!==0||!r.j.body||!r.j.body.refresh_token)return fail('Withings token refresh failed (status '+(r.j&&r.j.status)+'). Reconnect Withings.',true);
  tok=saveTok(r.j.body);console.log('refreshed token')}// persisted to disk before fetching; committed even if fetch fails
 const map=new Map(h.readings.map(x=>[String(x.grpid||x.t),x]));let added=0,offset=null,lastupdate=h.lastupdate||0,pages=0;const started=Math.floor(Date.now()/1000);
 do{const p={action:'getmeas',meastypes:'1,5,6,8,76,77,88',category:'1',lastupdate:String(lastupdate)};if(offset)p.offset=String(offset);
  const r=await post(API+'/measure',p,tok.access_token);
  if(r.j&&(r.j.status===401||r.j.status===100||r.j.status===101||r.j.status===102||r.j.status===200))return fail('Withings rejected the access token (status '+r.j.status+'). Reconnect Withings.',true);
  if(!r.j||r.j.status!==0)return fail('Withings measure fetch failed (HTTP '+r.http+', status '+(r.j&&r.j.status)+').');
  for(const g of r.j.body.measuregrps||[]){const x={t:new Date(g.date*1000).toISOString(),grpid:g.grpid};
   for(const m of g.measures||[]){const k=TYPES[m.type];if(k)x[k]=Math.round(m.value*Math.pow(10,m.unit)*100)/100}
   if(x.weightKg==null&&x.fatPct==null&&x.fatKg==null)continue;const key=String(g.grpid);if(!map.has(key))added++;map.set(key,{...map.get(key),...x})}
  offset=r.j.body.more?r.j.body.offset:null;pages++}while(offset&&pages<20);
 h.readings=[...map.values()].sort((a,b)=>a.t<b.t?-1:1);h.lastupdate=started;h.lastSync=new Date().toISOString();h.lastError=null;h.needsReconnect=false;
 console.log(`ok: +${added} new groups, total ${h.readings.length}`);done()})().catch(e=>fail('Withings sync error: '+e.message));
