/* =========================================================
   BRAND LOGOS, WORKING LANGUAGE SETTING & MULTI-ACCOUNT SWITCHER
   Extends the existing shell without changing its layout.
========================================================== */
const platformBrandAssets = {
  instagram:{color:"#FF0069",path:"M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"},
  facebook:{color:"#0866FF",path:"M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"},
  x:{color:"#000000",path:"M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"},
  linkedin:{color:"#0A66C2",path:"M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.039-1.852-3.039-1.853 0-2.136 1.447-2.136 2.942v5.666H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM3.56 9h3.555v11.452H3.56z"},
  tiktok:{color:"#000000",path:"M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"},
  youtube:{color:"#FF0000",path:"M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"},
  threads:{color:"#000000",path:"M18.263 11.097c-.03-3.486-1.92-5.586-5.111-5.586-2.13 0-3.922.963-4.863 2.499l2.062 1.438c.535-.843 1.272-1.543 2.628-1.543 1.528 0 2.318.85 2.544 2.431a15 15 0 0 0-2.236-.173c-4.125 0-6.068 1.867-6.068 4.336s1.943 3.99 4.804 3.99c3.139 0 5.013-2.115 5.781-4.735.798.361 1.348 1.204 1.348 2.47 0 3.387-3.907 5.232-7.22 5.232-4.885 0-8.077-3.207-8.077-8.424 0-6.392 4.223-10.487 9.9-10.487 3.808 0 5.69 1.671 6.97 3.914l2.108-1.475C21.44 2.078 18.331 0 13.663 0 6.227 0 1.168 5.277 1.168 12.934c0 7 4.953 11.066 10.856 11.066 4.878 0 9.809-2.846 9.809-7.716 0-2.545-1.46-4.231-3.569-5.187m-6.33 4.855c-1.077 0-2.026-.512-2.026-1.453 0-1.483 1.822-1.934 3.606-1.934.678 0 1.34.045 1.927.173-.422 1.927-1.671 3.215-3.508 3.214Z"}
};

function platformLogo(key,size=20,extraClass="",color="currentColor"){
  const asset=platformBrandAssets[key]||platformBrandAssets.instagram;
  return `<svg class="brand-logo-${key} ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" role="img" aria-label="${escapeHtml(platformLabel(key))} logosu" style="color:${color};flex:none"><path fill="currentColor" d="${asset.path}"></path></svg>`;
}
function platformBadge(key,size=20,dimension=44){
  const bg=key==="instagram"?platformCatalog.instagram.brand:platformBrandAssets[key].color;
  return `<div class="shrink-0 rounded-xl text-white flex items-center justify-center" style="width:${dimension}px;height:${dimension}px;background:${bg}">${platformLogo(key,size,"brand-logo-on-color","white")}</div>`;
}

