function newsOptionLabel(value){
  const labels={all:["Tümü","All"],social:["Sosyal Medya","Social Media"],ai:["Yapay Zekâ","Artificial Intelligence"],content:["İçerik Üretimi","Content Creation"],"creator-tools":["Üretici Araçları","Creator Tools"],search:["Arama","Search"],community:["Topluluk","Community"],"meta-ai":["Meta AI","Meta AI"],video:["Video","Video"],today:["Bugün","Today"],last7:["Son 7 Gün","Last 7 Days"],last30:["Son 30 Gün","Last 30 Days"],newest:["En Yeni","Newest"],oldest:["En Eski","Oldest"],popular:["En Popüler","Most Popular"]};
  const pair=labels[value];return pair?uiText(pair[0],pair[1]):value;
}
function filteredNews(){
  const today=new Date(todayISO()+"T12:00:00");
  const withinDays=(date,days)=>{const d=new Date(date+"T12:00:00");return (today-d)/86400000>=0&&(today-d)/86400000<=days;};
  let list=newsItems.filter(item=>(newsFilters.category==="all"||item.category===newsFilters.category)&&(newsFilters.platform==="all"||item.platform===newsFilters.platform)&&(newsFilters.source==="all"||item.source===newsFilters.source)&&(newsFilters.trend==="all"||item.trend===newsFilters.trend)&&(newsFilters.date==="all"||newsFilters.date==="today"&&item.date===todayISO()||newsFilters.date==="last7"&&withinDays(item.date,7)||newsFilters.date==="last30"&&withinDays(item.date,30)));
  if(newsFilters.sort==="oldest")list.sort((a,b)=>a.date.localeCompare(b.date));
  else if(newsFilters.sort==="popular")list.sort((a,b)=>b.popularity-a.popularity);
  else list.sort((a,b)=>b.date.localeCompare(a.date));
  return list;
}

