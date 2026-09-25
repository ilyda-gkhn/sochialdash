/* =========================================================
   BACKEND DATA HYDRATION
   Replaces the local demo/frontendState collections with the
   authenticated user's real data from the database, so the DB is
   the source of truth (DATABASE -> API -> frontendState -> UI).
   Called after login and on app boot when a session already exists.
========================================================== */
function sdParseTimestamp(sqlTimestamp){
  if(!sqlTimestamp)return Date.now();
  const iso=String(sqlTimestamp).includes("T")?sqlTimestamp:String(sqlTimestamp).replace(" ","T")+"Z";
  const t=Date.parse(iso);
  return Number.isFinite(t)?t:Date.now();
}
function sdChatGroupLabel(updatedAt){
  const days=Math.floor((Date.now()-sdParseTimestamp(updatedAt))/86400000);
  if(days<=0)return uiText("Bugün","Today");
  if(days===1)return uiText("Dün","Yesterday");
  return uiText(`${days} gün önce`,`${days} days ago`);
}
// Fetches every page from a paginated API endpoint and concatenates the
// results, so the UI never silently drops records once an account has
// more than one page's worth of posts/notifications/media.
async function sdFetchAllPages(listPageFn,pageSize,maxPages=50){
  const first=await listPageFn(1,pageSize);
  if(!first||!Array.isArray(first.data))return first;
  let items=first.data.slice();
  const totalPages=Number(first.totalPages)||1;
  for(let page=2;page<=Math.min(totalPages,maxPages);page++){
    const next=await listPageFn(page,pageSize).catch(()=>null);
    if(!Array.isArray(next?.data))break;
    items=items.concat(next.data);
  }
  return {...first,data:items};
}
async function hydrateFromBackend(){
  const generation=sdAuthGeneration;
  if(!localStorage.getItem("socialdash_token"))return false;
  try{
    const [settingsRes,notifRes,mediaRes,postsRes,chatsRes,accountsRes,dashboardRes]=await Promise.all([
      api.settings.get().catch(()=>null),
      sdFetchAllPages(api.notifications.listPage,100).catch(()=>null),
      sdFetchAllPages(api.media.listPage,100).catch(()=>null),
      sdFetchAllPages(api.posts.listPage,100).catch(()=>null),
      api.aiChats.list().catch(()=>null),
      api.accounts.list().catch(()=>null),
      api.dashboard().catch(()=>null)
    ]);

    if(generation!==sdAuthGeneration)return false;
    if(settingsRes?.data){
      const s=settingsRes.data;
      frontendState.settings={
        ...frontendState.settings,
        theme:s.theme, language:s.language, timezone:s.timezone, dateFormat:s.dateFormat,
        autoDraft:s.autoDraft, sidebarOpen:s.sidebarOpen,
        notifications:{email:s.emailNotifications,push:s.pushNotifications,weekly:s.weeklySummary,connection:s.connectionAlerts}
      };
    }

    if(Array.isArray(notifRes?.data)){
      frontendState.notifications=notifRes.data.map(n=>({
        id:n.id, icon:n.icon||"notifications", color:n.color||"primary",
        title:n.title||"", body:n.message||"", createdAt:sdParseTimestamp(n.created_at), read:!!n.is_read
      }));
    }

    if(Array.isArray(mediaRes?.data)){
      frontendState.media=mediaRes.data.map(m=>({
        id:m.id, name:m.name||"medya", tag:m.tag||"FOTOĞRAF",
        icon:m.tag==="VIDEO"?"movie":m.tag==="GIF"?"gif":"image",
        size:m.size?`${(m.size/1024/1024).toFixed(1)} MB`:"", dateISO:m.dateISO||todayISO(),
        dims:"", uses:[], mime:m.mimeType||"", bytes:m.size||0, dataUrl:m.url
      }));
    }

    if(Array.isArray(postsRes?.data)){
      frontendState.posts=postsRes.data.map(p=>{const parts=scheduledAtParts(p.scheduledAt);return ({
        id:p.id, title:p.title||(p.text||"").slice(0,52), text:p.text||"", platforms:p.platforms||[],
        date:parts.date||p.date||todayISO(), time:parts.time||p.time||"09:00", scheduledAt:p.scheduledAt||null, status:normalizePostStatus(p.status),
        mediaId:p.mediaId||null,mediaIds:p.mediaIds||[p.mediaId].filter(Boolean), accountIds:p.accountIds||{}, publications:p.publications||[], errorMessage:p.errorMessage||"", advancedSettings:p.advancedSettings||{}
      })});
      frontendState.posts.forEach(post=>{
        (post.mediaIds||[post.mediaId].filter(Boolean)).forEach(id=>{const m=frontendState.media.find(x=>x.id===id);if(m&&!m.uses.includes(post.id))m.uses.push(post.id);});
      });
    }

    if(Array.isArray(chatsRes?.data)){
      frontendState.aiChats=chatsRes.data.map(c=>({
        id:c.id, title:c.title||uiText("Yeni Sohbet","New Chat"), group:sdChatGroupLabel(c.updated_at),
        time:sdChatGroupLabel(c.updated_at), archived:!!c.archived, pinned:!!c.pinned, messages:[], _hydrated:false
      }));
      if(!frontendState.aiChats.some(c=>c.id===currentAiChatId)){
        currentAiChatId=null;
      }
      if(currentAiChatId)await hydrateAiChatMessages(currentAiChatId);
    }

    if(Array.isArray(accountsRes?.data)){
      const byPlatform={};
      accountsRes.data.forEach(a=>{(byPlatform[a.platform]=byPlatform[a.platform]||[]).push(a);});
      frontendState.multiAccounts=frontendState.multiAccounts||{};
      platformKeys.forEach(key=>{
        const rows=byPlatform[key]||[];
        frontendState.multiAccounts[key]={
          selectedId:String(settingsRes?.data?.selectedAccounts?.[key]||frontendState.multiAccounts[key]?.selectedId||rows[0]?.id||""),
          profiles:rows.map(a=>({
            createdAt:a.createdAt,lastSync:a.metrics?.capturedAt||null,
            id:String(a.id),handle:a.username||a.accountName||"",name:a.accountName||a.username||"",
            status:["active","connected"].includes(a.status)?"active":"warning",connected:true,
            followers:a.metrics?.followers??"—",reach:a.metrics?.reach??"—",engagement:a.metrics?.engagement??"—",dataReady:!!a.metrics,
            extra:{label:uiText("Gösterim","Impressions"),value:a.metrics?.impressions??"—"},posts:[],
            tip:a.metricsError||uiText("Metrikler platform API'sinden periyodik olarak güncellenir.","Metrics are refreshed periodically from the platform API.")
          }))
        };
        syncAccountSummary(key);
      });
      frontendState.accounts=Object.keys(frontendState.accounts).reduce((out,key)=>{
        const rows=byPlatform[key]||[];
        out[key]=rows.length?{connected:true,status:["active","connected"].includes(rows[0].status)?"active":"warning",handle:rows[0].username||rows[0].accountName||""}:{connected:false,status:"disconnected",handle:""};
        return out;
      },{});
    }

    if(dashboardRes?.data)frontendState.dashboard=dashboardRes.data;
    if(settingsRes?.data?.customTitles)Object.assign(frontendState.titles,settingsRes.data.customTitles);
    applyTheme();updateNotifDot();
    if([settingsRes,notifRes,mediaRes,postsRes,chatsRes,accountsRes,dashboardRes].some(value=>!value))showToast(uiText("Bazı veriler yüklenemedi. Lütfen tekrar deneyin.","Some data could not be loaded. Please try again."));

    persistState();
    return true;
  }catch(error){
    console.error("Sunucudan veri alınamadı:", error);
    return false;
  }
}
async function hydrateAiChatMessages(chatId){
  const chat=frontendState.aiChats.find(c=>c.id===chatId);
  if(!chat||chat._hydrated)return;
  try{
    const res=await api.aiChats.messages(chatId);
    chat.messages=(res.data||[]).map(m=>({role:m.role,text:m.content}));
    chat._hydrated=true;
    persistState();
  }catch(error){console.error("Sohbet mesajları alınamadı:",error);}
}