function createPlatformProfile(key,id,handle,name,overrides={}){
  return {
    id,handle,name,status:"active",connected:true,
    followers:"—",reach:"—",engagement:"—",dataReady:false,
    extra:{label:uiText("Veri","Data"),value:"—"},posts:[],tip:"",...overrides
  };
}
function multiAccountSeeds(){
  return Object.fromEntries(platformKeys.map(key=>[key,[]]));
}
function ensureMultiAccountState(){
  frontendState.multiAccounts=frontendState.multiAccounts||{};
  const seeds=multiAccountSeeds();
  platformKeys.forEach(key=>{
    if(!Object.prototype.hasOwnProperty.call(frontendState.multiAccounts,key)){
      const root=frontendState.accounts[key];
      frontendState.multiAccounts[key]={selectedId:null,profiles:[]};
    }
    const group=frontendState.multiAccounts[key];
    group.profiles=Array.isArray(group.profiles)?group.profiles:[];
    group.selectedId=safeStateId(group.selectedId,"");
    const usedProfileIds=new Set();
    group.profiles.forEach((profile,index)=>{
      profile.id=safeStateId(profile.id,`${key}-${index+1}`);
      if(usedProfileIds.has(profile.id))profile.id=`${key}-${index+1}`;
      usedProfileIds.add(profile.id);
      profile.connected=profile.connected!==false;
      profile.status=profile.status||"active";
      profile.posts=Array.isArray(profile.posts)?profile.posts:[];
      profile.extra=profile.extra||{label:uiText("Veri","Data"),value:"—"};
    });
    if(!group.profiles.some(x=>x.id===group.selectedId)) group.selectedId=group.profiles[0]?.id||null;
    syncAccountSummary(key);
  });
  frontendState.posts.forEach(post=>{
    post.accountIds=post.accountIds||{};
    post.platforms.forEach(label=>{const key=platformKeyFromLabel(label);if(!post.accountIds[key])post.accountIds[key]=connectedProfiles(key)[0]?.id||"";});
    post.advancedSettings=post.advancedSettings||{};
  });
  frontendState.settings.language=frontendState.settings.language||"tr";
  document.documentElement.lang=frontendState.settings.language;
  persistState();
}
function accountGroup(key){return frontendState.multiAccounts?.[key]||{selectedId:null,profiles:[]};}
function connectedProfiles(key){return accountGroup(key).profiles.filter(x=>x.connected!==false);}
function selectedPlatformAccount(key){
  const group=accountGroup(key),profiles=connectedProfiles(key);
  return profiles.find(x=>x.id===group.selectedId)||profiles[0]||null;
}
function syncAccountSummary(key){
  const profiles=connectedProfiles(key),selected=profiles.find(x=>x.id===accountGroup(key).selectedId)||profiles[0]||null;
  const root=frontendState.accounts[key]||(frontendState.accounts[key]={});
  root.connected=profiles.length>0;
  root.status=selected?.status||"disconnected";
  root.handle=selected?.handle||"";
  if(selected) frontendState.multiAccounts[key].selectedId=selected.id;
}
async function selectPlatformAccount(key,id,notify=true){
  const group=accountGroup(key);
  if(!group.profiles.some(x=>x.id===id&&x.connected!==false))return;
  const selectedAccounts=Object.fromEntries(platformKeys.map(k=>[k,accountGroup(k).selectedId]).filter(([,v])=>v));
  if(!await syncSettingsToBackend({selectedAccounts:{...selectedAccounts,[key]:id}}))return;
  group.selectedId=id;syncAccountSummary(key);persistState();
  if(currentRoute==="platform"&&currentPlatform===key)render();
  if(notify)showToast(frontendState.settings.language==="en"?"Account changed":"Hesap değiştirildi");
}

syncPlatformMenu=function(){document.querySelectorAll(".platform-link").forEach(link=>link.classList.remove("hidden"));};

