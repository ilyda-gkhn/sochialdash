settingsPanelDil=function(){
  const s=frontendState.settings;
  return `<section class="bg-surface-container-lowest rounded-xl p-md border shadow-sm space-y-md"><div><h3 class="font-headline-md text-headline-md">${uiText("Dil ve Bölge","Language & Region")}</h3><p class="text-body-sm text-on-surface-variant">${uiText("Uygulama dili ile tarih ve saat gösterimini düzenleyin.","Configure the application language and date/time display.")}</p></div><div class="grid grid-cols-1 md:grid-cols-2 gap-md"><div><label for="setting-language" class="text-label-sm">${uiText("Uygulama Dili","Application Language")}</label><select name="setting-language" id="setting-language" class="clean-select w-full mt-1 bg-surface-container-low border-none rounded-xl"><option value="tr" ${s.language==="tr"?"selected":""}>Türkçe</option><option value="en" ${s.language==="en"?"selected":""}>English</option></select></div><div><label for="setting-timezone" class="text-label-sm">${uiText("Zaman Dilimi","Time Zone")}</label><select name="setting-timezone" id="setting-timezone" class="clean-select w-full mt-1 bg-surface-container-low border-none rounded-xl"><option value="Europe/Istanbul" ${s.timezone==="Europe/Istanbul"?"selected":""}>GMT+03:00 İstanbul</option><option value="UTC" ${s.timezone==="UTC"?"selected":""}>GMT+00:00 UTC</option></select></div><div><label for="setting-dateformat" class="text-label-sm">${uiText("Tarih Formatı","Date Format")}</label><select name="setting-dateformat" id="setting-dateformat" class="clean-select w-full mt-1 bg-surface-container-low border-none rounded-xl"><option value="DD.MM.YYYY" ${s.dateFormat==="DD.MM.YYYY"?"selected":""}>${uiText("GG.AA.YYYY","DD.MM.YYYY")}</option><option value="MM/DD/YYYY" ${s.dateFormat==="MM/DD/YYYY"?"selected":""}>${uiText("AA/GG/YYYY","MM/DD/YYYY")}</option></select></div></div><button type="button" class="px-6 py-3 bg-primary text-white rounded-xl" data-command="saveRegionSettings()">${uiText("Kaydet","Save")}</button></section>`;
};
async function syncSettingsToBackend(partial){
  try{
    const {data:s}=await api.settings.update(partial);
    Object.assign(frontendState.settings,{theme:s.theme,language:s.language,timezone:s.timezone,dateFormat:s.dateFormat,autoDraft:s.autoDraft,sidebarOpen:s.sidebarOpen});
    frontendState.settings.notifications={email:s.emailNotifications,push:s.pushNotifications,weekly:s.weeklySummary,connection:s.connectionAlerts};
    frontendState.posts.forEach(p=>{if(p.scheduledAt)Object.assign(p,scheduledAtParts(p.scheduledAt));});
    persistState();applyTheme();return true;
  }catch(error){showToast(error.message||uiText("Ayarlar kaydedilemedi.","Settings could not be saved."));return false;}
}
saveRegionSettings=async function(){
  const values={language:document.getElementById("setting-language").value,timezone:document.getElementById("setting-timezone").value,dateFormat:document.getElementById("setting-dateformat").value};
  if(await syncSettingsToBackend(values)){render();showToast(uiText("Dil ve bölge ayarları kaydedildi","Language and region settings saved"));}
};


