function postsForFilters(){
  const {start,end}=currentWeekBounds();
  return frontendState.posts.filter(p=>(calendarStatusFilter==="all"||normalizePostStatus(p.status)===calendarStatusFilter) &&
    (calendarPlatformFilter==="all"||p.platforms.includes(calendarPlatformFilter)) &&
    (calendarQuickFilter==="all"||
      calendarQuickFilter==="planned"&&normalizePostStatus(p.status)==="scheduled"||
      calendarQuickFilter==="draft"&&normalizePostStatus(p.status)==="draft"||
      calendarQuickFilter==="published"&&normalizePostStatus(p.status)==="published"||
      calendarQuickFilter==="today"&&postDateKey(p)===todayISO()||
      calendarQuickFilter==="week"&&postDateKey(p)>=start&&postDateKey(p)<=end));
}
function currentWeekBounds(){
  const d=new Date(todayISO()+"T12:00:00"),offset=(d.getDay()+6)%7,startDate=new Date(d);startDate.setDate(d.getDate()-offset);
  const endDate=new Date(startDate);endDate.setDate(startDate.getDate()+6);
  const iso=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
  return {start:iso(startDate),end:iso(endDate)};
}
function setCalendarQuickFilter(filter){calendarQuickFilter=filter;calendarStatusFilter="all";calendarView="liste";render();}
renderCalendar=function(){
  const posts=frontendState.posts;
  const planned=posts.filter(p=>normalizePostStatus(p.status)==="scheduled").length,drafts=posts.filter(p=>normalizePostStatus(p.status)==="draft").length;
  return `<div class="space-y-lg">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-md">
      <div><h2 class="font-headline-lg text-headline-lg text-on-surface">İçerik Takvimi</h2><p class="text-body-md text-on-surface-variant opacity-80">Planlanan, taslak ve yayınlanan içeriklerinizi tek bir takvim üzerinden yönetin.</p></div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-5 gap-md">
      ${(()=>{const w=currentWeekBounds();return [[uiText("Toplam Planlanan","Total Scheduled"),planned,"planned"],[uiText("Taslak","Draft"),drafts,"draft"],[uiText("Bugün","Today"),posts.filter(p=>postDateKey(p)===todayISO()).length,"today"],[uiText("Bu Hafta","This Week"),posts.filter(p=>postDateKey(p)>=w.start&&postDateKey(p)<=w.end).length,"week"],[uiText("Yayınlanan","Published"),posts.filter(p=>normalizePostStatus(p.status)==="published").length,"published"]].map(x=>`<button type="button" aria-pressed="${calendarQuickFilter===x[2]}" class="${calendarQuickFilter===x[2]?"bg-primary-container/30 border-primary-container/50":"bg-surface-container-lowest border-primary-container/20"} p-md rounded-2xl border text-left hover:shadow-md" data-command="setCalendarQuickFilter('${x[2]}')"><p class="font-label-sm text-label-sm text-on-surface-variant opacity-70">${x[0]}</p><p class="font-headline-md text-headline-md">${x[1]}</p></button>`).join("")})()}
    </div>
    <div class="flex flex-col lg:flex-row gap-gutter">
      <div class="flex-1 space-y-md min-w-0">
        <div class="bg-surface-container-lowest p-sm rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-sm border border-primary-container/10">
          <div class="flex bg-surface-container p-1 rounded-xl">
            ${[["gunluk",uiText("Günlük","Daily")],["haftalik",uiText("Haftalık","Weekly")],["aylik",uiText("Aylık","Monthly")],["liste",uiText("Liste","List")]].map(x=>`<button type="button" aria-pressed="${calendarView===x[0]}" class="cal-view-btn px-md py-2 font-label-md text-label-md rounded-lg ${calendarView===x[0]?"bg-white shadow-sm text-primary font-bold":""}" data-view="${x[0]}">${x[1]}</button>`).join("")}
          </div>
          <div class="cal-period-controls flex items-center gap-1">
            <button type="button" aria-label="Önceki dönem" class="material-symbols-outlined p-1 hover:bg-surface-container-high rounded-full" id="cal-prev">chevron_left</button>
            <span class="px-2 font-label-md text-label-md min-w-[150px] text-center" id="cal-period-label"></span>
            <button type="button" aria-label="Sonraki dönem" class="material-symbols-outlined p-1 hover:bg-surface-container-high rounded-full" id="cal-next">chevron_right</button>
            <button type="button" class="px-3 py-1.5 rounded-lg border border-primary text-primary text-label-sm font-bold ml-1" id="cal-today">${uiText("Bugün","Today")}</button>
          </div>
          <div class="flex gap-2">
            <select name="cal-platform-filter" aria-label="${uiText("Platform filtresi","Platform filter")}" class="clean-select rounded-lg bg-surface-container border-none text-label-sm" id="cal-platform-filter"><option value="all">${uiText("Tümü","All")}</option>${["Instagram","Facebook","X","LinkedIn","TikTok","YouTube","Threads"].map(x=>`<option value="${x}" ${calendarPlatformFilter===x?"selected":""}>${x}</option>`).join("")}</select>
            <select name="cal-status-filter" aria-label="${uiText("Durum filtresi","Status filter")}" class="clean-select rounded-lg bg-surface-container border-none text-label-sm" id="cal-status-filter"><option value="all">${uiText("Tümü","All")}</option>${[["scheduled",uiText("Planlandı","Scheduled")],["draft",uiText("Taslak","Draft")],["published",uiText("Yayınlandı","Published")]].map(x=>`<option value="${x[0]}" ${calendarStatusFilter===x[0]?"selected":""}>${x[1]}</option>`).join("")}</select>
          </div>
        </div>
        <div id="cal-view-body"></div>
      </div>
      <aside class="w-full lg:w-80"><div class="bg-surface-container-lowest p-md rounded-3xl shadow-sm border border-primary-container/20">
        <div class="flex items-center justify-between mb-md"><h3 class="font-headline-md text-[18px]">${uiText("Yaklaşan Gönderiler","Upcoming Posts")}</h3><button type="button" class="text-primary text-label-sm font-bold" data-command="calendarView='liste';calendarQuickFilter='all';calendarStatusFilter='all';calendarPlatformFilter='all';render()">${uiText("Tümü","All")}</button></div>
        <div class="space-y-sm">${posts.filter(p=>normalizePostStatus(p.status)!=="published").sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,4).map(postCardSmall).join("")||emptyState(uiText("Yaklaşan gönderi yok","No upcoming posts"))}</div>
      </div></aside>
    </div>
  </div>`;
};
function emptyState(message){return `<div class="empty-state-unified text-on-surface-variant" role="status"><span class="material-symbols-outlined text-[38px] opacity-40" aria-hidden="true">inbox</span><p class="mt-2 text-body-sm">${escapeHtml(message)}</p></div>`;}