accountAction=function(key,action,accountId=""){
  const group=accountGroup(key);
  const account=accountId?connectedProfiles(key).find(profile=>profile.id===accountId):selectedPlatformAccount(key);
  if(action==="connect"||!account){openConnectDialog(key);return;}
  if(action==="remove"){
    confirmAction(uiText("Bağlantıyı Kaldır","Remove Connection"),uiText(`${platformLabel(key)} • ${account.handle} hesabının bağlantısı kaldırılacak.`,`${platformLabel(key)} • ${account.handle} will be disconnected.`),uiText("Bağlantıyı Kaldır","Remove Connection"),async()=>{
      try{await api.accounts.remove(account.id);}catch(err){showToast(err?.data?.message||uiText("Bağlantı kaldırılamadı.","The connection could not be removed."));return;}
      group.profiles=group.profiles.filter(x=>x.id!==account.id);
      await hydrateFromBackend();
      group.selectedId=group.profiles[0]?.id||null;
      syncAccountSummary(key);logActivity("link_off",uiText("Hesap bağlantısı kaldırıldı","Account disconnected"),`${platformLabel(key)} • ${account.handle}`);persistState();closeDialog();syncPlatformMenu();
      if(currentRoute==="platform"&&currentPlatform===key)render();
      else{activeSettingsTab="hesaplar";render();}
      showToast("Hesap bağlantısı kaldırıldı");
    });return;
  }
  if(action==="refresh"){hydrateSelectedPlatformData(key,true,account.id);return;}
  // "Reauthorize" would need a real OAuth re-consent flow, which requires
  // platform credentials that aren't configured - report that honestly
  // instead of flipping the status to active.
  api.accounts.connect(key).then(res=>{
    if(res?.authorizationUrl){window.location.href=res.authorizationUrl;return;}
  }).catch(err=>{
    showToast(err?.data?.message||uiText(`${platformLabel(key)} için yeniden yetkilendirme yapılamıyor: API kimlik bilgileri tanımlı değil.`,`Cannot reauthorize ${platformLabel(key)}: API credentials are not configured.`));
  });
};
openConnectDialog=function(preselected=""){
  openDialog("Yeni Hesap Bağla",`
    <div class="space-y-4">
      <div><label for="connect-platform" class="text-label-sm">Platform</label><select name="connect-platform" id="connect-platform" class="clean-select w-full mt-1 rounded-xl bg-surface-container-low border-none">${platformKeys.map(k=>`<option value="${k}" ${k===preselected?"selected":""}>${escapeHtml(platformLabel(k))}</option>`).join("")}</select></div>
      <p id="connect-account-error" class="field-error"></p>
      <p class="text-body-sm text-on-surface-variant">${uiText("Hesabınızı bağlamak için ilgili platformun resmi giriş ekranına yönlendirileceksiniz.","You'll be redirected to the platform's official login screen to connect your account.")}</p>
    </div>`,
    `<button type="button" class="px-5 py-2.5 bg-surface-container rounded-xl" data-command="closeDialog()">Vazgeç</button><button type="button" class="px-5 py-2.5 bg-primary text-white rounded-xl" data-command="connectSelectedAccount()">Bağla</button>`);
};
connectSelectedAccount=async function(){
  const key=document.getElementById("connect-platform").value;
  const error=document.getElementById("connect-account-error");
  error.textContent=uiText("Bağlanılıyor…","Connecting…");
  try{
    const res=await api.accounts.connect(key);
    if(res?.authorizationUrl){window.location.href=res.authorizationUrl;return;}
    error.textContent=uiText("Bağlantı başlatılamadı.","Could not start the connection.");
  }catch(err){
    // Honest: no fake account is ever created when the platform's OAuth
    // credentials aren't configured on the server.
    error.textContent=err?.data?.message||err.message||uiText(`${platformLabel(key)} için API kimlik bilgileri tanımlı olmadığından gerçek bağlantı kurulamıyor.`,`Cannot make a real connection because ${platformLabel(key)}'s API credentials are not configured.`);
  }
};

