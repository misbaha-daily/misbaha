export const ADHKAR = ['أَسْتَغْفِرُ اللَّهَ','أَسْتَغْفِرُ اللَّهَ الْعَظِيمَ الَّذِي لَا إِلَٰهَ إِلَّا هُوَ الْحَيَّ الْقَيُّومَ وَأَتُوبُ إِلَيْهِ','سُبْحَانَ اللَّهِ','سُبْحَانَ اللَّهِ وَبِحَمْدِهِ','سُبْحَانَ اللَّهِ الْعَظِيمِ وَبِحَمْدِهِ','الْحَمْدُ لِلَّهِ','اللَّهُ أَكْبَرُ','لَا إِلَٰهَ إِلَّا اللَّهُ','اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ','لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ'];
const origin='https://misbaha-daily.github.io';
const formatters=new Map();
function parts(t,tz){if(!formatters.has(tz)){if(formatters.size>100)formatters.clear();formatters.set(tz,new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}));}return Object.fromEntries(formatters.get(tz).formatToParts(new Date(t)).filter(p=>p.type!=='literal').map(p=>[p.type,+p.value]));}
function epoch(p){return Date.UTC(p.year,p.month-1,p.day,p.hour||0,p.minute||0,p.second||0);}
export function nextOccurrence(time,tz,now=Date.now()){
 const p=parts(now,tz),[h,m]=time.split(':').map(Number),start=Date.UTC(p.year,p.month-1,p.day); let candidates=[];
 for(let day=0;day<4;day++) {const base=start+day*86400000+h*3600000+m*60000;
  for(const d of [-36,0,36]){const sample=base+d*3600000;const offset=epoch(parts(sample,tz))-sample;const t=base-offset,q=parts(t,tz);if(t>now&&q.hour===h&&q.minute===m&&epoch({...q,hour:0,minute:0,second:0})===start+day*86400000)candidates.push(t);}
  if(candidates.length)return Math.min(...candidates);
 }
 if(!candidates.length)throw Error('timezone'); return Math.min(...candidates);
}
async function hmac(key,data){const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(data)));}
export async function authenticate(data,token,now=Date.now()){
 if(typeof data!=='string'||data.length>12000)throw Error('auth'); const p=new URLSearchParams(data);if([...p.keys()].length!==new Set(p.keys()).size)throw Error('auth');const hash=p.get('hash');p.delete('hash');
 if(!/^[a-f0-9]{64}$/.test(hash||''))throw Error('auth');const auth=Number(p.get('auth_date'));if(!auth||now/1000-auth>86400||auth-now/1000>60)throw Error('auth');
 const secret=await hmac(new TextEncoder().encode('WebAppData'),token);const result=await hmac(secret,[...p.entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>`${k}=${v}`).join('\n'));const hex=[...result].map(b=>b.toString(16).padStart(2,'0')).join('');let diff=0;for(let i=0;i<64;i++)diff|=hex.charCodeAt(i)^hash.charCodeAt(i);if(diff)throw Error('auth');const u=JSON.parse(p.get('user'));if(!Number.isSafeInteger(u.id)||u.id<=0)throw Error('auth');return String(u.id);
}
function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store','Vary':'Origin'}});}
export default {
 async fetch(req,env){
  if(req.method==='OPTIONS')return response({});if(new URL(req.url).pathname==='/health'){if(!env.BOT_TOKEN)return response({ok:false},503);const check=await fetch('https://api.telegram.org/bot'+env.BOT_TOKEN.trim()+'/getMe');const info=await check.json();return response({ok:!!info.ok,bot:info.result?.username||null},info.ok?200:503);}if(req.method!=='POST'||new URL(req.url).pathname!=='/reminders')return response({error:'not_found'},404);
  if(req.headers.get('Origin')&&req.headers.get('Origin')!==origin)return response({error:'origin'},403);
  if(!env.BOT_TOKEN)return response({error:'not_ready'},503);env.BOT_TOKEN=env.BOT_TOKEN.trim();let body,user;try{const raw=await req.text();if(raw.length>16000)return response({error:'size'},413);body=JSON.parse(raw);user=await authenticate(body.initData,env.BOT_TOKEN);}catch{return response({error:'unauthorized'},401);}
  try{
   if(body.action==='list'){const r=await env.DB.prepare('SELECT id,time,dhikr,enabled FROM reminders WHERE user_id=? ORDER BY time').bind(user).all();return response({reminders:r.results});}
   if(body.action==='delete'){if(typeof body.id!=='string')return response({error:'invalid'},400);await env.DB.prepare('DELETE FROM reminders WHERE id=? AND user_id=?').bind(body.id,user).run();return response({ok:true});}
   if(body.action!=='add'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time||'')||!Number.isInteger(body.dhikr)||body.dhikr<0||body.dhikr>=ADHKAR.length||typeof body.timezone!=='string'||body.timezone.length>80)return response({error:'invalid'},400);
   let next;try{next=nextOccurrence(body.time,body.timezone);}catch{return response({error:'timezone'},400);}
   const id=crypto.randomUUID();const r=await env.DB.prepare('INSERT INTO reminders(id,user_id,time,timezone,dhikr,next_run,enabled) SELECT ?,?,?,?,?,?,1 WHERE (SELECT COUNT(*) FROM reminders WHERE user_id=?)<5 AND NOT EXISTS(SELECT 1 FROM reminders WHERE user_id=? AND time=? AND dhikr=?)').bind(id,user,body.time,body.timezone,body.dhikr,next,user,user,body.time,body.dhikr).run();if(!r.meta.changes)return response({error:'limit_or_duplicate'},409);return response({ok:true,id});
  }catch(e){console.error('database operation failed');return response({error:'server'},500);}
 },
 async scheduled(event,env,ctx){if(!env.BOT_TOKEN)return;const now=Date.now();const rows=await env.DB.prepare('SELECT * FROM reminders WHERE enabled=1 AND next_run<=? ORDER BY next_run LIMIT 25').bind(now).all();
 for(const r of rows.results){const next=nextOccurrence(r.time,r.timezone,now);const claim=await env.DB.prepare('UPDATE reminders SET next_run=? WHERE id=? AND next_run=? AND enabled=1').bind(next,r.id,r.next_run).run();if(!claim.meta.changes)continue;
  // Do not send stale notifications after a long outage. Atomic claim avoids duplicate cron sends.
  if(now-r.next_run>15*60000)continue;
  try{const res=await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:r.user_id,text:'حان وقت الذِّكر 🌿\n\n'+ADHKAR[r.dhikr],reply_markup:{inline_keyboard:[[{text:'افتح المِسبحة',web_app:{url:'https://misbaha-daily.github.io/misbaha/'}}]]}})});const out=await res.json();if(out.ok){await env.DB.prepare('UPDATE reminders SET last_sent=?,last_error=NULL,retries=0 WHERE id=?').bind(now,r.id).run();}else{await env.DB.prepare('UPDATE reminders SET last_error=? WHERE id=?').bind(out.error_code||500,r.id).run();if(out.error_code===429&&(r.retries||0)<3){await env.DB.prepare('UPDATE reminders SET next_run=?,retries=retries+1 WHERE id=?').bind(now+Math.max(60,Math.min(900,out.parameters?.retry_after||60))*1000,r.id).run();}if(out.error_code===403)await env.DB.prepare('UPDATE reminders SET enabled=0 WHERE id=?').bind(r.id).run();console.error('telegram send rejected',out.error_code);}}catch{await env.DB.prepare('UPDATE reminders SET last_error=599 WHERE id=?').bind(r.id).run();console.error('telegram send not confirmed');}
 }
 }
};
