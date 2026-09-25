
let sdScrollLocks=0;
const sdFocusOrigins=new Map();
function lockBodyScroll(){sdScrollLocks++;document.body.classList.add("sd-scroll-locked");}
function unlockBodyScroll(){sdScrollLocks=Math.max(0,sdScrollLocks-1);if(sdScrollLocks===0)document.body.classList.remove("sd-scroll-locked");}
function forceUnlockBodyScroll(){sdScrollLocks=0;document.body.classList.remove("sd-scroll-locked");}
function rememberFocus(layer){sdFocusOrigins.set(layer,document.activeElement);}
function restoreFocus(layer){const origin=sdFocusOrigins.get(layer);sdFocusOrigins.delete(layer);if(origin?.isConnected)setTimeout(()=>origin.focus(),0);}
function syncOverlayInertState(){
  const dialog=document.getElementById("shared-dialog");
  const compose=document.getElementById("compose-modal");
  const media=document.getElementById("media-detail-drawer");
  const dialogOpen=!!dialog?.classList.contains("active");
  const composeOpen=!!compose?.classList.contains("active");
  const mediaOpen=!!media?.classList.contains("active");
  const appShell=document.getElementById("app-shell");
  if(appShell)appShell.inert=dialogOpen||composeOpen;
  const mediaBackground=[
    document.querySelector("#app-shell > div.min-h-screen > header"),
    document.getElementById("main-sidebar"),
    document.getElementById("mobile-nav"),
    ...document.querySelectorAll("#page-root > .page-fade > :first-child > :not(#media-detail-backdrop):not(#media-detail-drawer)")
  ].filter(Boolean);
  mediaBackground.forEach(element=>{
    if(mediaOpen&&element.dataset.mediaWasInert===undefined){
      element.dataset.mediaWasInert=element.inert?"true":"false";
      element.inert=true;
    }else if(!mediaOpen&&element.dataset.mediaWasInert!==undefined){
      element.inert=element.dataset.mediaWasInert==="true";
      delete element.dataset.mediaWasInert;
    }
  });
  if(compose)compose.inert=!composeOpen||dialogOpen;
  if(media)media.inert=!mediaOpen||dialogOpen;
}
function focusableElements(container){
  return [...(container?.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])')||[])].filter(element=>!element.hidden&&element.getClientRects().length>0&&!element.closest('[aria-hidden="true"]'));
}

