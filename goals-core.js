// Pure helpers for the Goals tab (also used by tests and push/send.js).
(function(root){
const DAY=864e5;
const KEYWORDS={fitness:['walk','walked','walking','treadmill','gym','exercise','exercised','workout','weights','lift','lifted','run','ran','hike','bike','swim'],sleep:['bed','sleep','slept','early'],'blood-sugar':['sugar','glucose'],waist:['waist','weigh']};
function weekStart(d){d=new Date(d);d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d}// Monday
function quarterBounds(d){d=new Date(d);const q=Math.floor(d.getMonth()/3);return [new Date(d.getFullYear(),q*3,1),new Date(d.getFullYear(),q*3+3,1)]}
function periodBounds(period,now){if(period==='quarter')return quarterBounds(now);const s=weekStart(now);return [s,new Date(s.getTime()+7*DAY)]}
// done/target in minutes (or units). Returns pct, expected-so-far, behind amount, per-day catch-up.
function pace(done,target,start,end,now){now=+now;start=+start;end=+end;const frac=Math.min(1,Math.max(0,(now-start)/(end-start)));
 const expected=target*frac,behind=Math.max(0,Math.round(expected-done)),daysLeft=Math.max(1,Math.ceil((end-now)/DAY));
 const perDay=Math.max(0,Math.ceil((target-done)/daysLeft));return {pct:target?Math.min(1,done/target):0,expected:Math.round(expected),behind,perDay,onPace:done>=expected-0.5,daysLeft}}
function paceLine(done,target,p,unit){unit=unit||'min';if(done>=target)return `${Math.round(done)} of ${target} ${unit} — done ✓`;
 return p.onPace?`${Math.round(done)} of ${target} ${unit}, on pace`:`${p.behind} ${unit} behind, ~${p.perDay} ${unit}/day catches up`}
// "30 min reading", "just walked 45 minutes", "1.5h treadmill", "an hour walk"
function parsePhrase(text,goals){const s=String(text||'').toLowerCase();let min=null,m;
 if((m=/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/.exec(s)))min=Math.round(parseFloat(m[1])*60);
 if((m=/(\d+)\s*(m|min|mins|minute|minutes)\b/.exec(s)))min=(min||0)+parseInt(m[1]);
 if(min==null&&/\b(an|one) hour\b/.test(s))min=60;if(min==null&&/\bhalf (an )?hour\b/.test(s))min=30;
 if(min==null&&(m=/^\s*(\d+)\b/.exec(s)))min=parseInt(m[1]);
 const words=s.replace(/[^a-z\s-]/g,' ').split(/\s+/).filter(w=>w.length>2);let goal=null;
 for(const g of goals||[]){const keys=[g.id,...String(g.name).toLowerCase().split(/[^a-z]+/),...(g.habits||[]).join(' ').toLowerCase().split(/\s+/),...(KEYWORDS[g.id]||[]),...(g.keywords||[])].filter(k=>k&&k.length>2&&!['with','wife','daily','the','and'].includes(k));
  if(words.some(w=>keys.includes(w))){goal=g;break}}
 return {minutes:min,goal}}
function dayKey(d){d=new Date(d);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
// minutes per local day for a goal: sessions (+ exercise.json for fitness)
function minutesByDay(goalId,sessions,exercise){const m={};for(const s of sessions||[])if(s.goalId===goalId){const k=dayKey(s.at);m[k]=(m[k]||0)+(+s.minutes||0)}
 if(goalId==='fitness')for(const e of exercise||[]){const k=dayKey(e.at);m[k]=(m[k]||0)+(+e.minutes||0)}return m}
function sumRange(byDay,start,end){let t=0;for(let d=new Date(start);d<end;d.setDate(d.getDate()+1))t+=byDay[dayKey(d)]||0;return t}
function dayStreak(allByDay,now){const d=new Date(now);d.setHours(0,0,0,0);if(!allByDay[dayKey(d)])d.setDate(d.getDate()-1);let n=0;while(allByDay[dayKey(d)]){n++;d.setDate(d.getDate()-1)}return n}
function weekStreak(byDay,target,now){let ws=weekStart(now),n=0;const cur=sumRange(byDay,ws,new Date(ws.getTime()+7*DAY));if(cur>=target)n++;
 for(let i=0;i<104;i++){const s=new Date(ws);s.setDate(s.getDate()-7*(i+1));const e=new Date(s);e.setDate(e.getDate()+7);if(sumRange(byDay,s,e)>=target)n++;else break}return n}
// Which minute-based goals are behind pace right now (for nudges)
function behindGoals(gdata,exercise,now){const q=(gdata.quarters||[]).find(x=>x.status==='current');if(!q)return [];const out=[];
 for(const g of q.goals||[]){if(!g.targetMinutes)continue;const [s,e]=periodBounds(g.period,now);const done=sumRange(minutesByDay(g.id,gdata.sessions,exercise),s,e);
  const p=pace(done,g.targetMinutes,s,e,now);if(!p.onPace&&done<g.targetMinutes)out.push({goal:g,done,p})}return out}
// steps-history days -> {today, avg7} (7 local days incl. today, days with data only); null if no data in that window
function stepsSummary(days,now){if(!days||!days.length)return null;const by={};for(const d of days)by[d.date]=+d.steps||0;const d=new Date(now);d.setHours(12,0,0,0);let sum=0,n=0;
 for(let i=0;i<7;i++){const k=dayKey(d);if(k in by){sum+=by[k];n++}d.setDate(d.getDate()-1)}if(!n)return null;return {today:by[dayKey(now)]||0,avg7:sum/n}}
const api={DAY,stepsSummary,weekStart,quarterBounds,periodBounds,pace,paceLine,parsePhrase,dayKey,minutesByDay,sumRange,dayStreak,weekStreak,behindGoals};
if(typeof module!=='undefined')module.exports=api;else root.GC=api})(typeof window!=='undefined'?window:globalThis);