async function hydrateSelectedPlatformData(key,force=false,accountId=""){
  const account=accountId?connectedProfiles(key).find(a=>a.id===accountId):selectedPlatformAccount(key);if(!account||account._platformLoading||account._platformHydrated&&!force)return;
  account._platformLoading=true;
  try{
    if(!(await capabilities()).platforms[key]){account.tip=uiText("Platform bağlantı servisi yapılandırılmadı.","Platform connection service is not configured.");account.status="warning";account._platformHydrated=true;if(currentRoute==="platform"&&currentPlatform===key)render();return;}
    const [statsRes,postsRes,analyticsRes]=await Promise.all([api.platforms.stats(account.id,force).catch(()=>null),api.platforms.posts(account.id).catch(()=>null),api.platforms.analytics(account.id).catch(()=>null)]);
    if(!statsRes||!postsRes||!analyticsRes)showToast(uiText("Bazı platform verileri alınamadı.","Some platform data could not be loaded."));
    const metric=statsRes?.data;if(metric){account.followers=metric.followers??"—";account.reach=metric.reach??"—";account.engagement=metric.engagement??"—";account.extra={label:uiText("Gösterim","Impressions"),value:metric.impressions??"—"};account.dataReady=true;account.lastSync=metric.captured_at||metric.capturedAt||account.lastSync;}
    account.metricHistory=Array.isArray(statsRes?.history)?statsRes.history.slice().reverse():[];
    const analytics=Array.isArray(analyticsRes?.data)?analyticsRes.data:[],latestByPost=new Map();analytics.forEach(row=>{if(!latestByPost.has(row.post_id))latestByPost.set(row.post_id,row);});
    account.posts=(Array.isArray(postsRes?.data)?postsRes.data:[]).map(post=>{const m=latestByPost.get(post.id)||{};return [post.title||String(post.content||"").slice(0,50),m.likes??"—",m.comments??"—",post.id];});
    account._platformHydrated=true;persistState();if(currentRoute==="platform"&&currentPlatform===key)render();
  }finally{account._platformLoading=false;}
}