function loadFrontendState(){
  const state=cloneData(defaultFrontendState);
  try{const saved=JSON.parse(localStorage.getItem(SD_STORAGE_KEY)||"{}");state.auth={...state.auth,...saved.auth};}catch(_){}
  return state;
}
let frontendState = loadFrontendState();
const undoActions = new Map();
let dialogConfirmAction = null;
let composeFileData = null;
let composePrefillMediaId = null;
let composeFilesData = [];
let composePrefillMediaIds = [];
let composeEditingPostId = null;
let composeAccountSelections = {};
let composeAdvancedState = {};
let composeDirty = false;
let activeSettingsTab = "gorunum";
let calendarCursor = new Date(`${dateOffsetISO(0)}T12:00:00`);
let calendarView = "aylik";
let calendarStatusFilter = "all";
let calendarPlatformFilter = "all";
let calendarQuickFilter = "all";
let calendarMobileInitialized = false;
let currentAiChatId = frontendState.aiChats.find(chat=>!chat.archived)?.id || null;
let aiArchiveMode = false;
let aiPendingAttachment = null;
let aiSearchQuery = "";
let openAiMenuId = null;
let aiComposerPlatform="general";
let aiComposerTone="professional";
let aiResponsePending=false;


function persistState(){
  try{localStorage.setItem(SD_STORAGE_KEY,JSON.stringify({auth:frontendState.auth,schemaVersion:SD_STATE_VERSION}));localStorage.removeItem("socialdash_frontend_v3");}catch(_){}
}
function resetPrivateState(){
  sdAuthGeneration++;
  frontendState=cloneData(defaultFrontendState);currentAiChatId=null;aiArchiveMode=false;aiPendingAttachment=null;openAiMenuId=null;
  undoActions.clear();localStorage.removeItem("socialdash_compose_draft");
  releaseComposePreview();composeFilesData=[];composeFileData=null;composeEditingPostId=null;
  pendingProfilePhoto=null;pendingProfilePhotoFile=null;
  document.getElementById("post-text").value="";
  for(const id of ["compose-modal","shared-dialog","preview-drawer"]){const el=document.getElementById(id);el?.classList.remove("active");if(el){el.inert=true;el.setAttribute("aria-hidden","true");}}
  const root=document.getElementById("page-root");if(root)root.innerHTML="";
  document.getElementById("global-search").value="";document.getElementById("global-search-results").innerHTML="";
  mediaDbPromise.then(db=>{if(db)db.transaction("assets","readwrite").objectStore("assets").clear();});
  syncOverlayInertState();persistState();
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
function normalizeText(v){ return String(v||"").toLocaleLowerCase("tr-TR").trim(); }
function uiText(tr,en){ return frontendState.settings.language==="en"?en:tr; }
function logActivity(icon,title,detail){
  frontendState.activities=Array.isArray(frontendState.activities)?frontendState.activities:[];
  frontendState.activities.unshift({id:Date.now(),icon,title,detail,time:uiText("Şimdi","Now")});
  frontendState.activities=frontendState.activities.slice(0,12);
}
function platformKeyFromLabel(label){
  return ({Instagram:"instagram",Facebook:"facebook","X":"x",LinkedIn:"linkedin",TikTok:"tiktok",YouTube:"youtube",Threads:"threads"})[label] || "instagram";
}
function platformLabel(key){ return platformCatalog[key]?.label?.replace(" (Twitter)","") || key; }
function platformIcon(label){ return platformCatalog[platformKeyFromLabel(label)]?.icon || "public"; }

function brandIconSvg(key){
  const cls=`brand-icon brand-logo-${key}`;
  const icons={
    instagram:`<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/><circle cx="17.4" cy="6.7" r="1.2" fill="currentColor"/></svg></span>`,
    facebook:`<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.8 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5H17V4a22 22 0 0 0-2.4-.1c-2.4 0-4 1.5-4 4.1v2H8v3h2.6v8h3.2Z"/></svg></span>`,
    x:`<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 4h3.3l4.4 5.9L17.8 4H20l-6.3 7.2L20.5 20h-3.3l-4.8-6.4L6.8 20H4.5l6.9-7.8L5 4Zm2.2 1.7 10.9 12.6h1.2L8.4 5.7H7.2Z"/></svg></span>`,
    linkedin:`<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 8.2H3.4V20h3.1V8.2ZM5 3.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6ZM20.6 13.2c0-3.6-1.9-5.3-4.5-5.3-2.1 0-3 1.1-3.5 1.9V8.2H9.5V20h3.1v-5.8c0-1.5.3-3 2.2-3 1.9 0 1.9 1.8 1.9 3.1V20h3.1v-6.8Z"/></svg></span>`,
    tiktok:`<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.8 3c.4 2 1.5 3.2 3.4 3.8v3a8 8 0 0 1-3.3-1v6.1a5.9 5.9 0 1 1-5.1-5.8v3.1a2.8 2.8 0 1 0 2 2.7V3h3Z"/></svg></span>`,
    youtube:`<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 7.3a3 3 0 0 0-2.1-2.1C17 4.7 12 4.7 12 4.7s-5 0-6.9.5A3 3 0 0 0 3 7.3 31 31 0 0 0 2.5 12 31 31 0 0 0 3 16.7a3 3 0 0 0 2.1 2.1c1.9.5 6.9.5 6.9.5s5 0 6.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.7 31 31 0 0 0-.5-4.7ZM10 15.2V8.8l5.5 3.2L10 15.2Z"/></svg></span>`,
    threads:`<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3c5 0 8 3.2 8 8.4 0 5-2.8 9-7.8 9-4.4 0-8.2-3.2-8.2-8.5C4 6.6 7.4 3 12 3Z"/><path d="M8.6 9.2c1.1-1.2 4.3-1.5 6.3.2 2 1.7 1.5 5-1.1 5.8-2.5.8-4.5-.5-4.5-2.2 0-1.7 1.5-2.8 3.5-2.8 3.5 0 5.1 1.8 5.1 4.5"/></svg></span>`
  };
  return icons[key]||icons.instagram;
}

function formatDate(dateStr, long=false){
  const d = new Date(dateStr+"T12:00:00");
  const locale=frontendState.settings.language==="en"?"en-GB":"tr-TR";
  if(frontendState.settings.dateFormat==="MM/DD/YYYY" && !long) return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}/${d.getFullYear()}`;
  if(!long) return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
  return d.toLocaleDateString(locale,{day:"numeric",month:"long",year:"numeric"});
}
function displayTime(time){return time+(frontendState.settings.timezone==="UTC"?" UTC":"");}
function postParts(post){return post.scheduledAt?scheduledAtParts(post.scheduledAt):{date:post.date,time:post.time||"00:00"};}
function formatPostDateTime(post,long=false){const p=postParts(post);return `${formatDate(p.date,long)} ${displayTime(p.time)}`;}
function postDateKey(post){return postParts(post).date;}
function postHourKey(post){return postParts(post).time.slice(0,2);}

function todayISO(){
  const zone=frontendState?.settings?.timezone==="UTC"?"UTC":"Europe/Istanbul";
  const parts=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:zone}).formatToParts(new Date());
  const value=type=>parts.find(part=>part.type===type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}
function scheduledDateTime(date,time){
  const suffix=frontendState.settings.timezone==="UTC"?"Z":"+03:00";
  return new Date(`${date}T${time||"00:00"}:00${suffix}`);
}
function scheduledAtParts(value){
  if(!value)return {date:null,time:null};
  const instant=new Date(value);if(Number.isNaN(instant.getTime()))return {date:null,time:null};
  const zone=frontendState.settings.timezone==="UTC"?"UTC":"Europe/Istanbul";
  const parts=new Intl.DateTimeFormat("en-CA",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23",timeZone:zone}).formatToParts(instant);
  const get=type=>parts.find(part=>part.type===type)?.value;
  return {date:`${get("year")}-${get("month")}-${get("day")}`,time:`${get("hour")}:${get("minute")}`};
}
function openDialog(title,body,actions="",onConfirm=null){
  closeAllDropdowns();
  rememberFocus("dialog");
  document.getElementById("shared-dialog-title").textContent = title;
  document.getElementById("shared-dialog-body").innerHTML = body;
  document.getElementById("shared-dialog-actions").innerHTML = actions;
  dialogConfirmAction = onConfirm;
  const el = document.getElementById("shared-dialog");
  el.inert=false; el.classList.add("active"); el.setAttribute("aria-hidden","false");
  syncOverlayInertState();
  lockBodyScroll();
  applyInterfaceLanguage();
  setTimeout(()=>el.querySelector("button,input,select,textarea")?.focus(),20);
}
function closeDialog(){
  const el=document.getElementById("shared-dialog");
  el.classList.remove("active"); el.setAttribute("aria-hidden","true"); el.inert=true;
  syncOverlayInertState();
  dialogConfirmAction=null; unlockBodyScroll();restoreFocus("dialog");
}
async function confirmDialogAction(){ if(typeof dialogConfirmAction==="function") await dialogConfirmAction(); }
function confirmAction(title,message,confirmText,onConfirm){
  openDialog(title,`<p class="text-body-md text-on-surface-variant">${escapeHtml(message)}</p>`,
    `<button type="button" class="px-5 py-2.5 rounded-xl bg-surface-container font-label-md" data-command="closeDialog()">Vazgeç</button>
     <button type="button" class="px-5 py-2.5 rounded-xl bg-error text-white font-label-md" data-command="confirmDialogAction()">${escapeHtml(confirmText)}</button>`,onConfirm);
}
function showUndoToast(message,undoFn){
  const token=`undo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  undoActions.set(token,undoFn);
  const t=document.getElementById("toast");
  clearTimeout(showToast.timer);
  clearTimeout(showUndoToast.timer);
  t.innerHTML=`${escapeHtml(message)} <button type="button" class="ml-3 underline font-bold" data-command="runUndo('${token}')">${uiText("Geri Al","Undo")}</button>`;
  t.classList.add("show");
  showUndoToast.timer=setTimeout(()=>{t.classList.remove("show");undoActions.delete(token);},5000);
}
function runUndo(token){const action=undoActions.get(token);if(action)action();undoActions.delete(token);document.getElementById("toast").classList.remove("show");}

