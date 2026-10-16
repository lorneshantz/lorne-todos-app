// Sends Web Push for due to-dos. Runs in GitHub Actions; data repo checked out at $DATA_DIR.
const fs=require('fs'),path=require('path'),webpush=require('web-push');
const D=process.env.DATA_DIR,rd=(f,d)=>{try{return JSON.parse(fs.readFileSync(path.join(D,f),'utf8'))}catch(e){return d}},wr=(f,o)=>fs.writeFileSync(path.join(D,f),JSON.stringify(o,null,2)+'\n');
webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
function nyToUtc(date,time){const [y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);let t=Date.UTC(y,m-1,d,hh,mm);
 for(let i=0;i<2;i++){const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(t)).map(x=>[x.type,x.value]));
  const shown=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);t+=Date.UTC(y,m-1,d,hh,mm)-shown}return t}
(async()=>{const todos=rd('todos.json',{todos:[]}),subsF=rd('subscriptions.json',{subscriptions:[]}),pushed=rd('pushed.json',{});
 let subs=subsF.subscriptions||[];const now=Date.now(),due=[];
 for(const t of todos.todos||[]){if(t.status==='complete'||!t.due||!t.dueTime)continue;const key=`${t.id}|${t.due}|${t.dueTime}`;
  if(pushed[key])continue;const at=nyToUtc(t.due,t.dueTime);if(at>now)continue;
  if(now-at>24*3600e3){pushed[key]='skipped-stale';continue}due.push([t,key])}
 console.log(`subs=${subs.length} due=${due.length}`);const dead=new Set();
 for(const [t,key] of due){if(!subs.length){console.log('no subscriptions; not marking',t.id);continue}
  let ok=0;for(const s of subs){try{await webpush.sendNotification(s,JSON.stringify({title:t.title,body:'List: '+t.list,tag:'todo-'+t.id}));ok++}
   catch(e){if(e.statusCode===404||e.statusCode===410)dead.add(s.endpoint);else console.log('push error',e.statusCode||e.message)}}
  if(ok)pushed[key]=new Date().toISOString();console.log('sent',t.id,ok)}
 if(dead.size){subsF.subscriptions=subs.filter(s=>!dead.has(s.endpoint));wr('subscriptions.json',subsF);console.log('dropped',dead.size)}
 wr('pushed.json',pushed)})().catch(e=>{console.error(e);process.exit(1)});