renderPlatform=function(key){
  const p=platformCatalog[key]||platformCatalog.instagram,profiles=connectedProfiles(key),account=selectedPlatformAccount(key);
  if(!account)return `<div class="max-w-xl mx-auto bg-surface-container-lowest rounded-3xl p-lg text-center border">${platformBadge(key,30,64)}<h2 class="font-headline-md text-headline-md mt-3">${escapeHtml(p.label)} ${uiText("bağlı değil","is not connected")}</h2><p class="text-on-surface-variant mt-2">Bu platformun verilerini görmek için bir hesap bağlayın.</p><button type="button" class="mt-5 px-6 py-3 bg-primary text-white rounded-xl" data-command="openConnectDialog('${key}')">Hesap Bağla</button></div>`;
  const syncLabel=account.lastSync?formatPostDateTime({scheduledAt:new Date(sdParseTimestamp(account.lastSync)).toISOString()}):uiText("Henüz yok","Not yet");
  const planned=frontendState.posts.filter(post=>post.platforms.some(label=>platformKeyFromLabel(label)===key)&&normalizePostStatus(post.status)!=="published"&&((post.accountIds?.[key]||post.accountId)?String(post.accountIds?.[key]||post.accountId)===String(account.id):account.id===profiles[0]?.id));
  const history=platformHistoryInRange(account.metricHistory||[]),historyMax=Math.max(1,...history.flatMap(item=>[Number(item.followers||0),Number(item.engagement||0)]));
  const rangeBars=history.map(item=>[Math.max(2,Math.round(Number(item.followers||0)/historyMax*100)),Math.max(2,Math.round(Number(item.engagement||0)/historyMax*100))]);
  const rangeStats=account.dataReady===false?[]:[[uiText(key==="youtube"?"Abone":"Takipçi",key==="youtube"?"Subscribers":"Followers"),metricForRange(account.followers,key,account.id)],[uiText("Erişim","Reach"),metricForRange(account.reach,key,account.id)],[uiText("Etkileşim","Engagement"),metricForRange(account.engagement,key,account.id)],[account.extra.label,metricForRange(account.extra.value,key,account.id)]];
  return `<div class="platform-page space-y-md">
    <section class="platform-account-card bg-surface-container-lowest rounded-2xl border shadow-sm overflow-visible">
      <div class="platform-account-card-inner flex flex-col gap-4">
        <div class="platform-account-main">
          <div class="flex items-center gap-3.5 min-w-0">
            ${platformBadge(key,24,52)}
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="font-headline-md text-[22px] leading-7">${escapeHtml(p.label)}</h2>
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 ${account.status==="warning"?"bg-orange-100 text-orange-700":"bg-green-100 text-green-700"} text-[10px] font-bold rounded-full">
                  <span class="w-1.5 h-1.5 rounded-full ${account.status==="warning"?"bg-orange-500":"bg-green-500"}"></span>
                  ${account.status==="warning"?uiText("BAĞLANTI SORUNU","CONNECTION ISSUE"):uiText("BAĞLI","CONNECTED")}
                </span>
              </div>
              <p class="text-[12px] text-on-surface-variant mt-0.5">${frontendState.settings.language==="en"?`${profiles.length} connected account${profiles.length===1?"":"s"}`:`${profiles.length} bağlı hesap`}</p>
            </div>
          </div>
          <p class="text-[11px] text-on-surface-variant">${uiText("Son senkronizasyon","Last sync")}: ${escapeHtml(syncLabel)}</p><div class="platform-account-toolbar">
            <label class="platform-account-field">
              <span class="platform-account-field-label">${uiText("Hesap","Account")}</span>
              <select name="platform-account" aria-label="${uiText("Hesap Seç","Select Account")}" class="platform-account-select account-select clean-select w-full rounded-xl text-label-sm font-semibold" data-change-command="selectPlatformAccount('${key}',this.value)">${profiles.map(x=>`<option value="${escapeHtml(x.id)}" ${x.id===account.id?"selected":""}>${escapeHtml(x.name)} · ${escapeHtml(x.handle)}</option>`).join("")}</select>
            </label>
            <button type="button" aria-label="${uiText("Hesap Ekle","Add Account")}" class="platform-add-account px-4 rounded-xl text-label-sm font-semibold flex items-center justify-center gap-2 transition-all shrink-0" data-command="openConnectDialog('${key}')"><span class="material-symbols-outlined text-[18px]">add</span><span class="platform-add-account-text">${uiText("Hesap Ekle","Add Account")}</span></button>
            <label class="platform-range-field">
              <span class="platform-account-field-label">${uiText("Tarih aralığı","Date range")}</span>
              <select name="platform-range" aria-label="${uiText("Tarih aralığı","Date range")}" class="platform-range-select clean-select w-full rounded-xl bg-surface-container-low border-none text-label-sm" data-change-command="setPlatformRange(this.value)">${["Son 7 Gün","Son 30 Gün","Son 90 Gün","Özel Tarih"].map(x=>`<option value="${x}" ${x===platformRange?"selected":""}>${uiText(x,{"Son 7 Gün":"Last 7 Days","Son 30 Gün":"Last 30 Days","Son 90 Gün":"Last 90 Days","Özel Tarih":"Custom Range"}[x])}</option>`).join("")}</select>
            </label>
            <details class="platform-actions relative shrink-0">
              <summary aria-label="${uiText("Hesap işlemleri","Account actions")}" title="${uiText("Hesap işlemleri","Account actions")}" class="list-none w-11 rounded-xl border border-outline-variant/30 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface-variant hover:text-on-surface flex items-center justify-center cursor-pointer transition-colors" style="list-style:none">
                <span class="material-symbols-outlined text-[22px]">more_horiz</span>
              </summary>
              <div class="absolute right-0 top-full mt-2 w-56 rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-xl p-1.5 z-30">
                ${account.status==="warning"?"":`<button type="button" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-body-sm hover:bg-surface-container-low transition-colors" data-command="this.closest('details').removeAttribute('open');accountAction('${key}','reauthorize','${escapeHtml(account.id)}')"><span class="material-symbols-outlined text-[19px] text-primary">sync</span><span>${uiText("Yeniden Yetkilendir","Reauthorise")}</span></button>`}
                ${account.status==="warning"?"":`<div class="h-px bg-outline-variant/20 my-1"></div>`}
                <button type="button" class="danger-action w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-body-sm text-error hover:bg-error/5 transition-colors" data-command="this.closest('details').removeAttribute('open');accountAction('${key}','remove','${escapeHtml(account.id)}')"><span class="material-symbols-outlined text-[19px]">link_off</span><span>${uiText("Bağlantıyı Kaldır","Remove Connection")}</span></button>
              </div>
            </details>
          </div>
        </div>

        ${account.status==="warning"?`<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/40 px-4 py-3 text-orange-800 dark:text-orange-200"><div class="flex items-start gap-2.5"><span class="material-symbols-outlined text-[20px] mt-0.5">warning</span><div><p class="text-body-sm font-semibold">${frontendState.settings.language==="en"?"Account connection must be renewed":"Hesap bağlantısının yenilenmesi gerekiyor"}</p><p class="text-[12px] text-orange-700 dark:text-orange-300 mt-0.5">${frontendState.settings.language==="en"?`${escapeHtml(account.handle)} data cannot be updated.`:`${escapeHtml(account.handle)} hesabının verileri güncellenemiyor.`}</p></div></div><button type="button" class="h-9 px-3.5 rounded-lg bg-orange-700 text-white text-label-sm font-semibold sm:shrink-0" data-command="accountAction('${key}','reauthorize','${escapeHtml(account.id)}')">${uiText("Yeniden Yetkilendir","Reauthorise")}</button></div>`:""}
      </div>
    </section>
    ${account.dataReady===false?`<section class="platform-data-empty bg-surface-container-lowest rounded-2xl border"><span class="material-symbols-outlined text-[48px] text-primary opacity-70">query_stats</span><h3 class="font-headline-md text-headline-md mt-3">${uiText("Henüz performans verisi yok","No performance data yet")}</h3><p class="text-body-sm text-on-surface-variant mt-2 max-w-lg">${escapeHtml(account.tip||uiText("Performans verileri platformdan alındığında burada görünecek.","Performance data will appear here when it is available from the platform."))}</p></section>`:`<div class="grid grid-cols-1 lg:grid-cols-12 gap-md"><div class="lg:col-span-8 space-y-md">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-md">${rangeStats.map((item,i)=>`<button type="button" class="bg-surface-container-lowest p-md rounded-xl border text-left hover:-translate-y-0.5" data-command="openStatDetail('${escapeHtml(item[0])}','${escapeHtml(item[1])}','${key}')"><p class="text-on-surface-variant text-label-sm">${escapeHtml(item[0])}</p><span class="font-headline-md">${escapeHtml(item[1])}</span></button>`).join("")}</div>
      <div class="bg-surface-container-lowest rounded-xl p-md border"><div class="flex items-center justify-between mb-md"><h3 class="font-label-md">Takipçi ve Etkileşim Grafiği</h3><span class="text-[11px] text-on-surface-variant">${platformRange}</span></div>${rangeBars.length?`<div class="h-40 flex items-end gap-3 border-b border-l px-3">${rangeBars.map(h=>`<div class="flex-1 flex gap-1 items-end h-full"><div class="flex-1 bg-primary-container rounded-t" style="height:${h[0]}%"></div><div class="flex-1 bg-secondary-container rounded-t" style="height:${h[1]}%"></div></div>`).join("")}</div><div class="flex gap-4 mt-2 text-[11px]"><span>● Takipçi</span><span class="text-secondary">● Etkileşim</span></div>`:emptyState(uiText("Bu aralık için metrik geçmişi yok","No metric history for this range"))}</div>
      <div class="bg-surface-container-lowest rounded-xl p-md border"><h3 class="font-label-md mb-md">Son Gönderiler</h3><div class="space-y-2">${account.posts.length?account.posts.map((post,i)=>`<button type="button" class="w-full flex items-center gap-3 p-3 bg-surface-container-low rounded-xl text-left" data-command="openPlatformPostDetail('${key}',${i})">${platformLogo(key,18,"",platformBrandAssets[key].color)}<span class="flex-1 font-bold text-body-sm">${escapeHtml(post[0])}</span><span class="text-[12px] inline-flex items-center gap-1"><span aria-hidden="true" class="material-symbols-outlined text-[14px]">favorite</span>${escapeHtml(post[1])}<span aria-hidden="true" class="material-symbols-outlined text-[14px]">chat_bubble</span>${escapeHtml(post[2])}</span></button>`).join(""):emptyState("Bu hesapta henüz gönderi yok")}</div></div>
    </div><div class="lg:col-span-4 space-y-md"><div class="bg-surface-container-lowest rounded-xl p-md border"><div class="flex justify-between mb-md"><h3 class="font-label-md">Planlanan Gönderiler</h3><button type="button" class="text-primary text-label-sm" data-route="calendar">Tümü</button></div><div class="space-y-2">${planned.length?planned.map(postCardSmall).join(""):emptyState("Bu hesap için planlanan gönderi yok")}</div></div><div class="rounded-2xl p-md bg-primary-container/40 border border-primary-container"><div class="flex gap-2 items-center text-primary">${platformLogo(key,20)}<h3 class="font-label-md">Hesaba Özel İpucu</h3></div><p class="text-body-sm text-on-surface-variant mt-2">${escapeHtml(account.tip)}</p></div></div></div></div>`}
  </div>`;
};
if(!window.__socialDashPlatformActionMenus){
  window.__socialDashPlatformActionMenus=true;
  document.addEventListener("click",event=>{
    document.querySelectorAll("details.platform-actions[open]").forEach(menu=>{
      if(!menu.contains(event.target))menu.removeAttribute("open");
    });
  });
  document.addEventListener("keydown",event=>{
    if(event.key==="Escape")document.querySelectorAll("details.platform-actions[open]").forEach(menu=>menu.removeAttribute("open"));
  });
}
openPlatformPostDetail=function(key,index){
  const post=selectedPlatformAccount(key)?.posts[index];if(!post)return;
  openDialog("Gönderi Performansı",`<div class="flex items-center gap-3">${platformLogo(key,24,"",platformBrandAssets[key].color)}<h3 class="font-headline-md text-[20px]">${escapeHtml(post[0])}</h3></div><div class="grid grid-cols-2 gap-3 mt-4"><div class="p-4 bg-surface-container-low rounded-xl"><small>Beğeni</small><p class="text-headline-md font-bold">${escapeHtml(post[1])}</p></div><div class="p-4 bg-surface-container-low rounded-xl"><small>Yorum</small><p class="text-headline-md font-bold">${escapeHtml(post[2])}</p></div></div>`,`<button type="button" class="px-5 py-2.5 bg-primary text-white rounded-xl" data-command="closeDialog()">Kapat</button>`);
};

settingsPanelHesaplar=function(){
  return `<section class="bg-surface-container-lowest rounded-xl p-md border shadow-sm"><div class="mb-md flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3"><div><h3 class="font-headline-md text-headline-md">Bağlı Hesaplar</h3><p class="text-body-sm text-on-surface-variant">Her platforma birden fazla hesap bağlayabilir ve seçili hesabı değiştirebilirsiniz.</p></div><button type="button" class="px-4 py-2 bg-primary-container rounded-lg flex gap-2 items-center justify-center" data-command="openConnectDialog()"><span class="material-symbols-outlined text-[18px]">add</span>Yeni Hesap Bağla</button></div><div class="space-y-3">${platformKeys.map(key=>{
    const p=platformCatalog[key],group=accountGroup(key),profiles=connectedProfiles(key);
    return `<div class="p-4 bg-surface rounded-xl border"><div class="flex items-center justify-between gap-3"><div class="flex items-center gap-3">${platformBadge(key,20,44)}<div><p class="font-label-md">${escapeHtml(p.label)}</p><p class="text-[11px] text-on-surface-variant">${profiles.length} bağlı hesap</p></div></div><button type="button" class="px-3 py-2 border border-primary text-primary rounded-lg text-label-sm" data-command="openConnectDialog('${key}')">Hesap Ekle</button></div>${profiles.length?`<div class="mt-3 space-y-2">${profiles.map(account=>`<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-surface-container-low rounded-xl"><button type="button" class="text-left min-w-0" data-command="selectPlatformAccount('${key}','${escapeHtml(account.id)}',false);navigate('platform','${key}')"><span class="font-label-md block truncate">${escapeHtml(account.name)} • ${escapeHtml(account.handle)}</span><span class="text-[10px] font-bold ${account.status==="warning"?"text-orange-700":"text-green-700"}">${account.status==="warning"?"BAĞLANTI SORUNU":"BAĞLI"} ${group.selectedId===account.id?"• SEÇİLİ":""}</span></button><div class="flex gap-2"><button type="button" class="px-3 py-2 border border-primary text-primary rounded-lg text-label-sm" data-command="selectPlatformAccount('${key}','${escapeHtml(account.id)}',false);navigate('platform','${key}')">Aç</button><button type="button" class="px-3 py-2 text-primary rounded-lg text-label-sm" data-command="accountAction('${key}','refresh','${escapeHtml(account.id)}')">Yenile</button><button type="button" class="p-2 text-error" aria-label="${escapeHtml(account.handle)} bağlantısını kaldır" data-command="accountAction('${key}','remove','${escapeHtml(account.id)}')"><span class="material-symbols-outlined">link_off</span></button></div></div>`).join("")}</div>`:`<div class="mt-3 p-3 bg-surface-container-low rounded-xl text-body-sm text-on-surface-variant">Bağlı hesap yok.</div>`}</div>`;
  }).join("")}</div></section>`;
};

postCardSmall=function(post){
  const key=platformKeyFromLabel(post.platforms[0]);
  return `<button type="button" class="calendar-post-card w-full group flex items-start gap-sm p-sm rounded-xl hover:bg-surface-container text-left border border-transparent hover:border-primary-container/30" data-command="openPostDetail(${post.id})"><div class="h-11 w-11 rounded-xl bg-primary-container/40 flex items-center justify-center shrink-0">${platformLogo(key,20,"",platformBrandAssets[key].color)}</div><div class="calendar-post-copy flex-1 min-w-0"><p class="calendar-post-title font-label-md text-label-md">${escapeHtml(post.title)}</p><p class="calendar-post-meta text-[11px] text-on-surface-variant">${escapeHtml(post.platforms.join(", "))} • ${escapeHtml(formatPostDateTime(post))}</p></div></button>`;
};
selectPlatform=function(name,close=true){
  const chips=document.getElementById("selected-chips");
  const existing=chips.querySelector(`[data-platform-name="${CSS.escape(name)}"]`);
  if(existing){
    existing.remove();
    document.querySelectorAll("#platform-dropdown [role='option']").forEach(option=>{if(normalizeText(option.textContent)===normalizeText(name))option.setAttribute("aria-selected","false");});
    checkChips();composeDirty=true;renderAdvancedSettings();updateCharCount();
    if(close)toggleDropdown("platform-dropdown");
    return;
  }
  document.getElementById("platform-btn-text").classList.add("hidden");
  const key=platformKeyFromLabel(name),chip=document.createElement("div");
  chip.dataset.platformName=name;
  chip.className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-body-sm font-semibold border border-primary/20";
  chip.innerHTML=`${platformLogo(key,14,"",platformBrandAssets[key].color)}<span>${escapeHtml(name)}</span><span aria-hidden="true" class="material-symbols-outlined text-[14px]">close</span>`;
  document.querySelectorAll("#platform-dropdown [role='option']").forEach(option=>{if(normalizeText(option.textContent)===normalizeText(name))option.setAttribute("aria-selected","true");});
  chips.appendChild(chip);composeDirty=true;if(close)toggleDropdown("platform-dropdown");renderAdvancedSettings();updateCharCount();
};

function syncPlatformBrandLogos(){
  /* Brand SVGs are rendered directly in the sidebar and compose menu. */
}

