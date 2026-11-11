(function(){
'use strict';
// Deployment sets this public service URL. No token or user identity is stored here.
var API=window.MISBAHA_REMINDERS_API||'https://misbaha-reminders.misbaha-daily.workers.dev';
var tg=window.Telegram&&window.Telegram.WebApp;
var root=document.getElementById('root'),sheet=document.getElementById('reminder-sheet'),status=document.getElementById('reminder-status'),list=document.getElementById('reminder-list'),form=document.getElementById('reminder-form'),submit=document.getElementById('reminder-save');
var zone=Intl.DateTimeFormat().resolvedOptions().timeZone;

var select=document.getElementById('reminder-dhikr');
Array.from(document.querySelectorAll('#dhikr-list button')).forEach(function(b,i){var o=document.createElement('option');o.value=i;o.textContent=b.textContent;select.appendChild(o);});
function message(t){status.textContent=t;}
function close(){root.classList.remove('reminder-open');sheet.setAttribute('aria-hidden','true');document.getElementById('btn-reminders').focus();}
document.getElementById('reminder-close').onclick=close;
document.getElementById('reminder-backdrop').onclick=close;
document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
async function api(action,data){var r=await fetch(API+'/reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({action:action,initData:tg.initData},data||{}))});var out=await r.json();if(!r.ok){var texts={unauthorized:'انتهت الجلسة. أغلق التطبيق وافتحه من البوت من جديد.',not_ready:'خدمة التذكير قيد التجهيز.',limit_or_duplicate:'الحد 5 تذكيرات. لا تضف نفس الذكر في نفس الوقت مرتين.'};throw Error(texts[out.error]||'تعذّر الحفظ. حاول مجددًا.');}return out;}
async function load(){message('جارٍ تحميل تذكيراتك…');try{var out=await api('list');list.replaceChildren();out.reminders.forEach(function(r){var row=document.createElement('div');row.className='reminder-row';var text=document.createElement('div'),time=document.createElement('b'),dhikr=document.createElement('span'),del=document.createElement('button');time.textContent=r.time;time.dir='ltr';dhikr.textContent=(select.options[r.dhikr]||{}).textContent||'';text.append(time,dhikr);if(!r.enabled){var note=document.createElement('small');note.textContent='متوقف: افتح محادثة البوت واضغط ابدأ، ثم احذف التذكير وأضفه مجددًا.';text.appendChild(note);}del.type='button';del.textContent='حذف';del.className='chip';del.setAttribute('aria-label','حذف تذكير '+r.time);del.onclick=async function(){del.disabled=true;try{await api('delete',{id:r.id});await load();}catch(e){message(e.message);del.disabled=false;}};row.append(text,del);list.appendChild(row);});message(out.reminders.length?'تذكيرات يومية. يمكنك حذفها في أي وقت.':'لا توجد تذكيرات بعد. أضف وقتًا يناسبك.');}catch(e){message(e.message);}}
document.getElementById('btn-reminders').onclick=function(){root.classList.add('reminder-open');sheet.setAttribute('aria-hidden','false');if(!tg||!tg.initData){form.hidden=true;message('افتح المسبحة من بوت تيليجرام لتفعيل التذكيرات.');return;}if(!API){form.hidden=true;message('خدمة التذكير قيد التجهيز.');return;}form.hidden=false;load();};
form.onsubmit=async function(e){e.preventDefault();submit.disabled=true;try{if(tg.requestWriteAccess&&!(tg.initDataUnsafe&&tg.initDataUnsafe.user&&tg.initDataUnsafe.user.allows_write_to_pm)){var granted=await new Promise(function(resolve){tg.requestWriteAccess(resolve);});if(!granted){message('اسمح للبوت بإرسال رسائل لتصلك التذكيرات.');return;}}await api('add',{time:document.getElementById('reminder-time').value,dhikr:Number(select.value),timezone:zone});await load();}catch(e){message(e.message);}finally{submit.disabled=false;}};
})();