function applyTheme(theme=frontendState.settings.theme){
  let effective=theme;
  if(theme==="system") effective=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";
  document.documentElement.classList.toggle("light",effective==="light");
  document.documentElement.classList.toggle("theme-dark",effective==="dark");
  document.documentElement.classList.toggle("dark",effective==="dark");
}
applyTheme();
const systemThemeMedia=matchMedia("(prefers-color-scheme: dark)");
systemThemeMedia.addEventListener?.("change",()=>{if(frontendState.settings.theme==="system")applyTheme("system");});

/* ---------- Authentication ---------- */
function setFieldError(fieldId,errorId,message){
  const field=document.getElementById(fieldId),error=document.getElementById(errorId);if(!field||!error)return !message;
  error.textContent=message||"";
  field.setAttribute("aria-invalid",String(!!message));
  field.setAttribute("aria-describedby",errorId);
  return !message;
}
function openAuthDialog(type){
  if(type==="forgot"){
    openDialog("Şifre Sıfırlama",`<label for="forgot-email" class="block text-label-sm mb-2">E-posta adresi</label>
      <input name="forgot-email" id="forgot-email" type="email" class="w-full rounded-xl bg-surface-container-low border-none" value="${escapeHtml(document.getElementById("login-email")?.value)}" aria-describedby="forgot-error">
      <p class="field-error" id="forgot-error"></p>`,
      `<button type="button" class="px-5 py-2.5 rounded-xl bg-surface-container" data-command="closeDialog()">Vazgeç</button>
       <button type="button" class="px-5 py-2.5 rounded-xl bg-primary text-white" data-command="submitForgot()">Bağlantı Gönder</button>`);
  }else{
    showRegisterView();
  }
}
function togglePassword(inputId,button){
  const input=document.getElementById(inputId);
  if(!input||!button)return;
  const showing=input.type==="text";
  input.type=showing?"password":"text";
  button.setAttribute("aria-pressed",String(!showing));
  button.setAttribute("aria-label",showing?uiText("Şifreyi göster","Show password"):uiText("Şifreyi gizle","Hide password"));
  const icon=button.querySelector(".material-symbols-outlined");
  if(icon)icon.textContent=showing?"visibility":"visibility_off";
}
function clearAuthErrors(scope){
  document.querySelectorAll(`${scope} .field-error`).forEach(el=>el.textContent="");
}
function showRegisterView(){
  closeAllDropdowns?.();
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("app-shell").classList.add("hidden");
  document.getElementById("register-view").classList.remove("hidden");
  clearAuthErrors("#register-view");
  window.scrollTo(0,0);
  document.getElementById("reg-name")?.focus();
}
function showLoginView(prefillEmail=""){
  document.getElementById("register-view").classList.add("hidden");
  document.getElementById("app-shell").classList.add("hidden");
  document.getElementById("login-view").classList.remove("hidden");
  clearAuthErrors("#login-view");
  if(prefillEmail)document.getElementById("login-email").value=prefillEmail;
  window.scrollTo(0,0);
  document.getElementById("login-email")?.focus();
}
async function submitForgot(){
  const input=document.getElementById("forgot-email");
  if(!input?.checkValidity()){setFieldError("forgot-email","forgot-error",uiText("Geçerli bir e-posta adresi girin.","Enter a valid email address."));return;}
  try{
    const response=await fetch("/api/auth/forgot-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:input.value.trim()})});
    const data=await response.json();
    if(!response.ok)throw new Error(data?.message||uiText("İstek gönderilemedi.","Request could not be sent."));
    closeDialog();showToast(data.message||uiText("İstek alındı.","Request received."));
  }catch(error){document.getElementById("forgot-error").textContent=error.message;}
}
function openResetPasswordDialog(token){
  window.pendingResetToken=token;
  openDialog(uiText("Şifreyi Sıfırla","Reset Password"),`<label for="reset-new-password" class="block text-label-sm mb-2">${uiText("Yeni şifre","New password")}</label><div class="relative"><input id="reset-new-password" type="password" autocomplete="new-password" class="w-full rounded-xl bg-surface-container-low border-none pr-12" aria-describedby="reset-password-error"><button type="button" aria-label="${uiText("Şifreyi göster","Show password")}" aria-pressed="false" class="absolute right-2 top-1/2 -translate-y-1/2 p-2" data-command="togglePassword('reset-new-password',this)"><span class="material-symbols-outlined">visibility</span></button></div><label for="reset-repeat-password" class="block text-label-sm mt-3 mb-2">${uiText("Şifre tekrar","Repeat password")}</label><input id="reset-repeat-password" type="password" autocomplete="new-password" class="w-full rounded-xl bg-surface-container-low border-none" aria-describedby="reset-password-error"><p id="reset-password-error" class="field-error"></p>`,`<button type="button" class="px-5 py-2.5 bg-surface-container rounded-xl" data-command="closeDialog()">${uiText("Vazgeç","Cancel")}</button><button type="button" class="px-5 py-2.5 bg-primary text-white rounded-xl" data-command="submitResetPassword()">${uiText("Şifreyi Güncelle","Update Password")}</button>`);
}
async function submitResetPassword(){const password=document.getElementById("reset-new-password")?.value||"",repeat=document.getElementById("reset-repeat-password")?.value||"",error=document.getElementById("reset-password-error");if(!/^(?=.*[A-ZÇĞİÖŞÜ])(?=.*[a-zçğıöşü])(?=.*\d).{8,}$/.test(password)){error.textContent=uiText("Şifre en az 8 karakter, büyük/küçük harf ve rakam içermeli.","Password must be at least 8 characters and include upper/lowercase letters and a number.");return;}if(password!==repeat){error.textContent=uiText("Şifreler eşleşmiyor.","Passwords do not match.");return;}try{const response=await fetch("/api/auth/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:window.pendingResetToken,password})}),data=await response.json();if(!response.ok)throw new Error(data.message);window.pendingResetToken=null;history.replaceState({},"",location.pathname+location.hash);closeDialog();showToast(data.message||uiText("Şifre güncellendi.","Password updated."));}catch(err){error.textContent=err.message||uiText("Şifre güncellenemedi.","Password could not be updated.");}}
async function submitRegister() {
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email");
  const pass = document.getElementById("reg-pass").value;
  const repeat = document.getElementById("reg-pass-repeat").value;
  const terms = document.getElementById("reg-terms");

  const passwordValid =
    /^(?=.*[A-ZÇĞİÖŞÜ])(?=.*[a-zçğıöşü])(?=.*\d).{8,}$/.test(pass);

  setFieldError(
    "reg-name",
    "reg-name-error",
    name.length >= 3
      ? ""
      : uiText(
          "Ad soyad en az 3 karakter olmalı.",
          "Full name must be at least 3 characters."
        )
  );

  setFieldError(
    "reg-email",
    "reg-email-error",
    email.checkValidity()
      ? ""
      : uiText(
          "Geçerli bir e-posta adresi girin.",
          "Enter a valid email address."
        )
  );

  setFieldError(
    "reg-pass",
    "reg-pass-error",
    passwordValid
      ? ""
      : uiText(
          "En az 8 karakter, bir büyük harf, bir küçük harf ve bir rakam kullanın.",
          "Use at least 8 characters, one uppercase letter, one lowercase letter and one number."
        )
  );

  setFieldError(
    "reg-pass-repeat",
    "reg-repeat-error",
    repeat === pass && repeat
      ? ""
      : uiText(
          "Şifreler eşleşmiyor.",
          "Passwords do not match."
        )
  );

  document.getElementById("reg-terms-error").textContent =
    terms.checked
      ? ""
      : uiText(
          "Kullanım koşullarını onaylamalısınız.",
          "You must accept the terms of use."
        );

  terms.setAttribute("aria-invalid", String(!terms.checked));

  if (
    name.length < 3 ||
    !email.checkValidity() ||
    !passwordValid ||
    repeat !== pass ||
    !terms.checked
  ) {
    return;
  }

  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: name,
        email: email.value,
        password: pass
      })
    });

    const data = await response.json();

    if (!response.ok) {
      showToast(data.message || "Hesap oluşturulamadı.");
      return;
    }

    const username =
      normalizeText(name)
        .replace(/ı/g, "i")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 30) || "socialdash";

    Object.assign(frontendState.profile, {
      name,
      email: email.value,
      username,
      plan: "Free",
      joined: new Date().toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric"
      })
    });

    // Register returns the same token/session shape as login, so the user
    // is authenticated immediately and lands on the dashboard - no second
    // login step required.
    await completeAuthentication(data, { email: email.value, remember: true });

    showToast(uiText("Hesap oluşturuldu. Hoş geldiniz!", "Account created. Welcome!"));

  } catch (error) {
    showToast("Sunucuya bağlanılamadı.");
  }
}
// Shared by login and register: both endpoints return the same token/session
// shape, so both flows finish by calling this exact function - there is only
// one client-side "become authenticated" code path.
async function completeAuthentication(data, opts) {
  const email = opts.email, remember = opts.remember;
  resetPrivateState();
  localStorage.setItem("socialdash_token", data.token);
  // The refresh token itself is never stored here: the backend already set
  // it as an HttpOnly cookie. This flag just lets the frontend know a
  // session might exist, so it's worth trying a refresh later.
  localStorage.setItem("socialdash_has_session", "1");

  if(!await loadBackendProfile())throw new Error("Profil yüklenemedi.");
  await hydrateFromBackend();

  frontendState.auth = {
    sessionActive: true,
    remember,
    rememberedEmail: remember ? email : ""
  };

  frontendState.profile.email = email;
  persistState();

  sessionStorage.setItem("socialdash_session", "1");
  localStorage.setItem("socialdash_remember", remember ? "1" : "0");

  if (remember) {
    localStorage.setItem("socialdash_remembered_email", email);
  } else {
    localStorage.removeItem("socialdash_remembered_email");
  }

  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("register-view").classList.add("hidden");
  document.getElementById("app-shell").classList.remove("hidden");

  navigate("home");

  if (frontendState.settings.sidebarOpen && matchMedia("(min-width:1024px)").matches) {
    setSidebar(true);
  } else {
    setSidebar(false);
  }
}
// Google/Apple sign-in is a real OAuth redirect, not a fetch call: the
// browser has to navigate away to the provider's own login page.
function startOAuthLogin(provider){
  const remember=document.getElementById("remember-me")?.checked?"1":"0";
  window.location.href=`/api/auth/${provider}?remember=${remember}`;
}
doLogin = async function (twoFactorToken="") {
  const email = document.getElementById("login-email");
  const pass = document.getElementById("login-password");

  setFieldError("login-email", "login-email-error",
    email.checkValidity() ? "" : uiText("Geçerli bir e-posta adresi girin.", "Enter a valid email address.")
  );

  setFieldError("login-password", "login-password-error",
    pass.value.length > 0 ? "" : uiText("Şifrenizi girin.", "Enter your password.")
  );

  if (!email.checkValidity() || pass.value.length === 0) return;

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.value,
        password: pass.value,
        remember:document.getElementById("remember-me").checked,
        ...(twoFactorToken?{twoFactorToken}:{})
      })
    });

   const data = await response.json();

