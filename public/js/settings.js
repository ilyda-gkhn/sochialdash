function settingsPanelDavranis(){
  return `<div class="space-y-md"><section class="bg-surface-container-lowest rounded-xl p-md border shadow-sm"><h3 class="font-headline-md text-headline-md">${uiText("Sayfa Davranışı","Page Behaviour")}</h3><div class="space-y-3 mt-4"><label class="flex items-center justify-between p-3 bg-surface-container-low rounded-xl"><span><b>${uiText("Otomatik taslak kaydetme","Automatic draft saving")}</b><small class="block text-on-surface-variant">${uiText("Gönderi metnini tarayıcıda korur.","Keeps post copy in this browser.")}</small></span><input name="auto-draft-setting" id="auto-draft-setting" type="checkbox" ${frontendState.settings.autoDraft?"checked":""}></label><label class="flex items-center justify-between p-3 bg-surface-container-low rounded-xl"><span><b>${uiText("Menü başlangıçta açık","Open menu on start")}</b><small class="block text-on-surface-variant">${uiText("Girişten sonra sol menüyü açık gösterir.","Shows the left menu after sign-in.")}</small></span><input name="sidebar-open-setting" id="sidebar-open-setting" type="checkbox" ${frontendState.settings.sidebarOpen?"checked":""}></label><button type="button" class="px-5 py-2.5 bg-primary text-white rounded-xl" data-command="saveBehaviorSettings()">${uiText("Kaydet","Save")}</button></div></section><section class="bg-error-container/20 rounded-xl p-md border border-error/20"><h3 class="font-headline-md text-[20px] text-error">${uiText("Hesabı Kalıcı Olarak Sil","Permanently Delete Account")}</h3><p class="text-body-sm text-on-surface-variant mt-1">${uiText("Hesabınız ve ilişkili tüm veriler kalıcı olarak silinir. Bu işlem geri alınamaz.","Your account and all related data are permanently deleted. This cannot be undone.")}</p><button type="button" class="mt-4 px-5 py-2.5 bg-error text-white rounded-xl" data-command="confirmDeleteAccount()">${uiText("Hesabı Sil","Delete Account")}</button></section></div>`;
}
initSettingsPage=function(){
  const fns={gorunum:settingsPanelGorunum,hesaplar:settingsPanelHesaplar,bildirimler:settingsPanelBildirimler,guvenlik:settingsPanelGuvenlik,dil:settingsPanelDil,davranis:settingsPanelDavranis};
  function setTab(tab,focus=false){activeSettingsTab=tab;document.querySelectorAll(".settings-tab-btn").forEach(b=>{const a=b.dataset.tab===tab;b.classList.toggle("bg-primary-container/40",a);b.classList.toggle("text-primary",a);b.setAttribute("aria-selected",String(a));b.tabIndex=a?0:-1;if(a&&focus)b.focus();});const panel=document.getElementById("settings-panels");panel.setAttribute("aria-labelledby",`settings-tab-${tab}`);panel.innerHTML=fns[tab]();document.querySelectorAll(".theme-card").forEach(card=>card.addEventListener("click",async()=>{if(await syncSettingsToBackend({theme:card.dataset.theme}))setTab("gorunum");}));if(tab==="dil"){document.getElementById("setting-timezone").value=frontendState.settings.timezone;document.getElementById("setting-dateformat").value=frontendState.settings.dateFormat;}if(tab==="guvenlik"){hydrateSecuritySessions();}applyInterfaceLanguage();}
  const buttons=[...document.querySelectorAll(".settings-tab-btn")];
  buttons.forEach((button,index)=>{button.addEventListener("click",()=>setTab(button.dataset.tab));button.addEventListener("keydown",event=>{if(!["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(event.key))return;event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?buttons.length-1:["ArrowRight","ArrowDown"].includes(event.key)?(index+1)%buttons.length:(index-1+buttons.length)%buttons.length;setTab(buttons[next].dataset.tab,true);});});setTab(activeSettingsTab);
};
function urlBase64Bytes(value){const padding="=".repeat((4-value.length%4)%4),base64=(value+padding).replace(/-/g,"+").replace(/_/g,"/");return Uint8Array.from(atob(base64),c=>c.charCodeAt(0));}
async function enableBrowserPush(){if(!("serviceWorker" in navigator)||!("PushManager" in window))throw new Error(uiText("Bu tarayıcı push bildirimlerini desteklemiyor.","This browser does not support push notifications."));const key=await api.notifications.pushKey();if(!key?.configured||!key.data)throw new Error(uiText("Sunucuda push anahtarları yapılandırılmamış.","Push keys are not configured on the server."));const permission=await Notification.requestPermission();if(permission!=="granted")throw new Error(uiText("Bildirim izni verilmedi.","Notification permission was not granted."));const registration=await navigator.serviceWorker.register("/sw.js");const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64Bytes(key.data)});await api.notifications.subscribePush(subscription.toJSON());}
async function disableBrowserPush(){if(!("serviceWorker" in navigator))return;const registration=await navigator.serviceWorker.getRegistration(),subscription=await registration?.pushManager.getSubscription();if(subscription){await api.notifications.unsubscribePush(subscription.endpoint);await subscription.unsubscribe();}}
async function toggleNotificationSetting(key){
  const next=!frontendState.settings.notifications[key];
  try{if(key==="push"){if(next)await enableBrowserPush();else await disableBrowserPush();}
    const map={email:"emailNotifications",push:"pushNotifications",weekly:"weeklySummary",connection:"connectionAlerts"};
    if(await syncSettingsToBackend({[map[key]]:next}))render();
  }catch(error){showToast(error.message);}
}

async function setAllNotifications(value){const body={emailNotifications:value,pushNotifications:value,weeklySummary:value,connectionAlerts:value};try{if(value)await enableBrowserPush();else await disableBrowserPush();await api.settings.update(body);Object.keys(frontendState.settings.notifications).forEach(k=>frontendState.settings.notifications[k]=value);persistState();render();}catch(err){showToast(err?.data?.message||err.message||uiText("Ayarlar kaydedilemedi.","Settings could not be saved."));}}

async function saveBehaviorSettings(){
  if(await syncSettingsToBackend({autoDraft:document.getElementById("auto-draft-setting").checked,sidebarOpen:document.getElementById("sidebar-open-setting").checked}))showToast(uiText("Sayfa davranışı kaydedildi","Page behaviour saved"));
}

function openPasswordDialog(){openDialog("Şifreyi Değiştir",`<div class="space-y-3"><label for="old-pass" class="sd-visually-hidden">Mevcut şifre</label><input name="old-pass" id="old-pass" type="password" autocomplete="current-password" class="w-full rounded-xl bg-surface-container-low border-none" placeholder="Mevcut şifre"><label for="new-pass" class="sd-visually-hidden">Yeni şifre</label><input name="new-pass" id="new-pass" type="password" autocomplete="new-password" class="w-full rounded-xl bg-surface-container-low border-none" placeholder="Yeni şifre" aria-describedby="password-help password-error"><label for="repeat-pass" class="sd-visually-hidden">Yeni şifre tekrar</label><input name="repeat-pass" id="repeat-pass" type="password" autocomplete="new-password" class="w-full rounded-xl bg-surface-container-low border-none" placeholder="Yeni şifre tekrar" aria-describedby="password-error"><p class="text-[11px] text-on-surface-variant" id="password-help">En az 8 karakter, bir büyük harf ve bir rakam.</p><p class="field-error" id="password-error"></p></div>`,`<button type="button" class="px-5 py-2.5 bg-surface-container rounded-xl" data-command="closeDialog()">Vazgeç</button><button type="button" class="px-5 py-2.5 bg-primary text-white rounded-xl" data-command="savePassword()">Kaydet</button>`);}
async function savePassword(){
  const oldPass=document.getElementById("old-pass").value,n=document.getElementById("new-pass").value,r=document.getElementById("repeat-pass").value,e=document.getElementById("password-error");
  if(!/^(?=.*[A-ZÇĞİÖŞÜ])(?=.*[a-zçğıöşü])(?=.*\d).{8,}$/.test(n)){e.textContent="Şifre kuralları karşılanmıyor.";return;}
  if(n!==r){e.textContent="Yeni şifreler eşleşmiyor.";return;}
  if(!oldPass){e.textContent="Mevcut şifrenizi girin.";return;}
  try{
    await api.profile.changePassword(oldPass,n);
    closeDialog();showToast(uiText("Şifre başarıyla güncellendi","Password updated successfully"));
  }catch(err){
    e.textContent=err?.data?.message||err.message||uiText("Şifre güncellenemedi.","The password could not be updated.");
  }
}
async function open2FADialog(){
  openDialog(uiText("İki Adımlı Doğrulama","Two-Step Verification"),
    `<div class="text-center"><span aria-hidden="true" class="material-symbols-outlined text-[56px] text-primary">qr_code_2</span><p class="mt-3">${uiText("Kimlik doğrulama uygulaması için gizli anahtar yükleniyor…","Loading the secret key for your authenticator app…")}</p></div>`,
    `<button type="button" class="px-5 py-2.5 bg-surface-container rounded-xl" data-command="closeDialog()">${uiText("Vazgeç","Cancel")}</button>`
  );
  try{
    const res=await api.security.setup2fa();
    const secret=res?.data?.secretBase32||"";
    document.getElementById("shared-dialog-body").innerHTML=`<div class="text-center"><span aria-hidden="true" class="material-symbols-outlined text-[56px] text-primary">qr_code_2</span><p class="mt-3">${uiText("Kimlik doğrulama uygulamanıza bu anahtarı ekleyin:","Add this key to your authenticator app:")}</p><p class="mt-2 font-mono text-label-sm tracking-widest break-all bg-surface-container-low rounded-lg p-2">${escapeHtml(secret)}</p><label for="twofa-code" class="sd-visually-hidden">${uiText("6 haneli doğrulama kodu","6-digit verification code")}</label><input name="twofa-code" id="twofa-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" class="mt-4 text-center tracking-[.4em] rounded-xl bg-surface-container-low border-none" placeholder="000000" aria-describedby="twofa-error"><p class="field-error" id="twofa-error"></p></div>`;
    document.getElementById("shared-dialog-actions").innerHTML=`<button type="button" class="px-5 py-2.5 bg-surface-container rounded-xl" data-command="closeDialog()">${uiText("Vazgeç","Cancel")}</button><button type="button" class="px-5 py-2.5 bg-primary text-white rounded-xl" data-command="enable2FA()">${uiText("Etkinleştir","Enable")}</button>`;
  }catch(err){
    document.getElementById("shared-dialog-body").innerHTML=`<p class="text-error text-body-sm">${escapeHtml(err?.data?.message||err.message||uiText("2FA kurulumu başlatılamadı.","Could not start 2FA setup."))}</p>`;
  }
}
async function enable2FA(){
  const input=document.getElementById("twofa-code"),error=document.getElementById("twofa-error");
  if(!/^\d{6}$/.test(input.value)){error.textContent="6 haneli doğrulama kodunu girin.";return;}
  try{
    await api.security.verify2fa(input.value);
    frontendState.settings.security.twoFactorEnabled=true;persistState();closeDialog();render();showToast(uiText("2FA etkinleştirildi","2FA enabled"));
  }catch(err){error.textContent=err?.data?.message||err.message||uiText("Doğrulama başarısız.","Verification failed.");}
}
function disable2FA(){confirmAction("2FA'yı Devre Dışı Bırak","İki adımlı doğrulama kapatılacak.","Devre Dışı Bırak",async()=>{
  try{
    await api.security.disable2fa();
    frontendState.settings.security.twoFactorEnabled=false;persistState();closeDialog();render();showToast("2FA devre dışı bırakıldı");
  }catch(err){showToast(err?.data?.message||err.message||uiText("2FA kapatılamadı.","Could not disable 2FA."));}
});}
function confirmSingleSession(sessionId){confirmAction("Oturumu Kapat","Seçilen cihazdaki oturum kapatılacak.","Oturumu Kapat",async()=>{
  try{await api.security.revokeSession(sessionId);frontendState.settings.security.sessions=frontendState.settings.security.sessions.filter(session=>session.id!==sessionId);persistState();closeDialog();render();showToast("Oturum kapatıldı");}
  catch(err){showToast(err?.data?.message||uiText("Oturum kapatılamadı.","The session could not be closed."));}
});}
function confirmAllSessions(){confirmAction("Tüm Cihazlardan Çıkış","Bu cihaz dışındaki tüm oturumlar kapatılacak.","Tümünü Kapat",async()=>{
  try{await api.security.revokeOtherSessions();frontendState.settings.security.sessions=frontendState.settings.security.sessions.filter(session=>session.current);persistState();closeDialog();render();showToast("Diğer oturumlar kapatıldı");}
  catch(err){showToast(err?.data?.message||uiText("Diğer oturumlar kapatılamadı.","Other sessions could not be closed."));}
});}
async function hydrateSecuritySessions(){
  try{
    const res=await api.security.listSessions();
    if(Array.isArray(res?.data)){
      frontendState.settings.security.sessions=res.data.map(s=>({id:s.id,label:`${s.label||uiText("Bilinmeyen cihaz","Unknown device")}${s.ip?` • ${s.ip}`:""}`,current:!!s.current}));
      persistState();
      if(currentRoute==="settings"&&activeSettingsTab==="guvenlik")render();
    }
  }catch(err){console.error("Oturumlar alınamadı:",err);}
}
function confirmDeleteAccount(){openDialog(uiText("Hesabı Kalıcı Olarak Sil","Permanently Delete Account"),`<p class="text-body-sm text-error mb-4">${uiText("Bu işlem hesabınızı, gönderilerinizi, medyanızı ve tüm verilerinizi kalıcı olarak siler. Geri alınamaz.","This permanently deletes your account, posts, media and all data. It cannot be undone.")}</p><label for="delete-account-password" class="block text-label-sm mb-2">${uiText("Onaylamak için mevcut şifreniz","Current password to confirm")}</label><input id="delete-account-password" type="password" autocomplete="current-password" class="w-full rounded-xl bg-surface-container-low border-none" aria-describedby="delete-account-error"><p class="field-error" id="delete-account-error"></p>`,`<button type="button" class="px-5 py-2.5 bg-surface-container rounded-xl" data-command="closeDialog()">${uiText("Vazgeç","Cancel")}</button><button type="button" class="px-5 py-2.5 bg-error text-white rounded-xl" data-command="deleteAccountNow()">${uiText("Hesabı Sil","Delete Account")}</button>`);}
async function deleteAccountNow(){
  const input=document.getElementById("delete-account-password"),error=document.getElementById("delete-account-error");
  if(!input?.value){error.textContent=uiText("Mevcut şifrenizi girin.","Enter your current password.");return;}
  try{await api.profile.deleteAccount(input.value);}catch(err){error.textContent=err?.data?.message||uiText("Hesap silinemedi.","The account could not be deleted.");return;}
  localStorage.removeItem(SD_STORAGE_KEY);
  localStorage.removeItem("socialdash_frontend_v4");
  localStorage.removeItem("socialdash_frontend_v3");
  localStorage.removeItem("socialdash_compose_draft");
  localStorage.removeItem("socialdash_registered_email");
  localStorage.removeItem("socialdash_remember");
  localStorage.removeItem("socialdash_remembered_email");
  sessionStorage.removeItem("socialdash_session");

  frontendState=cloneData(defaultFrontendState);
  currentAiChatId=frontendState.aiChats.find(chat=>!chat.archived)?.id||null;
  aiArchiveMode=false;
  aiPendingAttachment=null;
  aiSearchQuery="";
  openAiMenuId=null;
  composeFileData=null;
  composePrefillMediaId=null;
  composeEditingPostId=null;
  composeAccountSelections={};
  composeAdvancedState={};
  composeDirty=false;
  currentRoute="home";
  location.hash="";
  persistState();
  closeDialog();
  await doLogout();
  applyTheme(frontendState.settings.theme);
  showToast(uiText("Hesabınız kalıcı olarak silindi","Your account was permanently deleted"));
}

/* ---------- Profile ---------- */
function profileInitials(name){
  return String(name||"Kullanıcı").split(/\s+/).filter(Boolean).map(x=>x[0]).slice(0,2).join("").toLocaleUpperCase("tr-TR");
}
renderProfile=function(){
  const p=frontendState.profile,titles=Object.keys(frontendState.titles),responsibilities=frontendState.titles[p.title]||[];
  return `<div class="space-y-lg"><div><h1 class="font-headline-lg text-headline-lg">Kullanıcı Profili</h1><p class="text-on-surface-variant">Kişisel bilgilerinizi ve üyelik detaylarınızı buradan yönetebilirsiniz.</p></div><section class="bg-surface-container-lowest rounded-2xl p-md lg:p-lg border shadow-sm"><div class="flex flex-col md:flex-row gap-lg"><div class="flex flex-col items-center gap-md w-full md:w-1/3"><div class="relative"><div id="profile-photo-preview" class="w-36 h-36 rounded-full border-4 border-primary-container bg-cover bg-center flex items-center justify-center bg-primary-container/40 text-primary font-headline-lg text-headline-lg" style="${p.photo?`background-image:url('${p.photo}')`:""}">${p.photo?"":escapeHtml(profileInitials(p.name))}</div><label class="absolute bottom-2 right-2 bg-primary text-white w-10 h-10 rounded-full flex items-center justify-center cursor-pointer"><span class="sd-visually-hidden">${uiText("Profil fotoğrafı seç","Choose profile photo")}</span><span aria-hidden="true" class="material-symbols-outlined text-[20px]">photo_camera</span><input name="profile-photo-input" id="profile-photo-input" class="hidden" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="profile-photo-error"></label></div><div class="text-center"><h3 class="font-headline-md text-[18px]">${escapeHtml(p.name)}</h3><p class="text-on-surface-variant text-label-sm">${escapeHtml(p.title)}</p></div><button type="button" class="text-primary font-label-md" data-command="removeProfilePhoto()">Fotoğrafı Kaldır</button><p class="field-error" id="profile-photo-error"></p></div>
    <div class="flex-1"><h2 class="font-headline-md text-headline-md mb-md">Profil Bilgileri</h2><form id="profile-form" class="grid grid-cols-1 md:grid-cols-2 gap-md"><div><label for="profile-name" class="text-label-sm font-semibold text-on-surface-variant">Ad Soyad</label><input name="profile-name" id="profile-name" aria-describedby="profile-name-error" class="w-full bg-surface-container-low border-none rounded-xl mt-1" value="${escapeHtml(p.name)}"><p class="field-error" id="profile-name-error"></p></div><div><label for="profile-username" class="text-label-sm font-semibold text-on-surface-variant">Kullanıcı Adı</label><input name="profile-username" id="profile-username" class="w-full bg-surface-container-low border-none rounded-xl mt-1" value="${escapeHtml(p.username)}"></div><div><label for="profile-email" class="text-label-sm font-semibold text-on-surface-variant">E-posta</label><input name="profile-email" id="profile-email" aria-describedby="profile-email-error" type="email" class="w-full bg-surface-container-low border-none rounded-xl mt-1" value="${escapeHtml(p.email)}"><p class="field-error" id="profile-email-error"></p></div><div><label for="profile-phone" class="text-label-sm font-semibold text-on-surface-variant">Telefon Numarası</label><div class="flex gap-2 mt-1"><select name="profile-country" id="profile-country" aria-label="${uiText("Ülke kodu","Country code")}" class="clean-select w-[120px] bg-surface-container-low border-none rounded-xl">${[["TR","+90"],["US","+1"],["GB","+44"],["DE","+49"],["FR","+33"],["NL","+31"],["AZ","+994"]].map(([country,code])=>`<option value="${code}" ${p.country===code?"selected":""}>${country} ${code}</option>`).join("")}</select><input name="profile-phone" id="profile-phone" aria-describedby="profile-phone-error" inputmode="tel" class="flex-1 min-w-0 bg-surface-container-low border-none rounded-xl" value="${escapeHtml(p.phone)}"></div><p class="field-error" id="profile-phone-error"></p></div><div class="md:col-span-2"><label for="profile-title" class="text-label-sm font-semibold text-on-surface-variant">Unvan</label><select name="profile-title" id="profile-title" class="clean-select w-full bg-surface-container-low border-none rounded-xl mt-1">${titles.map(x=>`<option ${x===p.title?"selected":""}>${escapeHtml(x)}</option>`).join("")}<option value="__new">+ Yeni unvan ekle</option></select><div id="title-responsibilities" class="mt-2 p-3 bg-surface-container-low rounded-xl">${responsibilities.map(x=>`<p class="text-body-sm">• ${escapeHtml(x)}</p>`).join("")}</div></div><div class="md:col-span-2 text-right"><button class="bg-primary text-white px-8 py-3 rounded-xl" type="submit">Değişiklikleri Kaydet</button></div></form></div></div></section><section class="bg-surface-container-lowest rounded-2xl p-md border"><div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-lg"><h2 class="font-headline-md text-headline-md">Üyelik Bilgileri</h2><span class="bg-primary-container px-4 py-1.5 rounded-full font-label-md inline-flex items-center gap-2 w-fit"><span class="material-symbols-outlined text-[18px]">workspace_premium</span>${escapeHtml(p.plan)} Aktif</span></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-md"><div class="p-4 bg-surface-container-low rounded-xl"><small>Mevcut Plan</small><p class="font-headline-md text-[20px]">${escapeHtml(p.plan)}</p></div><div class="p-4 bg-surface-container-low rounded-xl"><small>Katılım Tarihi</small><p class="font-headline-md text-[20px]">${escapeHtml(p.joined?formatDate(scheduledAtParts(new Date(sdParseTimestamp(p.joined)).toISOString()).date):"—")}</p></div></div></section></div>`;
};
let pendingProfilePhoto=null;
let pendingProfilePhotoFile=null;
initProfilePage=function(){
  const input=document.getElementById("profile-photo-input"),form=document.getElementById("profile-form"),title=document.getElementById("profile-title");
  input.addEventListener("change",()=>{const f=input.files[0],err=document.getElementById("profile-photo-error");if(!f)return;if(!["image/jpeg","image/png","image/webp"].includes(f.type)){err.textContent="Yalnızca JPG, PNG veya WEBP yükleyin.";return;}if(f.size>3*1024*1024){err.textContent="Fotoğraf 3 MB'den küçük olmalı.";return;}err.textContent="";pendingProfilePhotoFile=f;const r=new FileReader();r.onload=()=>{pendingProfilePhoto=r.result;const el=document.getElementById("profile-photo-preview");el.innerHTML="";el.style.backgroundImage=`url('${r.result}')`;};r.readAsDataURL(f);});
  title.addEventListener("change",()=>{if(title.value==="__new"){openNewTitleDialog();title.value=frontendState.profile.title;return;}document.getElementById("title-responsibilities").innerHTML=(frontendState.titles[title.value]||[]).map(x=>`<p class="text-body-sm">• ${escapeHtml(x)}</p>`).join("");});
  form.addEventListener("submit",event=>{event.preventDefault();saveProfile();});
};


async function saveProfile(){
  const name=document.getElementById("profile-name").value.trim();
  const phone=document.getElementById("profile-phone").value.trim();
  const email=document.getElementById("profile-email");
  const username=document.getElementById("profile-username").value.trim();
  const country=document.getElementById("profile-country").value;
  const title=document.getElementById("profile-title").value;

  const phoneValid=!phone||/^[\d\s()-]{7,18}$/.test(phone)&&phone.replace(/\D/g,"").length>=7;
  const validName=setFieldError("profile-name","profile-name-error",name.length>=3?"":uiText("Ad soyad en az 3 karakter olmalı.","Full name must be at least 3 characters."));
  const validEmail=setFieldError("profile-email","profile-email-error",email.checkValidity()?"":uiText("Geçerli bir e-posta adresi girin.","Enter a valid email address."));
  const validPhone=setFieldError("profile-phone","profile-phone-error",phoneValid?"":uiText("Geçerli bir telefon numarası girin.","Enter a valid phone number."));

  if(!validName||!validEmail||!validPhone){
    document.querySelector('#profile-form [aria-invalid="true"]')?.focus();
    showToast(uiText("Profil alanlarını kontrol edin","Check the profile fields"));
    return;
  }

  const token=localStorage.getItem("socialdash_token");
  if(!token){
    showToast(uiText("Oturum bulunamadı. Lütfen tekrar giriş yapın.","Session not found. Please sign in again."));
    return;
  }

  try{
    const data=await apiFetch("/api/profile",{method:"PUT",body:JSON.stringify({name,email:email.value.trim(),phone,username,title,country})});
    const user=data.user||{};
    Object.assign(frontendState.profile,{
      name:user.name||name,
      email:user.email||email.value.trim(),
      phone:user.phone??phone,
      username:user.username??username,
      country:user.country||country,
      title:user.title||title,
      photo:user.profile_image||"",
      joined:user.created_at||frontendState.profile.joined
    });

    if(pendingProfilePhotoFile){
      try{
        const formData=new FormData();formData.append("avatar",pendingProfilePhotoFile);
        const avatarRes=await api.profile.uploadAvatar(formData);
        if(avatarRes?.profile_image)frontendState.profile.photo=avatarRes.profile_image;
      }catch(avatarErr){showToast(uiText("Profil bilgileri kaydedildi, fotoğraf yüklenemedi. Tekrar deneyin.","Profile saved, but the photo upload failed. Please try again."));updateProfileUI();return;}
      pendingProfilePhotoFile=null;
    }

    pendingProfilePhoto=null;
    logActivity("person",uiText("Profil güncellendi","Profile updated"),`${frontendState.profile.country} ${frontendState.profile.phone}`);
    persistState();
    updateProfileUI();
    render();
    showToast(data.message||uiText("Profil güncellendi","Profile updated"));
  }catch(error){
    console.error("Profil güncellenemedi:",error);
    showToast(uiText("Sunucuya bağlanılamadı.","Could not connect to the server."));
  }
}

async function removeProfilePhoto(){
  try{await api.profile.removeAvatar();pendingProfilePhoto="";pendingProfilePhotoFile=null;frontendState.profile.photo="";persistState();render();showToast("Profil fotoğrafı kaldırıldı");}
  catch(err){showToast(err?.data?.message||uiText("Fotoğraf kaldırılamadı.","The photo could not be removed."));}
}
function openNewTitleDialog(){openDialog(uiText("Yeni Unvan Ekle","Add New Title"),`<div class="space-y-3"><label for="new-title-name" class="text-label-sm">${uiText("Unvan adı","Title name")}</label><input name="new-title-name" id="new-title-name" class="w-full rounded-xl bg-surface-container-low border-none" placeholder="${uiText("Unvan adı","Title name")}" aria-describedby="new-title-error"><label for="new-title-tasks" class="text-label-sm">${uiText("Sorumluluklar","Responsibilities")}</label><textarea name="new-title-tasks" id="new-title-tasks" class="w-full rounded-xl bg-surface-container-low border-none" placeholder="${uiText("Sorumlulukları her satıra bir tane yazın","Enter one responsibility per line")}" aria-describedby="new-title-error"></textarea><p class="field-error" id="new-title-error"></p></div>`,`<button type="button" class="px-5 py-2.5 bg-surface-container rounded-xl" data-command="closeDialog()">${uiText("Vazgeç","Cancel")}</button><button type="button" class="px-5 py-2.5 bg-primary text-white rounded-xl" data-command="saveNewTitle()">${uiText("Ekle","Add")}</button>`);}
async function saveNewTitle(){const nameInput=document.getElementById("new-title-name"),tasksInput=document.getElementById("new-title-tasks"),n=nameInput.value.trim(),tasks=tasksInput.value.split("\n").map(x=>x.trim()).filter(Boolean);if(!n||!tasks.length){document.getElementById("new-title-error").textContent=uiText("Unvan ve en az bir sorumluluk girin.","Enter a title and at least one responsibility.");nameInput.setAttribute("aria-invalid",String(!n));tasksInput.setAttribute("aria-invalid",String(!tasks.length));(!n?nameInput:tasksInput).focus();return;}if(!await syncSettingsToBackend({customTitles:{...frontendState.titles,[n]:tasks}}))return;frontendState.titles[n]=tasks;frontendState.profile.title=n;persistState();closeDialog();render();showToast(uiText("Yeni unvan eklendi","New title added"));}

/* ---------- Home cards, global search, notifications and shell lifecycle ---------- */
renderHome=function(){
  const posts=frontendState.posts,upcoming=posts.filter(p=>normalizePostStatus(p.status)!=="published").sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time)).slice(0,3);
  const dashboard=frontendState.dashboard||{};
  const postCounts=dashboard.posts||{};
  const warningCount=platformKeys.flatMap(key=>connectedProfiles(key)).filter(a=>a.status!=="active").length;
  const stats=[
    ["event_upcoming","primary-container/60","primary","Bugün planlanan",`${posts.filter(p=>p.date===todayISO()&&normalizePostStatus(p.status)==="scheduled").length} Gönderi`,"setCalendarQuickFilter('today');navigate('calendar')"],
    ["pending_actions","secondary-container/30","secondary","Taslaklar",`${posts.filter(p=>normalizePostStatus(p.status)==="draft").length} Taslak`,"setCalendarQuickFilter('draft');navigate('calendar')"],
    ["notifications","tertiary-container/60","tertiary","Okunmamış bildirim",`${frontendState.notifications.filter(n=>!n.read).length} Bildirim`,"toggleNotifications(event)"],
    ["link_off","error-container/40","error","Bağlantı sorunu",`${warningCount} Hesap`,"activeSettingsTab='hesaplar';navigate('settings')"]
  ];
  const activities=(frontendState.activities||[]).slice(0,4);
  return `<section class="mb-lg"><h2 class="font-headline-lg text-headline-lg">Günaydın, ${escapeHtml(frontendState.profile.name.split(" ")[0])}</h2><p class="text-on-surface-variant mt-1">Bugün yönetilmesi gereken birkaç önemli işlem bulunuyor.</p></section>
    <section class="space-y-md mb-lg"><h3 class="text-label-sm uppercase tracking-widest text-on-surface-variant/70">Öncelikli İşler</h3><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">${stats.map((x,i)=>`<button type="button" aria-label="${escapeHtml(`${x[3]}: ${x[4]}`)}" data-command="${x[5]}" class="${i===3?"bg-error-container/10 border-error/20":"bg-surface-container-lowest border-outline-variant/20"} p-md rounded-2xl border hover:-translate-y-1 hover:shadow-md transition-all flex flex-col justify-between h-[150px] text-left"><div class="w-11 h-11 bg-${x[1]} rounded-xl text-${x[2]} flex items-center justify-center"><span class="material-symbols-outlined text-[23px]">${x[0]}</span></div><div><p class="priority-label text-${i===3?"error":"on-surface-variant"}">${x[3]}</p><p class="priority-value text-${i===3?"error":"on-surface"}">${x[4]}</p></div></button>`).join("")}</div></section>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-md"><section class="bg-surface-container-low/40 rounded-3xl p-md border"><div class="flex justify-between mb-md"><h3 class="font-headline-md text-headline-md">Yaklaşan Gönderiler</h3><button type="button" class="text-primary font-label-md" data-route="calendar">Tümünü Gör</button></div><div class="space-y-md">${upcoming.length?upcoming.map(postCardSmall).join(""):emptyState("Yaklaşan gönderi yok")}</div></section>
    <section class="bg-surface-container-lowest rounded-3xl p-md border"><h3 class="font-headline-md text-headline-md mb-md">Son İşlemler</h3><div class="space-y-2">${activities.length?activities.map(x=>`<div class="relative flex gap-md p-3 rounded-xl"><div class="w-9 h-9 rounded-full bg-primary-container/40 flex items-center justify-center text-primary"><span class="material-symbols-outlined text-[18px]">${escapeHtml(x.icon)}</span></div><div class="min-w-0"><div class="flex flex-wrap items-center gap-2"><p class="font-bold">${escapeHtml(x.title)}</p><span class="text-[10px] text-on-surface-variant">${escapeHtml(x.time||"")}</span></div><p class="text-body-sm text-on-surface-variant truncate">${escapeHtml(x.detail)}</p></div></div>`).join(""):emptyState("Henüz işlem yok")}</div></section></div>`;
};
function updateProfileUI(){
  const pop=document.getElementById("profile-popover"),p=frontendState.profile;if(!pop)return;
  const name=pop.querySelector("h4");if(name)name.textContent=p.name;
  const texts=pop.querySelectorAll("p");if(texts[0])texts[0].textContent=p.email;if(texts[1])texts[1].textContent=`${p.country||"+90"} ${p.phone}`;
  const plan=pop.querySelector("[data-profile-plan]");if(plan)plan.textContent=`${p.plan} ${uiText("Plan","Plan")}`;
  const joined=pop.querySelector("[data-profile-joined]");if(joined)joined.textContent=p.joined?formatDate(scheduledAtParts(new Date(sdParseTimestamp(p.joined)).toISOString()).date):"";
  ["header-profile-avatar","popover-profile-avatar"].forEach(id=>{
    const avatar=document.getElementById(id);if(!avatar)return;
    avatar.style.backgroundImage=p.photo?`url('${p.photo}')`:"";
    avatar.textContent=p.photo?"":profileInitials(p.name);
  });
  document.querySelectorAll('[data-profile-name]').forEach(el=>el.textContent=frontendState.profile.name);
  document.querySelectorAll('[data-profile-email]').forEach(el=>el.textContent=frontendState.profile.email);
  document.querySelectorAll('[data-profile-phone]').forEach(el=>el.textContent=`${frontendState.profile.country} ${frontendState.profile.phone}`);
}
function initHomePage(){
  if(frontendState.dashboard)return;
  api.dashboard().then(res=>{if(res?.data){frontendState.dashboard=res.data;persistState();if(currentRoute==="home")render();}}).catch(err=>console.error("Dashboard alınamadı:",err));
}
function initGlobalSearch(){
  const input=document.getElementById("global-search"),panel=document.getElementById("global-search-results");if(!input||input.dataset.ready)return;input.dataset.ready="1";
  let activeIndex=-1,requestSequence=0;
  const syncActive=()=>{const options=[...panel.querySelectorAll('[role="option"]')];options.forEach((option,index)=>option.setAttribute("aria-selected",String(index===activeIndex)));const active=options[activeIndex];if(active){input.setAttribute("aria-activedescendant",active.id);active.scrollIntoView({block:"nearest"});}else input.removeAttribute("aria-activedescendant");};
  input.addEventListener("input",async()=>{const q=input.value.trim(),sequence=++requestSequence;activeIndex=-1;if(!q){panel.classList.remove("open");input.setAttribute("aria-expanded","false");return;}panel.innerHTML=`<p class="p-4 text-body-sm text-on-surface-variant">${uiText("Aranıyor…","Searching…")}</p>`;panel.classList.add("open");input.setAttribute("aria-expanded","true");const results=await buildGlobalSearchResults(q);if(sequence!==requestSequence)return;panel.innerHTML=searchResultsHtml(results,`document.getElementById('global-search-results').classList.remove('open')`);syncActive();});
  input.addEventListener("keydown",e=>{const options=[...panel.querySelectorAll('[role="option"]')];if(e.key==="Escape"){panel.classList.remove("open");input.setAttribute("aria-expanded","false");activeIndex=-1;syncActive();}else if(["ArrowDown","ArrowUp","Home","End"].includes(e.key)&&options.length){e.preventDefault();activeIndex=e.key==="Home"?0:e.key==="End"?options.length-1:e.key==="ArrowDown"?(activeIndex+1+options.length)%options.length:(activeIndex-1+options.length)%options.length;syncActive();}else if(e.key==="Enter"&&activeIndex>=0){e.preventDefault();options[activeIndex].click();}});
}
async function buildGlobalSearchResults(query){
  const q=normalizeText(query);
  const pageDefs=[
    ["Ana Sayfa","Home","home"],["İçerik Takvimi","Content Calendar","calendar"],["Medya Kütüphanesi","Media Library","media"],["Yapay Zekâ Asistanı","AI Assistant","ai"],["Güncel Haberler","Latest News","news"],["Ayarlar","Settings","settings"],["Profil","Profile","profile"]
  ];
  const pages=pageDefs.filter(x=>normalizeText(`${x[0]} ${x[1]}`).includes(q)).map(x=>({label:frontendState.settings.language==="en"?x[1]:x[0],sub:uiText("Sayfa","Page"),action:`navigate('${x[2]}')`}));
  const platformPages=platformKeys.filter(key=>normalizeText(platformCatalog[key].label).includes(q)).map(key=>({label:platformCatalog[key].label,sub:uiText("Platform","Platform"),action:`navigate('platform','${key}')`}));
  try{
    const response=await api.search(query);
    const data=response?.data||{};
    const posts=(data.posts||[]).map(post=>({label:post.title||post.content?.slice(0,50)||uiText("Başlıksız gönderi","Untitled post"),sub:uiText("Gönderi","Post"),action:`openPostDetail(${Number(post.id)})`}));
    const media=(data.media||[]).map(item=>({label:item.original_name||uiText("Medya","Media"),sub:item.tag||uiText("Medya","Media"),action:`navigate('media');setTimeout(()=>openMediaDetail(${Number(item.id)}),50)`}));
    const accounts=(data.accounts||[]).map(account=>({label:`${account.account_name||account.username||account.platform}${account.username?` · ${account.username}`:""}`,sub:platformLabel(account.platform),action:`navigate('platform','${account.platform}')`}));
    return [...pages,...platformPages,...posts,...media,...accounts].slice(0,10);
  }catch(err){console.error("Arama yapılamadı:",err);return [...pages,...platformPages].slice(0,10);}
}
function searchResultsHtml(results,afterAction="",idPrefix="global-search-option"){
  return results.length?results.map((result,index)=>`<button type="button" id="${idPrefix}-${index}" role="option" aria-selected="false" class="w-full text-left px-4 py-3 hover:bg-surface-container-low border-b last:border-b-0" data-command="${afterAction};${result.action}"><p class="font-label-md">${escapeHtml(result.label)}</p><p class="text-[11px] text-on-surface-variant">${escapeHtml(result.sub)}</p></button>`).join(""):emptyState(uiText("Sonuç bulunamadı","No results found"));
}
function openPlanDialog(){openDialog(uiText("Planları Karşılaştır","Compare Plans"),`<div class="grid grid-cols-2 gap-3"><div class="p-4 rounded-xl bg-surface-container-low"><h3 class="font-bold">Free</h3><p class="text-body-sm mt-2">${uiText("3 hesap","3 accounts")}<br>${uiText("10 planlı gönderi","10 scheduled posts")}</p></div><div class="p-4 rounded-xl bg-primary-container"><h3 class="font-bold">Premium</h3><p class="text-body-sm mt-2">${uiText("7 hesap","7 accounts")}<br>${uiText("Sınırsız planlama","Unlimited scheduling")}<br>${uiText("Gelişmiş raporlar","Advanced reports")}</p></div></div><p class="text-body-sm text-on-surface-variant mt-4">${uiText(`Mevcut planınız: ${frontendState.profile.plan}. Bu pencere karşılaştırma amaçlıdır.`,`Your current plan: ${frontendState.profile.plan}. This window is for comparison only.`)}</p>`,`<button type="button" class="px-5 py-2.5 bg-primary text-white rounded-xl" data-command="closeDialog()">${uiText("Tamam","OK")}</button>`);}
function openMobileSearch(){
  openDialog("Ara",`<div class="relative"><span aria-hidden="true" class="material-symbols-outlined absolute left-3 top-3 text-on-surface-variant">search</span><label for="mobile-search-input" class="sd-visually-hidden">${uiText("Ara","Search")}</label><input name="mobile-search-input" id="mobile-search-input" role="combobox" aria-autocomplete="list" aria-controls="mobile-search-results" aria-expanded="false" class="w-full pl-11 pr-4 py-3 bg-surface-container-low border-none rounded-xl" placeholder="${uiText("Gönderilerde ve sayfalarda ara","Search posts and pages")}"><div id="mobile-search-results" role="listbox" aria-label="${uiText("Arama sonuçları","Search results")}" class="mt-3 border rounded-xl overflow-hidden"></div></div>`,
    `<button type="button" class="px-5 py-2.5 bg-primary text-white rounded-xl" data-command="closeDialog()">Kapat</button>`);
  const input=document.getElementById("mobile-search-input"),results=document.getElementById("mobile-search-results");
  let activeIndex=-1;
  const syncActive=()=>{const options=[...results.querySelectorAll('[role="option"]')];options.forEach((option,index)=>option.setAttribute("aria-selected",String(index===activeIndex)));const active=options[activeIndex];if(active){input.setAttribute("aria-activedescendant",active.id);active.scrollIntoView({block:"nearest"});}else input.removeAttribute("aria-activedescendant");};
  let requestSequence=0;
  input.addEventListener("input",async()=>{
    const q=input.value.trim(),sequence=++requestSequence;
    if(q)results.innerHTML=`<p class="p-4 text-body-sm text-on-surface-variant">${uiText("Aranıyor…","Searching…")}</p>`;
    const found=q?await buildGlobalSearchResults(q):[];
    if(sequence!==requestSequence)return;
    results.innerHTML=q?searchResultsHtml(found,"closeDialog()","mobile-search-option"):`<p class="p-4 text-body-sm text-on-surface-variant">Aramak için yazmaya başlayın.</p>`;
    activeIndex=-1;input.setAttribute("aria-expanded",String(!!q));syncActive();
  });
  input.addEventListener("keydown",event=>{const options=[...results.querySelectorAll('[role="option"]')];if(["ArrowDown","ArrowUp","Home","End"].includes(event.key)&&options.length){event.preventDefault();activeIndex=event.key==="Home"?0:event.key==="End"?options.length-1:event.key==="ArrowDown"?(activeIndex+1+options.length)%options.length:(activeIndex-1+options.length)%options.length;syncActive();}else if(event.key==="Enter"&&activeIndex>=0){event.preventDefault();options[activeIndex].click();}});
  input.dispatchEvent(new Event("input"));
}

