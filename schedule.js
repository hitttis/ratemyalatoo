/* RateMyAlatoo — расписание. Парсер Google Sheets сохранён без изменений. */
const SHEET = '1EKBtXh6KMGzqrgh8P_x1-gIwkV5sP6TFfyH-fHMpiOI';
const DAYS = [
 {full:'Понедельник',gid:'1558763581',names:['MONDAY','Monday']},
 {full:'Вторник',gid:'',names:['TUESDAY','Tuesday']},
 {full:'Среда',gid:'',names:['WEDNESDAY','Wednesday']},
 {full:'Четверг',gid:'',names:['THURSDAY','Thursday']},
 {full:'Пятница',gid:'',names:['FRIDAY','Friday']},
 {full:'Суббота',gid:'',names:['SATURDAY','Saturday']}
];
const TZ='Asia/Bishkek';
const DEPT_RU={'Computer Science':'Информатика','Applied Mathematics and Informatics':'Прикладная математика и информатика','Systems Engineering and Automation':'Системная инженерия и автоматизация'};
const $=id=>document.getElementById(id);
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const pad=n=>String(n).padStart(2,'0');
const fmt=m=>pad(Math.floor(m/60))+':'+pad(m%60);
const tm=s=>{const m=s.match(/(\d{1,2})[.:](\d{2})/);return m?(+m[1])*60+(+m[2]):null};
function parseCSV(t){
 const rows=[];let r=[],c='',q=false;
 for(let i=0;i<t.length;i++){
  const ch=t[i];
  if(q){if(ch==='"'){if(t[i+1]==='"'){c+='"';i++}else q=false}else c+=ch}
  else if(ch==='"')q=true;
  else if(ch===','){r.push(c);c=''}
  else if(ch==='\n'){r.push(c);rows.push(r);r=[];c=''}
  else if(ch!=='\r')c+=ch;
 }
 if(c||r.length){r.push(c);rows.push(r)}
 return rows;
}

/* ============ Разбор листа — не изменён по логике ============ */
const TIME_RE=/^\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2}$/;
const GROUP_RE=/^[A-Z]{2,10}-\d{2}[A-Z]?$/;

function parseDay(rows,dayName){
 const head=rows.slice(0,4).some(r=>r.some(c=>c.trim().toUpperCase()===dayName));
 if(!head)return null;
 let cols=[],tr=-1;
 for(let i=0;i<rows.length;i++){
  const c=rows[i].map((x,j)=>TIME_RE.test(x.trim())?j:-1).filter(j=>j>=0);
  if(c.length>=8){cols=c;tr=i;break}
 }
 if(tr<0)return null;
 const slots=cols.map(j=>{const [a,b]=rows[tr][j].split('-');return{s:tm(a),e:tm(b)}});
 const groups={};let dept='';
 for(let i=tr+1;i<rows.length;i++){
  const r=rows[i],a=(r[0]||'').trim();
  if(a==='ROOM'||a==='Code Groups')break;
  if(!a){const t=(r.slice(1).find(x=>x.trim())||'').trim();if(/^Department/i.test(t))dept=t.replace(/^Department of\s*/i,'');continue}
  if(!GROUP_RE.test(a))continue;
  const cells=cols.map(j=>(r[j]||'').trim());
  const les=[];
  cells.forEach((txt,k)=>{
   if(!txt)return;
   const lunch=/^LUNCH$/i.test(txt);
   let span=(lunch||/^Advisor hour/i.test(txt))?1:2,e=k+span;
   for(let n=k+1;n<Math.min(e,cells.length);n++)if(cells[n]){e=n;break}
   e=Math.min(e,cells.length);
   les.push({k,e,start:slots[k].s,end:slots[e-1].e,text:txt,lunch});
  });
  groups[a]={dept,les};
 }
 return{slots,groups};
}

/* ============ Загрузка таблицы и страниц ============ */
function url(p){return `https://docs.google.com/spreadsheets/d/${SHEET}/gviz/tq?tqx=out:csv&headers=0&${p}`}
async function loadDay(d){
 const tries=[];
 if(d.gid)tries.push('gid='+d.gid);
 d.names.forEach(n=>tries.push('sheet='+encodeURIComponent(n)));
 for(const p of tries){
  try{
   const res=await fetch(url(p));
   if(!res.ok)continue;
   const parsed=parseDay(parseCSV(await res.text()),d.names[0]);
   if(parsed)return parsed;
  }catch(e){}
 }
 return null;
}
let data=[],pages=[],group=store.get('rma_group')||'';
async function loadPages(){
 try{const r=await fetch('pages.json',{cache:'no-cache'});if(r.ok){const j=await r.json();if(Array.isArray(j)&&j.length)return j}}catch(e){}
 return PAGES_FALLBACK;
}



/* Интерфейс расписания — использует исходные данные парсера. */
let selectedDay = Math.max(0, Math.min(5, new Date().getDay()-1));
let selectedDepartment = store.get('rma-department') || '';
let selectedGroup = store.get('rma-group') || store.get('rma_group') || '';
let isLoading = true;