if(response.status===428&&data.requiresTwoFactor){
  openDialog(uiText("İki Faktörlü Doğrulama","Two-Factor Authentication"),`<label for="login-twofa-code" class="block text-label-sm mb-2">${uiText("6 haneli doğrulama kodu","6-digit verification code")}</label><input id="login-twofa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="w-full rounded-xl bg-surface-container-low border-none text-center tracking-[.4em]" placeholder="000000" aria-describedby="login-twofa-error"><p class="field-error" id="login-twofa-error"></p>`,`<button type="button" class="px-5 py-2.5 bg-surface-container rounded-xl" data-command="closeDialog()">${uiText("Vazgeç","Cancel")}</button><button type="button" class="px-5 py-2.5 bg-primary text-white rounded-xl" data-command="submitLogin2FA()">${uiText("Doğrula","Verify")}</button>`);
  return;
}
if (!response.ok) {
  showToast(data.message || "Giriş başarısız.");
  return;
}

    await completeAuthentication(data, {
      email: email.value,
      remember: document.getElementById("remember-me").checked
    });

  } catch (error) {
    showToast("Sunucuya bağlanılamadı.");
  }
};

document.getElementById("remember-me").checked=localStorage.getItem("socialdash_remember")==="1";
document.getElementById("login-email").value=localStorage.getItem("socialdash_remembered_email")||document.getElementById("login-email").value;
async function submitLogin2FA(){
  const input=document.getElementById("login-twofa-code"),error=document.getElementById("login-twofa-error");
  if(!/^\d{6}$/.test(input?.value||"")){error.textContent=uiText("6 haneli kodu girin.","Enter the 6-digit code.");return;}
  closeDialog();
  await doLogin(input.value);
}
doLogout=async function(){
  try{await fetch("/api/auth/logout",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:"{}"});}catch(_){ }
  resetPrivateState();
  sessionStorage.removeItem("socialdash_session");
  localStorage.removeItem("socialdash_token");
  localStorage.removeItem("socialdash_has_session");
  document.getElementById("app-shell").classList.add("hidden");
  document.getElementById("register-view").classList.add("hidden");
  document.getElementById("login-view").classList.remove("hidden");
  setSidebar(false);
  closeAllDropdowns();forceUnlockBodyScroll();
  applyInterfaceLanguage();
};

/* ---------- Compose modal ---------- */