function monthLabel(d){const locale=frontendState.settings.language==="en"?"en-GB":"tr-TR";return d.toLocaleDateString(locale,{month:"long",year:"numeric"}).replace(/^./,c=>c.toLocaleUpperCase(locale));}
function calendarMonthDynamic(){
  const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth(),days=new Date(y,m+1,0).getDate();
  if(window.innerWidth<768){
    const rows=[];
    for(let day=1;day<=days;day++){
      const iso=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`,items=postsForFilters().filter(p=>postDateKey(p)===iso);
      rows.push(`<div class="calendar-mobile-day"><div class="flex items-center justify-between mb-2"><strong>${formatDate(iso,true)}</strong>${iso===todayISO()?`<span class="px-2 py-1 rounded-full bg-primary text-white text-[10px]">${uiText("Bugün","Today")}</span>`:""}</div><div class="space-y-2">${items.length?items.map(postCardSmall).join(""):`<p class="py-2 text-body-sm text-on-surface-variant">${uiText("Gönderi yok","No posts")}</p>`}</div></div>`);
    }
    return `<div class="calendar-mobile-month">${rows.join("")||emptyState(uiText("Bu ay için gönderi yok","No posts this month"))}</div>`;
  }
  const leading=(new Date(y,m,1).getDay()+6)%7,cells=[];
  for(let i=0;i<leading;i++)cells.push(`<div class="min-h-[90px] bg-surface-container-low/20 border-r border-b border-outline-variant/10"></div>`);
  for(let day=1;day<=days;day++){
    const iso=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`,items=postsForFilters().filter(p=>postDateKey(p)===iso);
    cells.push(`<button type="button" class="day-cell p-2 border-r border-b border-outline-variant/10 min-h-[90px] text-left hover:bg-primary-container/5" data-command="openDayActions('${iso}')"><span class="text-[12px] ${iso===todayISO()?"bg-primary text-white rounded-full w-6 h-6 inline-flex items-center justify-center":""}">${day}</span><div class="mt-1 space-y-1">${items.slice(0,2).map(p=>`<span class="block bg-white shadow-sm px-1.5 py-1 rounded text-[9px] font-bold border border-primary-container/20 truncate" data-command="event.stopPropagation();openPostDetail(${p.id})">${escapeHtml(p.time)} ${escapeHtml(p.platforms[0])}</span>`).join("")}${items.length>2?`<span class="text-[9px] text-primary">+${items.length-2} ${uiText("gönderi","posts")}</span>`:""}</div></button>`);
  }
  while(cells.length%7)cells.push(`<div class="min-h-[90px] bg-surface-container-low/20 border-r border-b border-outline-variant/10"></div>`);
  const weekdayLocale=frontendState.settings.language==="en"?"en-GB":"tr-TR";
  const weekdayMonday=new Date();weekdayMonday.setHours(12,0,0,0);weekdayMonday.setDate(weekdayMonday.getDate()-((weekdayMonday.getDay()+6)%7));
  const weekdays=Array.from({length:7},(_,index)=>{const date=new Date(weekdayMonday);date.setDate(date.getDate()+index);return new Intl.DateTimeFormat(weekdayLocale,{weekday:"short"}).format(date);});
  return `<div class="bg-surface-container-lowest rounded-2xl border border-primary-container/10 overflow-hidden shadow-sm"><div class="grid grid-cols-7 bg-surface-container-low text-center text-[11px] font-bold text-on-surface-variant uppercase">${weekdays.map(d=>`<div class="py-2">${escapeHtml(d)}</div>`).join("")}</div><div class="grid grid-cols-7">${cells.join("")}</div></div>`;
}
function calendarListDynamic(){
  const posts=postsForFilters().sort((a,b)=>new Date(`${a.date}T${a.time}:00+03:00`)-new Date(`${b.date}T${b.time}:00+03:00`));
  return `<div class="bg-surface-container-lowest rounded-2xl border border-primary-container/10 divide-y divide-outline-variant/10 shadow-sm">${posts.length?posts.map(p=>`<button type="button" class="w-full flex items-center justify-between gap-md p-md text-left hover:bg-surface-container-low" data-command="openPostDetail(${p.id})"><div><p class="font-label-md">${escapeHtml(p.title)}</p><p class="text-[12px] text-on-surface-variant">${escapeHtml(p.platforms.join(", "))} • ${escapeHtml(formatPostDateTime(p))}</p></div><span class="post-status-chip px-3 py-1 rounded-full text-[11px] font-bold ${normalizePostStatus(p.status)==="scheduled"?"bg-tertiary-container":"bg-surface-variant"}">${escapeHtml(postStatusLabel(p.status))}</span></button>`).join(""):emptyState(uiText("Bu filtrelere uygun gönderi yok","No posts match these filters"))}</div>`;
}
function calendarWeekDynamic(){
  const d=new Date(calendarCursor),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);
  if(window.innerWidth<768){
    return `<div class="calendar-mobile-week">${Array.from({length:7},(_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i);const iso=`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`,items=postsForFilters().filter(p=>postDateKey(p)===iso);return `<div class="calendar-mobile-day"><div class="flex items-center justify-between mb-2"><strong>${x.toLocaleDateString(frontendState.settings.language==="en"?"en-GB":"tr-TR",{weekday:"long",day:"numeric",month:"short"})}</strong>${iso===todayISO()?`<span class="px-2 py-1 rounded-full bg-primary text-white text-[10px]">${uiText("Bugün","Today")}</span>`:""}</div><div class="space-y-2">${items.length?items.map(postCardSmall).join(""):`<p class="py-2 text-body-sm text-on-surface-variant">${uiText("Gönderi yok","No posts")}</p>`}</div></div>`;}).join("")}</div>`;
  }
  return `<div class="bg-surface-container-lowest rounded-2xl border border-primary-container/10 overflow-x-auto shadow-sm"><div class="grid grid-cols-7 min-w-[700px]">${Array.from({length:7},(_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i);const iso=`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`,items=postsForFilters().filter(p=>postDateKey(p)===iso);return `<div class="border-r border-outline-variant/10 p-sm min-h-[260px]"><p class="text-[11px] font-bold mb-2">${x.toLocaleDateString(frontendState.settings.language==="en"?"en-GB":"tr-TR",{weekday:"short",day:"numeric"})}</p>${items.map(postCardSmall).join("")}</div>`;}).join("")}</div></div>`;
}
function calendarDayDynamic(){
  const iso=`${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth()+1).padStart(2,"0")}-${String(calendarCursor.getDate()).padStart(2,"0")}`,items=postsForFilters().filter(p=>postDateKey(p)===iso);
  return `<div class="bg-surface-container-lowest rounded-2xl border border-primary-container/10 divide-y divide-outline-variant/10 shadow-sm">${Array.from({length:24},(_,i)=>`${String(i).padStart(2,"0")}:00`).map(h=>`<div class="flex gap-md p-sm min-h-[58px]"><span class="text-[11px] font-bold w-14">${h}${frontendState.settings.timezone==="UTC"?" UTC":""}</span><div class="flex-1 space-y-1">${items.filter(p=>postHourKey(p)===h.slice(0,2)).map(postCardSmall).join("")}</div></div>`).join("")}</div>`;
}
initCalendarPage=function(){
  const body=document.getElementById("cal-view-body"),label=document.getElementById("cal-period-label");
  function draw(){
    if(calendarView==="aylik"){label.textContent=monthLabel(calendarCursor);body.innerHTML=calendarMonthDynamic();}
    if(calendarView==="haftalik"){label.textContent=`${calendarCursor.toLocaleDateString(frontendState.settings.language==="en"?"en-GB":"tr-TR",{month:"long",year:"numeric"})}`;body.innerHTML=calendarWeekDynamic();}
    if(calendarView==="gunluk"){label.textContent=formatDate(`${calendarCursor.getFullYear()}-${String(calendarCursor.getMonth()+1).padStart(2,"0")}-${String(calendarCursor.getDate()).padStart(2,"0")}`,true);body.innerHTML=calendarDayDynamic();}
    if(calendarView==="liste"){label.textContent=uiText("Tüm Gönderiler","All Posts");body.innerHTML=calendarListDynamic();}
  }
  document.querySelectorAll(".cal-view-btn").forEach(button=>button.addEventListener("click",()=>{calendarView=button.dataset.view;render();}));
  document.getElementById("cal-prev").addEventListener("click",()=>{calendarView==="aylik"?calendarCursor.setMonth(calendarCursor.getMonth()-1):calendarView==="haftalik"?calendarCursor.setDate(calendarCursor.getDate()-7):calendarCursor.setDate(calendarCursor.getDate()-1);draw();});
  document.getElementById("cal-next").addEventListener("click",()=>{calendarView==="aylik"?calendarCursor.setMonth(calendarCursor.getMonth()+1):calendarView==="haftalik"?calendarCursor.setDate(calendarCursor.getDate()+7):calendarCursor.setDate(calendarCursor.getDate()+1);draw();});
  document.getElementById("cal-today").addEventListener("click",()=>{calendarCursor=new Date(todayISO()+"T12:00:00");draw();});
  document.getElementById("cal-platform-filter").addEventListener("change",event=>{calendarPlatformFilter=event.target.value;calendarQuickFilter="all";draw();});
  document.getElementById("cal-status-filter").addEventListener("change",event=>{calendarStatusFilter=event.target.value;calendarQuickFilter="all";draw();});
  draw();
};
function openDayActions(date){
  openDialog(formatDate(date,true),`<p class="text-body-sm text-on-surface-variant mb-4">Bu güne planlanan gönderiler:</p>${frontendState.posts.filter(p=>p.date===date).map(postCardSmall).join("")||emptyState("Bu tarihte gönderi yok")}`,
    `<button type="button" class="px-5 py-2.5 bg-primary text-white rounded-xl" data-command="closeDialog();openComposeForDate('${date}')">Bu Güne Gönderi Ekle</button>`);
}
function openComposeForDate(date){openCompose();document.getElementById("post-date").value=date;composeDirty=true;}
function openPostDetail(id){
  const p=frontendState.posts.find(x=>x.id===id);if(!p)return;
  openDialog("Gönderi Detayı",`<div class="space-y-4"><div class="flex flex-wrap gap-2">${p.platforms.map(x=>`<span class="px-3 py-1 rounded-full bg-primary-container text-on-primary-container text-label-sm">${escapeHtml(x)}</span>`).join("")}</div>
    <div><p class="font-headline-md text-[18px]">${escapeHtml(p.title)}</p><p class="text-body-sm text-on-surface-variant whitespace-pre-wrap mt-2">${escapeHtml(p.text)}</p></div>
    <div class="grid grid-cols-2 gap-3"><div class="p-3 bg-surface-container-low rounded-xl"><small>${uiText("Tarih ve saat","Date and time")}</small><p class="font-bold">${escapeHtml(formatPostDateTime(p))}</p></div><div class="p-3 bg-surface-container-low rounded-xl"><small>${uiText("Durum","Status")}</small><p class="font-bold">${escapeHtml(postStatusLabel(p.status))}</p></div></div>
    ${p.errorMessage?`<div class="p-3 rounded-xl bg-error-container text-on-error-container text-body-sm">${escapeHtml(p.errorMessage)}</div>`:""}
    ${p.publications?.length?`<div class="space-y-2"><p class="text-label-sm">${uiText("Platform sonuçları","Platform results")}</p>${p.publications.map(item=>`<div class="flex justify-between gap-3 p-2 bg-surface-container-low rounded-lg"><span>${escapeHtml(item.platform)}</span><span>${escapeHtml(postStatusLabel(item.status))}${item.attemptCount?` · ${item.attemptCount} ${uiText("deneme","attempts")}`:""}</span></div>`).join("")}</div>`:""}
    <div><span class="text-label-sm">${uiText("Tarihi değiştir","Change date")}</span><div class="flex gap-2 mt-1"><label for="detail-post-date" class="sd-visually-hidden">${uiText("Gönderi tarihi","Post date")}</label><input name="detail-post-date" id="detail-post-date" type="date" min="${todayISO()}" value="${p.date}" class="flex-1 rounded-xl bg-surface-container-low border-none"><label for="detail-post-time" class="sd-visually-hidden">${uiText("Gönderi saati","Post time")}</label><input name="detail-post-time" id="detail-post-time" type="time" value="${p.time}" class="w-32 rounded-xl bg-surface-container-low border-none"></div></div></div>`,
    `<button type="button" class="px-4 py-2.5 text-error rounded-xl hover:bg-error-container" data-command="deletePost(${p.id})">${uiText("Sil","Delete")}</button><button type="button" class="px-4 py-2.5 bg-surface-container rounded-xl" data-command="duplicatePost(${p.id})">Çoğalt</button>${normalizePostStatus(p.status)==="failed"?`<button type="button" class="px-4 py-2.5 bg-secondary-container rounded-xl" data-command="retryPost(${p.id})">${uiText("Tekrar dene","Retry")}</button>`:""}<button type="button" class="px-4 py-2.5 border border-primary text-primary rounded-xl" data-command="editPost(${p.id})">Düzenle</button><button type="button" class="px-4 py-2.5 bg-primary text-white rounded-xl" data-command="reschedulePost(${p.id})">Kaydet</button>`);
}
async function reschedulePost(id){const p=frontendState.posts.find(x=>x.id===id),d=document.getElementById("detail-post-date").value,t=document.getElementById("detail-post-time").value;if(!d||!t)return;if(scheduledDateTime(d,t)<new Date()){showToast("Geçmiş tarih seçilemez");return;}
  try{const scheduledAt=scheduledDateTime(d,t).toISOString();const result=await api.posts.schedule(id,scheduledAt);p.date=d;p.time=t;p.scheduledAt=scheduledAt;p.status="scheduled";p.publications=result?.data?.publications||p.publications;persistState();closeDialog();if(currentRoute==="calendar")render();showToast("Gönderi tarihi güncellendi");}
  catch(err){showToast(err?.data?.message||uiText("Tarih sunucuya kaydedilemedi.","The date could not be saved to the server."));}
}
async function retryPost(id){
  const p=frontendState.posts.find(x=>x.id===id);if(!p)return;
  try{const result=await api.posts.retry(id);Object.assign(p,{status:"scheduled",scheduledAt:result.data.scheduledAt,errorMessage:"",publications:result.data.publications||[]},scheduledAtParts(result.data.scheduledAt));persistState();closeDialog();render();showToast(uiText("Gönderi yeniden deneme kuyruğuna alındı","Post queued for retry"));}
  catch(err){showToast(err?.data?.message||uiText("Yeniden deneme başlatılamadı.","Retry could not be started."));}
}
async function duplicatePost(id){
  const p=frontendState.posts.find(x=>x.id===id);if(!p)return;
  try{
    await api.posts.create({title:p.title+uiText(" (Kopya)"," (Copy)"),content:p.text,platforms:p.platforms,accountIds:p.accountIds||{},advancedSettings:p.advancedSettings||{},status:"draft",scheduledAt:null,mediaIds:p.mediaIds||[]});
    await hydrateFromBackend();closeDialog();render();showToast(uiText("Gönderi taslak olarak çoğaltıldı","Post duplicated as draft"));
  }catch(error){showToast(error.message);}
}