function getTopOpenLayer(){
  if(document.getElementById("shared-dialog")?.classList.contains("active"))return "dialog";
  if(!document.getElementById("platform-dropdown")?.classList.contains("hidden"))return "platformDropdown";
  if(document.getElementById("global-search-results")?.classList.contains("open"))return "search";
  if(document.getElementById("preview-drawer")?.classList.contains("active"))return "preview";
  if(document.getElementById("compose-modal")?.classList.contains("active"))return "compose";
  if(document.getElementById("media-detail-drawer")?.classList.contains("active"))return "media";
  if(openAiMenuId!==null&&document.querySelector(".ai-item-menu:not(.hidden)"))return "aiMenu";
  if(document.getElementById("profile-popover")?.classList.contains("open"))return "profile";
  if(document.getElementById("notif-panel")?.classList.contains("open"))return "notif";
  if(document.getElementById("ai-history-panel")?.classList.contains("open")&&window.innerWidth<640)return "aiHistory";
  if(document.getElementById("main-sidebar")?.classList.contains("open"))return "sidebar";
  return null;
}
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){
    const top=getTopOpenLayer();
    if(top==="dialog")closeDialog();
    else if(top==="preview")togglePreview();
    else if(top==="compose")closeCompose();
    else if(top==="media")closeMediaDetail();
    else if(top==="aiMenu"){const id=openAiMenuId;openAiMenuId=null;renderAiHistoryFiltered(aiSearchQuery);setTimeout(()=>document.querySelector(`[data-ai-menu-id="${id}"]`)?.focus(),0);}
    else if(top==="profile"){const panel=document.getElementById("profile-popover");panel?.classList.remove("open");if(panel){panel.inert=true;panel.setAttribute("aria-hidden","true");}document.querySelector('[aria-controls="profile-popover"]')?.setAttribute("aria-expanded","false");restoreFocus("profile");}
    else if(top==="notif"){const panel=document.getElementById("notif-panel");panel?.classList.remove("open");if(panel){panel.inert=true;panel.setAttribute("aria-hidden","true");}document.querySelector('[aria-controls="notif-panel"]')?.setAttribute("aria-expanded","false");restoreFocus("notif");}
    else if(top==="aiHistory")toggleAiHistory(false);
    else if(top==="sidebar")setSidebar(false);
    else if(top==="platformDropdown")toggleDropdown("platform-dropdown");
    else if(top==="search"){document.getElementById("global-search-results")?.classList.remove("open");document.getElementById("global-search")?.setAttribute("aria-expanded","false");}
  }
  if(document.activeElement?.closest("#platform-dropdown")&&["ArrowDown","ArrowUp","Home","End"].includes(e.key)){
    const options=focusableElements(document.getElementById("platform-dropdown"));if(!options.length)return;
    e.preventDefault();const current=Math.max(0,options.indexOf(document.activeElement));
    const next=e.key==="Home"?0:e.key==="End"?options.length-1:e.key==="ArrowDown"?(current+1)%options.length:(current-1+options.length)%options.length;
    options[next].focus();
  }
  if(e.key==="Tab"){
    const layer=getTopOpenLayer();
    const dialog=layer==="dialog"?document.querySelector('#shared-dialog.active [role="dialog"]'):layer==="preview"?document.getElementById("preview-drawer"):layer==="compose"?document.querySelector("#compose-modal.active .modal-container"):layer==="media"?document.getElementById("media-detail-drawer"):layer==="sidebar"?document.getElementById("main-sidebar"):layer==="aiHistory"?document.getElementById("ai-history-panel"):null;
    if(!dialog)return;
    const focusable=focusableElements(dialog);
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(!dialog.contains(document.activeElement)){e.preventDefault();first.focus();}
    else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});

/* =========================================================
   FRONTEND FUNCTIONALITY LAYER
   Keeps the existing visual shell and page structure intact.
========================================================== */
const SD_STORAGE_KEY = "socialdash_frontend_v5";
const SD_STATE_VERSION = 6;