/* Central, allow-listed declarative event dispatcher. No inline JavaScript or eval. */
const uiCommandFunctions=new Set([
  "openAuthDialog","togglePassword","showLoginView","toggleSidebar","togglePlatforms","doLogout","submitLogin2FA",
  "startOAuthLogin",
  "openMobileSearch","toggleNotifications","markAllRead","toggleProfilePopover","openPlanDialog",
  "setSidebar","openCompose","closeCompose","toggleDropdown","selectPlatform","togglePreview",
  "addHashtag","toggleAccordion","saveCompose","publishToast","markRead","deleteNotifWithUndo",
  "closeDialog","confirmDialogAction","runUndo","submitForgot","submitResetPassword","toggleFrontendSwitch",
  "setCalendarQuickFilter","render","openDayActions","openPostDetail","openComposeForDate",
  "deletePost","duplicatePost","editPost","reschedulePost","retryPost","openMediaDetail","closeMediaDetail",
  "downloadMedia","deleteMedia","renameMedia","saveMediaRename","toggleAiHistory","newAiChat",
  "toggleAiArchive","restoreAiChat","useAiSuggestion","removeAiAttachment","copyAiMessage",
  "regenerateAiResponse","editAiResponse","convertAiMessage","rateAiResponse","selectAiChat",
  "toggleAiMenu","renameAiChat","pinAiChat","duplicateAiChat","archiveAiChat","deleteAiChat",
  "saveAiRename","saveEditedAiResponse","openNewsLink","subscribeNewsletter","setAllNotifications",
  "toggleNotificationSetting","openPasswordDialog","disable2FA","open2FADialog","confirmAllSessions",
  "confirmSingleSession","saveBehaviorSettings","confirmDeleteAccount","deleteAccountNow","savePassword","enable2FA",
  "removeProfilePhoto","saveNewTitle","connectSelectedAccount","openConnectDialog","accountAction",
  "selectPlatformAccount","navigate","openStatDetail","openPlatformPostDetail","saveRegionSettings","markCommentReplied",
  "savePlatformRange","openComposeMediaLibrary","chooseComposeMedia","setComposeAccount","setPlatformRange","updateCharCount","showToast"
]);
function splitUiCommandParts(value,separator){
  const parts=[];let current="",quote="",escape=false,depth=0;
  for(const character of String(value||"")){
    if(escape){current+=character;escape=false;continue;}
    if(character==="\\"){current+=character;escape=true;continue;}
    if(quote){current+=character;if(character===quote)quote="";continue;}
    if(character==="'"||character==='"' ){quote=character;current+=character;continue;}
    if(character==="("||character==="{"||character==="[")depth++;
    if(character===")"||character==="}"||character==="]")depth--;
    if(character===separator&&depth===0){if(current.trim())parts.push(current.trim());current="";continue;}
    current+=character;
  }
  if(current.trim())parts.push(current.trim());
  return parts;
}
function parseUiCommandValue(value,element,event){
  const token=String(value).trim();
  if(token==="this")return element;
  if(token==="event")return event;
  if(token==="this.value")return element.value;
  if(token==="currentMediaId")return currentMediaId;
  if(token==="{mediaId:currentMediaId}")return {mediaId:currentMediaId};
  if(token==="true")return true;
  if(token==="false")return false;
  if(token==="null")return null;
  if(/^-?\d+(?:\.\d+)?$/.test(token))return Number(token);
  const quoted=token.match(/^(['"])([\s\S]*)\1$/);
  if(quoted)return quoted[2].replace(/\\(['"\\])/g,"$1").replace(/\\n/g,"\n");
  throw new Error(`Unsupported UI command value: ${token}`);
}
function executeUiCommandPart(part,element,event){
  if(part==="return false")return;
  if(part==="event.stopPropagation()"){event.stopPropagation();return;}
  if(part==="this.closest('details').removeAttribute('open')"){element.closest("details")?.removeAttribute("open");return;}
  if(part==="this.textContent='Yanıtlandı'"){element.textContent=uiText("Yanıtlandı","Replied");return;}
  if(part==="this.disabled=true"){element.disabled=true;return;}
  const domRemove=part.match(/^document\.getElementById\((['"])([^'"]+)\1\)\.classList\.remove\((['"])([^'"]+)\3\)$/);
  if(domRemove){document.getElementById(domRemove[2])?.classList.remove(domRemove[4]);return;}
  const delayedMedia=part.match(/^setTimeout\(\(\)=>openMediaDetail\((\d+)\),50\)$/);
  if(delayedMedia){setTimeout(()=>openMediaDetail(Number(delayedMedia[1])),50);return;}
  const assignment=part.match(/^(calendarView|calendarQuickFilter|calendarStatusFilter|calendarPlatformFilter|activeSettingsTab|aiComposerPlatform|aiComposerTone)=(.+)$/);
  if(assignment){
    const value=parseUiCommandValue(assignment[2],element,event);
    if(assignment[1]==="calendarView")calendarView=value;
    else if(assignment[1]==="calendarQuickFilter")calendarQuickFilter=value;
    else if(assignment[1]==="calendarStatusFilter")calendarStatusFilter=value;
    else if(assignment[1]==="calendarPlatformFilter")calendarPlatformFilter=value;
    else if(assignment[1]==="activeSettingsTab")activeSettingsTab=value;
    else if(assignment[1]==="aiComposerPlatform")aiComposerPlatform=value;
    else aiComposerTone=value;
    return;
  }
  const localizedToast=part.match(/^showToast\(uiText\(([\s\S]+)\)\)$/);
  if(localizedToast){
    const values=splitUiCommandParts(localizedToast[1],",").map(value=>parseUiCommandValue(value,element,event));
    showToast(uiText(values[0],values[1]));return;
  }
  const call=part.match(/^([A-Za-z_$][\w$]*)\(([\s\S]*)\)$/);
  if(!call||!uiCommandFunctions.has(call[1]))throw new Error(`Unsupported UI command: ${part}`);
  const fn=globalThis[call[1]];
  if(typeof fn!=="function")throw new Error(`Missing UI command function: ${call[1]}`);
  const args=call[2].trim()?splitUiCommandParts(call[2],",").map(value=>parseUiCommandValue(value,element,event)):[];
  return fn(...args);
}
async function executeUiCommands(command,element,event){
  for(const part of splitUiCommandParts(command,";"))await executeUiCommandPart(part,element,event);
}
document.addEventListener("click",async event=>{
  const element=event.target.closest("[data-command]");if(!element||element.disabled||element.dataset.busy)return;
  element.dataset.busy="1";
  if(element.tagName==="A")event.preventDefault();
  try{await executeUiCommands(element.dataset.command,element,event);}
  catch(error){console.error("SocialDash UI command error",error);showToast(uiText("İşlem tamamlanamadı. Lütfen tekrar deneyin.","The action could not be completed. Please try again."));}
  finally{delete element.dataset.busy;}
},true);
document.addEventListener("change",event=>{
  const element=event.target.closest("[data-change-command]");if(!element)return;
  try{executeUiCommands(element.dataset.changeCommand,element,event);}catch(error){console.error("SocialDash change command error",error);}
},true);
document.addEventListener("input",event=>{
  const element=event.target.closest("[data-input-command]");if(!element)return;
  try{executeUiCommands(element.dataset.inputCommand,element,event);}catch(error){console.error("SocialDash input command error",error);}
},true);
for(const [id,submit] of [["login-form",()=>doLogin()],["register-form",()=>submitRegister()]]){
  document.getElementById(id)?.addEventListener("submit",async event=>{
    event.preventDefault();const form=event.currentTarget;if(form.dataset.busy)return;form.dataset.busy="1";
    const button=form.querySelector('[type="submit"]');button.disabled=true;
    try{await submit();}finally{button.disabled=false;delete form.dataset.busy;}
  });
}

ensureMultiAccountState();
function render(){
  closeAllDropdowns();
  try{
    renderShell();
    syncPlatformMenu();
    updateProfileUI();
    applyInterfaceLanguage();
  }catch(error){
    console.error("SocialDash render error",error);
    const root=document.getElementById("page-root");
    if(root)root.innerHTML=`<section class="bg-error-container/20 border border-error/20 rounded-2xl p-lg text-center" role="alert"><span class="material-symbols-outlined text-error text-[48px]">error</span><h2 class="font-headline-md text-headline-md mt-3">${uiText("Sayfa yüklenemedi","Page could not be loaded")}</h2><p class="text-body-sm text-on-surface-variant mt-2">${uiText("Bu bölümde beklenmeyen bir frontend hatası oluştu.","An unexpected frontend error occurred in this section.")}</p><button type="button" class="mt-4 px-5 py-2.5 bg-primary text-white rounded-xl" data-command="render()">${uiText("Tekrar Dene","Try Again")}</button></section>`;
  }
}
window.addEventListener("unhandledrejection",event=>{console.error("SocialDash async error",event.reason);showToast(uiText("İşlem tamamlanamadı. Lütfen tekrar deneyin.","The action could not be completed. Please try again."));});

syncPlatformMenu();
applyInterfaceLanguage();
hydrateMediaAssets();
const initialResetToken=new URLSearchParams(location.search).get("resetToken");
if(initialResetToken)setTimeout(()=>openResetPasswordDialog(initialResetToken),0);

// Handles the return trip from /api/auth/google or /api/auth/apple: either
// a one-time handoff code to exchange for real session tokens, or an
// error/cancelled/conflict status if the OAuth attempt didn't succeed.
// Distinguished from the social-account-connect OAuth redirect below by
// using `provider` instead of `platform` as the query key.
(function handleOAuthLoginRedirect(){
  const params=new URLSearchParams(location.search);
  const code=params.get("oauth_code");
  const provider=params.get("provider");
  if(!code&&!(provider&&!params.get("platform")))return;
  const message=params.get("message");
  history.replaceState({},"",location.pathname+location.hash);
  if(code){
    (async()=>{
      try{
        const res=await fetch("/api/auth/oauth/exchange",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});
        const data=await res.json();
        if(!res.ok){showToast(data.message||uiText("Giriş tamamlanamadı.","Sign-in could not be completed."));return;}
        await completeAuthentication(data,{email:data.user.email,remember:true});
        showToast(uiText("Giriş başarılı.","Signed in successfully."));
      }catch(e){
        showToast(uiText("Sunucuya bağlanılamadı.","Could not connect to the server."));
      }
    })();
  }else{
    showToast(message||uiText("Giriş tamamlanamadı.","Sign-in could not be completed."));
  }
})();

if(frontendState.auth?.sessionActive&&(frontendState.auth?.remember||sessionStorage.getItem("socialdash_session")==="1")){
  (async()=>{
    if(!localStorage.getItem("socialdash_token")&&!await sdRefreshTokens()){sdForceLogout();return;}
    if(!await loadBackendProfile()){sdForceLogout();return;}
    await hydrateFromBackend();
    if(!frontendState.auth.sessionActive)return;
    document.getElementById("login-view").classList.add("hidden");document.getElementById("register-view").classList.add("hidden");document.getElementById("app-shell").classList.remove("hidden");
    navigate(currentRoute,currentPlatform);
    const params=new URLSearchParams(location.search);
    if(params.get("oauth")){showToast(params.get("oauth")==="success"?uiText("Hesap bağlandı","Account connected"):params.get("message")||uiText("Bağlantı kurulamadı","Connection failed"));history.replaceState({},"",location.pathname+location.hash);}
  })().catch(()=>showToast(uiText("Uygulama yüklenemedi. Tekrar deneyin.","Could not load the app. Please try again.")));


}