function editPost(id){const p=frontendState.posts.find(x=>x.id===id);if(!p)return;closeDialog();openCompose({editId:p.id,text:p.text,platforms:p.platforms,mediaId:p.mediaId,mediaIds:p.mediaIds||[],date:postParts(p).date,time:postParts(p).time,accountIds:p.accountIds||{},advancedSettings:p.advancedSettings||{}});}
function deletePost(id){
  const i=frontendState.posts.findIndex(x=>x.id===id);if(i<0)return;const removed=frontendState.posts[i];
  confirmAction(uiText("Gönderiyi Sil","Delete Post"),uiText("Bu gönderi silinecek. Ardından Geri Al ile kurtarabilirsiniz.","This post will be deleted. You can restore it with Undo."),uiText("Sil","Delete"),async()=>{
    try{await api.posts.remove(removed.id);}catch(err){showToast(err?.data?.message||uiText("Gönderi silinemedi.","The post could not be deleted."));return;}
    frontendState.posts.splice(i,1);
    const media=frontendState.media.find(item=>item.id===removed.mediaId);if(media)media.uses=media.uses.filter(postId=>postId!==removed.id);
    persistState();closeDialog();if(currentRoute==="calendar")render();
    showUndoToast(uiText("Gönderi silindi","Post deleted"),async()=>{
      try{await api.posts.restore(id);await hydrateFromBackend();render();showToast(uiText("Gönderi geri alındı. Planlanmış içerik taslağa döner.","Post restored. Scheduled content returns as a draft."));}catch(error){showToast(error.message);}
    });
  });
}

/* ---------- Media library ---------- */
let mediaSearch="",mediaType="all",mediaPlatform="all",mediaDate="all",mediaUnused=false;