/* =========================================================
   BACKEND API CLIENT
   Every call attaches the access token and transparently retries
   once via /api/auth/refresh on a 401 before giving up and sending
   the user back to the login screen. Real user data (posts, media,
   notifications, settings, AI chats, accounts) is authoritative in
   the database - frontendState is a local cache hydrated from it.
========================================================== */
let sdRefreshInFlight = null;
let sdAuthGeneration=0;
async function sdRefreshTokens(){
  // The refresh token itself is never stored in localStorage: it lives only
  // in the HttpOnly cookie the backend set on login, invisible to page JS
  // (and therefore to XSS). "socialdash_has_session" is just a non-secret
  // hint so the frontend knows whether it's worth attempting a refresh at
  // all - the cookie is the actual credential.
  if(localStorage.getItem("socialdash_has_session")!=="1")return false;
  if(!sdRefreshInFlight){
    sdRefreshInFlight=fetch("/api/auth/refresh",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:"{}"})
      .then(async r=>{
        if(!r.ok)return false;
        const data=await r.json();
        localStorage.setItem("socialdash_token",data.token);
        return true;
      })
      .catch(()=>false)
      .finally(()=>{sdRefreshInFlight=null;});
  }
  return sdRefreshInFlight;
}
function sdForceLogout(){
  localStorage.removeItem("socialdash_token");localStorage.removeItem("socialdash_has_session");
  sessionStorage.removeItem("socialdash_session");resetPrivateState();
  closeAllDropdowns();forceUnlockBodyScroll();showLoginView();
}
async function apiFetch(path,options={}){
  const generation=sdAuthGeneration;
  let token=localStorage.getItem("socialdash_token");
  try{const payload=JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));if(payload.exp*1000<=Date.now()+30000){await sdRefreshTokens();token=localStorage.getItem("socialdash_token");}}catch(_){}
  const headers={...(options.headers||{})};
  if(!(options.body instanceof FormData))headers["Content-Type"]=headers["Content-Type"]||"application/json";
  if(token)headers["Authorization"]=`Bearer ${token}`;

  let response=await fetch(path,{...options,headers});
  if([401,403].includes(response.status)&&["NO_TOKEN","INVALID_TOKEN","SESSION_MISSING","SESSION_EXPIRED"].includes((await response.clone().json().catch(()=>({})))?.error?.code)){
    const refreshed=token!==localStorage.getItem("socialdash_token")||await sdRefreshTokens();
    if(refreshed){
      const retryHeaders={...headers,Authorization:`Bearer ${localStorage.getItem("socialdash_token")}`};
      response=await fetch(path,{...options,headers:retryHeaders});
    }
    if([401,403].includes(response.status)&&["NO_TOKEN","INVALID_TOKEN","SESSION_MISSING","SESSION_EXPIRED"].includes((await response.clone().json().catch(()=>({})))?.error?.code)){
      sdForceLogout();
      throw new Error("Oturum sona erdi. Lütfen tekrar giriş yapın.");
    }
  }
  if(generation!==sdAuthGeneration)throw new Error("Oturum değişti; eski işlem iptal edildi.");
  let data=null;
  try{data=await response.json();}catch(_){data=null;}
  if(!response.ok){
    const err=new Error(data?.message||"Sunucu hatası oluştu.");
    err.status=response.status;
    err.data=data;
    throw err;
  }
  return data;
}