function allGroups(){
 const map=new Map();
 data.forEach(d=>d&&Object.entries(d.groups).forEach(([name,value])=>{if(!map.has(name))map.set(name,value.dept||'')}));
 return map;
}
function departmentLabel(value){return DEPT_RU[value]||value||'Без направления';}
function fillDepartments(){
 const sel=$('departmentSelect');
 const departments=[...new Set([...allGroups().values()].filter(Boolean))].sort((a,b)=>a.localeCompare(b));
 sel.innerHTML='<option value="">Все направления</option>'+departments.map(d=>`<option value="${escapeAttr(d)}">${escapeHtml(departmentLabel(d))}</option>`).join('');
 if(selectedDepartment && departments.includes(selectedDepartment))sel.value=selectedDepartment;else selectedDepartment='';
}
function escapeHtml(s){return String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function escapeAttr(s){return escapeHtml(s)}
function visibleGroups(){
 return [...allGroups()].filter(([name,dept])=>!selectedDepartment||dept===selectedDepartment).map(([name])=>name).sort((a,b)=>a.localeCompare(b));
}
function fillGroups(){
 const groups=visibleGroups(),sel=$('groupSelect');
 sel.innerHTML=groups.length?groups.map(g=>`<option value="${escapeAttr(g)}">${escapeHtml(g)}</option>`).join(''):'<option value="">Группы не найдены</option>';
 if(groups.includes(selectedGroup))sel.value=selectedGroup;else selectedGroup=groups[0]||'';
 if(selectedGroup)sel.value=selectedGroup;
 store.set('rma-group',selectedGroup);
}
function renderDayTabs(){
 $('dayTabs').innerHTML=DAYS.map((d,i)=>`<button class="day-tab ${i===selectedDay?'is-active':''}" type="button" data-day="${i}"><span>${['ПН','ВТ','СР','ЧТ','ПТ','СБ'][i]}</span><small>${d.full}</small></button>`).join('');
 $('dayTabs').querySelectorAll('[data-day]').forEach(b=>b.addEventListener('click',()=>{selectedDay=Number(b.dataset.day);renderDayTabs();renderSchedule()}));
}
function renderSchedule(){
 const host=$('scheduleBody');host.replaceChildren();
 $('scheduleDayTitle').textContent=DAYS[selectedDay].full;
 if(isLoading){host.innerHTML='<div class="state"><span class="spinner"></span><strong>Загружаем расписание</strong><p>Получаем данные из таблицы университета.</p></div>';return}
 if(!data.some(Boolean)){host.innerHTML='<div class="state"><strong>Не удалось загрузить расписание</strong><p>Проверьте подключение к интернету и попробуйте обновить страницу.</p><button class="button button--soft" id="retryButton">Повторить загрузку</button></div>'; $('retryButton')?.addEventListener('click',loadSchedule);return}
 if(!selectedGroup){host.innerHTML='<div class="state"><strong>Выберите направление и группу</strong><p>После выбора здесь появится расписание занятий.</p></div>';return}
 const day=data[selectedDay],group=day&&day.groups[selectedGroup];
 if(!group){host.innerHTML=`<div class="state"><strong>На ${DAYS[selectedDay].full.toLowerCase()} расписание не найдено</strong><p>Для группы ${escapeHtml(selectedGroup)} нет опубликованных занятий на этот день.</p></div>`;return}
 const lessons=[...group.les].sort((a,b)=>a.start-b.start);
 if(!lessons.length){host.innerHTML='<div class="state"><strong>Занятий нет</strong><p>На этот день пары не опубликованы.</p></div>';return}
 const table=document.createElement('div');table.className='lesson-list';
 lessons.forEach((lesson,index)=>{
  const card=document.createElement('article');card.className='lesson';
  const number=document.createElement('div');number.className='lesson-number';number.textContent=String(index+1).padStart(2,'0');
  const time=document.createElement('div');time.className='lesson-time';time.innerHTML=`<strong>${fmt(lesson.start)}</strong><span>${fmt(lesson.end)}</span>`;
  const content=document.createElement('div');content.className='lesson-content';
  const text=document.createElement('div');text.className='lesson-text';text.textContent=lesson.text; // Текст ячейки не разбирается на преподавателя/аудиторию.
  content.append(text);
  const duration=document.createElement('div');duration.className='lesson-duration';duration.textContent=`${Math.max(0,lesson.end-lesson.start)} мин`;
  card.append(number,time,content,duration);table.append(card);
 });
 host.append(table);
}
function renderStatus(){
 const count=allGroups().size;
 $('groupCount').textContent=count?`${count} групп`:'—';
 $('connectionStatus').textContent=data.some(Boolean)?'Таблица подключена':'Нет соединения';
 $('connectionDot').classList.toggle('is-online',data.some(Boolean));
}
async function loadSchedule(){
 isLoading=true;renderSchedule();
 const cached=(()=>{try{const c=JSON.parse(store.get('rma_cache')||'null');return Array.isArray(c)?c:null}catch(e){return null}})();
 if(cached){data=cached;isLoading=false;fillDepartments();fillGroups();renderDayTabs();renderSchedule();renderStatus()}
 const fresh=await Promise.all(DAYS.map(loadDay));
 if(fresh.some(Boolean)){data=fresh.map((f,i)=>f||(cached&&cached[i])||null);store.set('rma_cache',JSON.stringify(data))}
 isLoading=false;fillDepartments();fillGroups();renderDayTabs();renderSchedule();renderStatus();
}
$('departmentSelect').addEventListener('change',e=>{selectedDepartment=e.target.value;store.set('rma-department',selectedDepartment);fillGroups();renderSchedule()});
$('groupSelect').addEventListener('change',e=>{selectedGroup=e.target.value;store.set('rma-group',selectedGroup);renderSchedule()});
$('refreshButton').addEventListener('click',loadSchedule);
$('themeToggle').addEventListener('click',()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;store.set('rma-schedule-theme',next)});
const savedTheme=store.get('rma-schedule-theme');if(savedTheme==='dark'||savedTheme==='light')document.documentElement.dataset.theme=savedTheme;
renderDayTabs();loadSchedule();