function newsSourceVisual(item){
  const key=platformKeyFromLabel(item.platform),color=platformBrandAssets[key]?.color||"#6e5e0d";
  return `<div class="source-visual h-40 text-white flex flex-col items-center justify-center" style="background:${key==="instagram"?platformCatalog.instagram.brand:color}">${platformLogo(key,44,"brand-logo-on-color","white")}<span class="font-label-md mt-3">${escapeHtml(item.source)}</span></div>`;
}
renderNews=function(){
  const list=filteredNews();
  const filterDefs=[
    ["category",uiText("Kategori","Category"),["all","social","ai","content","creator-tools","search","community"]],
    ["platform",uiText("Platform","Platform"),["all","Instagram","Facebook","X","LinkedIn","TikTok","YouTube","Threads"]],
    ["source",uiText("Kaynak","Source"),["all","Meta Newsroom","Instagram Blog","Google Blog","TechCrunch","The Verge","Social Media Today","Search Engine Journal","X Blog","LinkedIn News","TikTok Newsroom","YouTube Blog"]],
    ["trend",uiText("Trend Konu","Trend Topic"),["all","meta-ai","content","video","ai","search","community"]],
    ["date",uiText("Tarih","Date"),["all","today","last7","last30"]],
    ["sort",uiText("Sıralama","Sort"),["newest","oldest","popular"]]
  ];
  const selectHtml=filterDefs.map(([key,label,options])=>{
    const selected=newsFilters[key];
    const realOptions=options.map(o=>`<option value="${escapeHtml(o)}" ${selected===o?"selected":""}>${escapeHtml(o==="all"?uiText("Tümü","All"):newsOptionLabel(o))}</option>`).join("");
    return `<label class="block"><span class="sd-visually-hidden">${escapeHtml(label)}</span><select name="news-filter-${key}" aria-label="${escapeHtml(label)}" data-news-filter="${key}" class="news-filter-select clean-select w-full bg-surface-container-low border border-outline-variant/20 rounded-xl text-label-sm">${realOptions}</select></label>`;
  }).join("");
  return `<div class="space-y-lg"><div><h2 class="font-headline-lg text-headline-lg">${uiText("Güncel Haberler","Latest News")}</h2><p class="text-on-surface-variant">${uiText("Sosyal medya ve dijital pazarlama gündemini güvenilir kaynaklardan takip edin.","Follow social media and digital marketing updates from trusted sources.")}</p></div>
    ${newsLoadError?`<section class="bg-error-container/20 border border-error/20 rounded-2xl p-md"><h3 class="font-headline-md text-[18px] text-error">${uiText("Haber servisi kullanılamıyor","News service unavailable")}</h3><p class="text-body-sm mt-1">${escapeHtml(newsLoadError)}</p></section>`:""}
    <section class="bg-surface-container-lowest border rounded-2xl p-4"><div class="news-filter-grid">${selectHtml}</div></section>
    <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">${list.length?list.map(n=>`<article class="group bg-surface-container-lowest border border-outline-variant/20 rounded-2xl overflow-hidden hover:shadow-md transition-all"><div class="relative">${newsSourceVisual(n)}</div><div class="p-4"><div class="flex items-center gap-2 text-[11px] text-on-surface-variant"><span>${escapeHtml(n.source)}</span><span>•</span><span>${formatDate(n.date)}</span></div><h3 class="font-headline-md text-[19px] mt-2 group-hover:text-secondary">${escapeHtml(uiText(n.title,n.titleEn))}</h3><p class="text-body-sm text-on-surface-variant mt-2">${escapeHtml(uiText(n.desc,n.descEn))}</p><button type="button" class="text-primary font-bold text-label-sm mt-3" data-command="openNewsLink(${n.id})">${uiText("Haberi Oku","Read Article")}</button></div></article>`).join(""):emptyState(uiText("Henüz gerçek haber verisi bulunmuyor","No live news data is available yet"))}</section>
    <section class="bg-primary-container/45 border border-primary-container rounded-2xl p-lg"><h2 class="font-headline-lg text-headline-lg font-bold">${uiText("Haber bültenimize abone olun","Subscribe to our newsletter")}</h2><p class="text-on-primary-container/80 mt-2 mb-4">${uiText("Haftalık gelişmeleri e-posta kutunuza gönderelim.","Get weekly updates in your inbox.")}</p><div class="flex flex-col sm:flex-row gap-2"><input name="newsletter-email" id="newsletter-email" type="email" class="flex-1 bg-surface-container-lowest border-none rounded-xl px-4 py-3" placeholder="${uiText("E-posta adresiniz","Your email address")}"><button type="button" class="bg-primary text-white px-6 py-3 rounded-xl" data-command="subscribeNewsletter()">${uiText("Kaydol","Subscribe")}</button></div><p class="field-error" id="newsletter-error"></p></section></div>`;
};
function setNewsFilter(key,value){newsFilters[key]=value;render();}
let newsLoaded=false;
function initNewsPage(){
  document.querySelectorAll("[data-news-filter]").forEach(select=>{
    select.addEventListener("change",()=>setNewsFilter(select.dataset.newsFilter,select.value),{once:true});
  });
  if(!newsLoaded&&!newsLoadError){
    newsLoaded=true;
    api.news.list().then(res=>{
      newsItems=Array.isArray(res?.data)?res.data:[];if(currentRoute==="news")render();
    }).catch(err=>{newsLoadError=err?.data?.message||err.message||uiText("Haber servisine ulaşılamadı.","Could not reach the news service.");if(currentRoute==="news")render();});
  }
}
function safeExternalUrl(value){try{const url=new URL(value);return url.protocol==="https:"?url.href:null;}catch(_){return null;}}
function openNewsLink(id){const n=newsItems.find(x=>x.id===id),url=safeExternalUrl(n?.url);if(url)window.open(url,"_blank","noopener,noreferrer");else showToast(uiText("Haber bağlantısı güvenli değil.","The article link is not safe."));}
async function subscribeNewsletter(){const input=document.getElementById("newsletter-email"),err=document.getElementById("newsletter-error");if(!input.value||!input.checkValidity()){err.textContent=uiText("Geçerli bir e-posta adresi girin.","Enter a valid email address.");return;}try{await api.news.subscribe(input.value.trim());err.textContent=uiText("Bülten aboneliğiniz kaydedildi.","Your newsletter subscription was saved.");input.value="";}catch(e){err.textContent=e?.data?.message||uiText("Abonelik kaydedilemedi.","Subscription could not be saved.");}}

/* ---------- Settings ---------- */
renderSettings=function(){
  const tabs=[["gorunum","palette","Görünüm"],["hesaplar","link","Bağlı Hesaplar"],["bildirimler","notifications_active","Bildirimler"],["guvenlik","security","Güvenlik"],["dil","language","Dil ve Bölge"],["davranis","tune","Sayfa Davranışı"]];
  return `<div class="space-y-lg"><div><h2 class="font-headline-lg text-headline-lg">${uiText("Ayarlar","Settings")}</h2><p class="text-on-surface-variant">${uiText("Platform tercihlerini, hesap güvenliğini ve görünümü buradan yönetin.","Manage platform preferences, account security and appearance here.")}</p></div><div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start"><div class="lg:col-span-3 space-y-2" id="settings-tabs" role="tablist" aria-label="${uiText("Ayar bölümleri","Settings sections")}">${tabs.map(t=>`<button type="button" id="settings-tab-${t[0]}" role="tab" aria-controls="settings-panels" aria-selected="false" tabindex="-1" class="settings-tab-btn w-full text-left px-4 py-3 rounded-xl flex items-center gap-3" data-tab="${t[0]}"><span class="material-symbols-outlined">${t[1]}</span><span class="font-label-md">${uiText(t[2],interfaceEnglish?.[t[2]]||t[2])}</span></button>`).join("")}</div><div class="lg:col-span-9 pb-xl" id="settings-panels" role="tabpanel"></div></div></div>`;
};
settingsPanelGorunum=function(){
  const cards=[
    ["light","Açık Mod","#fff8f6","#ffffff","#fde68a"],
    ["dark","Karanlık Mod","#251711","#493127","#dcc66e"],
    ["system","Sistem Teması","linear-gradient(90deg,#fff8f6 50%,#251711 50%)","linear-gradient(90deg,#ffffff 50%,#493127 50%)","#9b8a47"]
  ];
  return `<section class="bg-surface-container-lowest rounded-xl p-md border shadow-sm"><h3 class="font-headline-md text-headline-md">Görünüm</h3><p class="text-body-sm text-on-surface-variant mb-md">Uygulamanın tamamında kullanılacak temayı seçin.</p><div class="grid grid-cols-1 md:grid-cols-3 gap-md">${cards.map(x=>`<button type="button" aria-pressed="${frontendState.settings.theme===x[0]}" class="theme-card text-left rounded-xl overflow-hidden border-2 ${frontendState.settings.theme===x[0]?"border-primary":"border-transparent"}" data-theme="${x[0]}"><div class="h-24 p-3 flex gap-2" style="background:${x[2]}"><span class="w-5 h-full rounded-md opacity-80" style="background:${x[4]}"></span><span class="flex-1 space-y-2 pt-1"><i class="block h-3 w-3/4 rounded-full" style="background:${x[3]}"></i><i class="block h-3 w-1/2 rounded-full opacity-70" style="background:${x[3]}"></i><i class="block h-8 w-full rounded-lg opacity-80" style="background:${x[3]}"></i></span></div><div class="p-3 bg-surface-container flex justify-between"><span class="font-label-md">${x[1]}</span><span aria-hidden="true" class="material-symbols-outlined">${frontendState.settings.theme===x[0]?"check_circle":"radio_button_unchecked"}</span></div></button>`).join("")}</div></section>`;
};