let sdCapabilities=null;
async function capabilities(){if(!sdCapabilities){const res=await apiFetch("/api/capabilities");sdCapabilities=res.data;}return sdCapabilities;}
const api={
  profile:{
    uploadAvatar:(formData)=>apiFetch("/api/profile/avatar",{method:"POST",body:formData}),
    removeAvatar:()=>apiFetch("/api/profile/avatar",{method:"DELETE"}),
    changePassword:(currentPassword,newPassword)=>apiFetch("/api/auth/password",{method:"PUT",body:JSON.stringify({currentPassword,newPassword})}),
    deleteAccount:(currentPassword)=>apiFetch("/api/profile",{method:"DELETE",body:JSON.stringify({currentPassword})})
  },
  posts:{
    list:(query="")=>apiFetch(`/api/posts${query}`),
    listPage:(page,pageSize=100,extra="")=>apiFetch(`/api/posts?page=${page}&pageSize=${pageSize}${extra}`),
    create:(body)=>apiFetch("/api/posts",{method:"POST",body:JSON.stringify(body)}),
    update:(id,body)=>apiFetch(`/api/posts/${id}`,{method:"PUT",body:JSON.stringify(body)}),
    schedule:(id,scheduledAt)=>apiFetch(`/api/posts/${id}/schedule`,{method:"PATCH",body:JSON.stringify({scheduledAt})}),
    retry:(id)=>apiFetch(`/api/posts/${id}/retry`,{method:"POST"}),
    remove:(id)=>apiFetch(`/api/posts/${id}`,{method:"DELETE"}),
    restore:(id)=>apiFetch(`/api/posts/${id}/restore`,{method:"POST"})
  },
  media:{
    list:()=>apiFetch("/api/media"),
    listPage:(page,pageSize=50)=>apiFetch(`/api/media?page=${page}&pageSize=${pageSize}`),
    upload:(formData)=>apiFetch("/api/media",{method:"POST",body:formData}),
    rename:(id,name)=>apiFetch(`/api/media/${id}`,{method:"PUT",body:JSON.stringify({name})}),
    remove:(id)=>apiFetch(`/api/media/${id}`,{method:"DELETE"}),
    restore:(id)=>apiFetch(`/api/media/${id}/restore`,{method:"POST"})
  },
  notifications:{
    list:()=>apiFetch("/api/notifications"),
    listPage:(page,pageSize=50)=>apiFetch(`/api/notifications?page=${page}&pageSize=${pageSize}`),
    markRead:(id)=>apiFetch(`/api/notifications/${id}/read`,{method:"PATCH"}),
    markAllRead:()=>apiFetch("/api/notifications/read-all",{method:"PATCH"}),
    remove:(id)=>apiFetch(`/api/notifications/${id}`,{method:"DELETE"}),
    restore:(id)=>apiFetch(`/api/notifications/${id}/restore`,{method:"POST"}),
    pushKey:()=>apiFetch("/api/notifications/push/public-key"),
    subscribePush:(subscription)=>apiFetch("/api/notifications/push/subscribe",{method:"POST",body:JSON.stringify(subscription)}),
    unsubscribePush:(endpoint)=>apiFetch("/api/notifications/push/subscribe",{method:"DELETE",body:JSON.stringify({endpoint})})
  },
  settings:{
    get:()=>apiFetch("/api/settings"),
    update:(body)=>apiFetch("/api/settings",{method:"PUT",body:JSON.stringify(body)})
  },
  aiChats:{
    list:()=>apiFetch("/api/ai/chats"),
    restore:(id)=>apiFetch(`/api/ai/chats/${id}/restore`,{method:"POST"}),
    pin:(id)=>apiFetch(`/api/ai/chats/${id}/pin`,{method:"PATCH"}),
    duplicate:(id)=>apiFetch(`/api/ai/chats/${id}/duplicate`,{method:"POST"}),
    create:(title)=>apiFetch("/api/ai/chats",{method:"POST",body:JSON.stringify({title})}),
    messages:(id)=>apiFetch(`/api/ai/chats/${id}/messages`),
    sendMessage:async(id,text)=>{if(!(await capabilities()).ai)throw new Error(uiText("Yapay zekâ servisi henüz yapılandırılmadı.","The AI service is not configured yet."));return apiFetch(`/api/ai/chats/${id}/messages`,{method:"POST",body:JSON.stringify({text})});},
    rename:(id,title)=>apiFetch(`/api/ai/chats/${id}`,{method:"PUT",body:JSON.stringify({title})}),
    remove:(id)=>apiFetch(`/api/ai/chats/${id}`,{method:"DELETE"}),
    archive:(id)=>apiFetch(`/api/ai/chats/${id}/archive`,{method:"PATCH"}),
    unarchive:(id)=>apiFetch(`/api/ai/chats/${id}/unarchive`,{method:"PATCH"})
  },
  accounts:{
    list:()=>apiFetch("/api/accounts"),
    connect:async(platform)=>{if(!(await capabilities()).platforms[platform])throw new Error(uiText("Bu platformun bağlantı servisi henüz yapılandırılmadı.","The connection service for this platform is not configured yet."));return apiFetch("/api/accounts/connect",{method:"POST",body:JSON.stringify({platform})});},
    remove:(id)=>apiFetch(`/api/accounts/${id}`,{method:"DELETE"})
  },
  platforms:{
    stats:(id,refresh=false)=>apiFetch(`/api/platforms/${id}/stats${refresh?"?refresh=1":""}`),
    posts:(id)=>apiFetch(`/api/platforms/${id}/posts`),
    analytics:(id)=>apiFetch(`/api/platforms/${id}/analytics`)
  },
  dashboard:()=>apiFetch("/api/dashboard"),
  search:(q)=>apiFetch(`/api/search?q=${encodeURIComponent(q)}`),
  news:{
    list:async()=>{if(!(await capabilities()).news)throw new Error(uiText("Haber servisi henüz yapılandırılmadı.","The news service is not configured yet."));return apiFetch("/api/news");},
    trending:()=>apiFetch("/api/news/trending"),
    subscribe:(email)=>apiFetch("/api/news/newsletter",{method:"POST",body:JSON.stringify({email})})
  },
  security:{
    listSessions:()=>apiFetch("/api/security/sessions"),
    revokeSession:(id)=>apiFetch(`/api/security/sessions/${id}`,{method:"DELETE"}),
    revokeOtherSessions:()=>apiFetch("/api/security/sessions/revoke-others",{method:"POST"}),
    setup2fa:()=>apiFetch("/api/security/2fa/setup",{method:"POST"}),
    verify2fa:(token)=>apiFetch("/api/security/2fa/verify",{method:"POST",body:JSON.stringify({token})}),
    disable2fa:()=>apiFetch("/api/security/2fa",{method:"DELETE"})
  }
};

const defaultFrontendState = {
  profile: {
    name:"Kullanıcı", username:"", email:"", phone:"", country:"+90", photo:"", title:"",
    plan:"Free", joined:""
  },
  titles: {
    "Senior Social Manager":["İçerik stratejisini yönetir","Yayın takvimini koordine eder","Performans raporlarını değerlendirir"],
    "Social Media Specialist":["Gönderileri hazırlar ve planlar","Topluluk etkileşimlerini takip eder"],
    "Content Creator":["Görsel ve metin içerikleri üretir","Platform formatlarına uyarlama yapar"]
  },
  accounts: {
    instagram:{connected:false,status:"disconnected",handle:""},
    facebook:{connected:false,status:"disconnected",handle:""},
    x:{connected:false,status:"disconnected",handle:""},
    linkedin:{connected:false,status:"disconnected",handle:""},
    tiktok:{connected:false,status:"disconnected",handle:""},
    youtube:{connected:false,status:"disconnected",handle:""},
    threads:{connected:false,status:"disconnected",handle:""}
  },
  media:[],
  posts:[],
  settings:{
    theme:"light", dateFormat:"DD.MM.YYYY", timezone:"Europe/Istanbul",
    language:"tr",
    notifications:{email:true,push:true,weekly:false,connection:true},
    autoDraft:true, sidebarOpen:false,
    security:{
      twoFactorEnabled:false,
      sessions:[]
    }
  },
  auth:{sessionActive:false,remember:false,rememberedEmail:""},
  notifications:[],
  activities:[],
  dashboard:null,
  schemaVersion:SD_STATE_VERSION,
  aiChats:[]
};
function cloneData(v){ return JSON.parse(JSON.stringify(v)); }
function normalizePostStatus(status){
  return ({Planlandı:"scheduled",Taslak:"draft",Yayınlandı:"published",Başarısız:"failed",Yayınlanıyor:"publishing",scheduled:"scheduled",draft:"draft",published:"published",failed:"failed",publishing:"publishing",processing:"processing"})[status]||"draft";
}
function postStatusLabel(status){
  const code=normalizePostStatus(status);
  return code==="scheduled"?uiText("Planlandı","Scheduled"):code==="published"?uiText("Yayınlandı","Published"):code==="publishing"?uiText("Yayınlanıyor","Publishing"):code==="processing"?uiText("Platform işliyor","Processing"):code==="failed"?uiText("Başarısız","Failed"):uiText("Taslak","Draft");
}
function safeStateId(value,fallback){
  const safe=String(value??"").replace(/[^a-zA-Z0-9_-]/g,"").slice(0,80);
  return safe||fallback;
}

async function loadBackendProfile() {
  const token = localStorage.getItem("socialdash_token");
  if (!token) return false;

  try {
    const data = await apiFetch("/api/profile");

    const user = data.user || {};

    frontendState.profile = {
      ...frontendState.profile,
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      username: user.username || "",
      title: user.title || frontendState.profile.title,
      country: user.country || frontendState.profile.country || "+90",
      photo: user.profile_image || "",
      plan: user.plan==="premium"?"Premium":user.plan==="free"?"Free":frontendState.profile.plan,
      joined: user.created_at || frontendState.profile.joined
    };

    frontendState.settings.security.twoFactorEnabled=!!user.two_factor_enabled;

    persistState();
    return true;

  } catch (error) {
    console.error("Profil alınamadı:", error);
    return false;
  }
}