settingsPanelBildirimler=function(){
  const rows=[["email","E-posta bildirimleri","Yeni yorum ve beğenilerde e-posta al"],["push","Push bildirimleri","Uygulama içindeki önemli olayları anlık gör"],["weekly","Haftalık özet raporu","Her pazartesi performans özeti al"],["connection","Bağlantı uyarıları","Bir hesap bağlantısı koptuğunda uyar"]],s=frontendState.settings.notifications;
  return `<section class="bg-surface-container-lowest rounded-xl p-md border shadow-sm"><div class="flex justify-between gap-2 mb-md"><div><h3 class="font-headline-md text-headline-md">Bildirim Tercihleri</h3><p class="text-body-sm text-on-surface-variant">Bildirim türlerini ayrı ayrı yönetebilirsiniz.</p></div><div class="flex gap-2"><button type="button" class="text-label-sm text-primary" data-command="setAllNotifications(true)">Tümünü aç</button><button type="button" class="text-label-sm text-error" data-command="setAllNotifications(false)">Tümünü kapat</button></div></div><div class="space-y-3">${rows.map(r=>`<div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-low/40"><div><p class="font-semibold">${r[1]}</p><p class="text-body-sm text-on-surface-variant">${r[2]}</p></div><button type="button" aria-label="${escapeHtml(r[1])}" aria-pressed="${s[r[0]]}" class="w-12 h-6 rounded-full relative ${s[r[0]]?"bg-primary":"bg-outline-variant/30"}" data-command="toggleNotificationSetting('${r[0]}')"><span class="absolute top-1 ${s[r[0]]?"right-1":"left-1"} w-4 h-4 bg-white rounded-full"></span></button></div>`).join("")}</div></section>`;
};
settingsPanelGuvenlik=function(){
  const security=frontendState.settings.security||defaultFrontendState.settings.security;
  return `<section class="bg-surface-container-lowest rounded-xl p-md border shadow-sm space-y-lg"><div><h3 class="font-headline-md text-headline-md">Güvenlik</h3><p class="text-body-sm text-on-surface-variant">Şifre ve oturum güvenliğinizi yönetin.</p></div><div class="flex flex-wrap gap-2"><button type="button" class="px-4 py-2.5 bg-primary text-white rounded-xl" data-command="openPasswordDialog()">Şifreyi Değiştir</button><button type="button" class="px-4 py-2.5 ${security.twoFactorEnabled?"bg-tertiary-container text-on-tertiary-container":"bg-primary-container"} rounded-xl" data-command="${security.twoFactorEnabled?"disable2FA()":"open2FADialog()"}">${security.twoFactorEnabled?"2FA Etkin • Devre Dışı Bırak":"2FA Etkinleştir"}</button><button type="button" class="px-4 py-2.5 border border-error text-error rounded-xl" data-command="confirmAllSessions()">Tüm cihazlardan çıkış yap</button></div><div class="space-y-2"><p class="text-label-sm uppercase text-on-surface-variant">Aktif Oturumlar</p>${security.sessions.map(session=>`<div class="flex justify-between p-3 bg-surface rounded-xl"><span>${escapeHtml(session.label)}</span>${session.current?`<span class="text-[11px] text-tertiary font-bold">Bu cihaz</span>`:`<button type="button" class="text-error text-[12px] font-bold" data-command="confirmSingleSession('${escapeHtml(session.id)}')">Oturumu Kapat</button>`}</div>`).join("")||emptyState("Aktif oturum bulunmuyor")}</div></section>`;
};

