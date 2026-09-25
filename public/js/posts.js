function selectedComposePlatforms(){
  return [...document.querySelectorAll("#selected-chips > [data-platform-name]")].map(x=>x.dataset.platformName);
}
function resetCompose(){
  document.getElementById("selected-chips").innerHTML="";
  document.getElementById("platform-btn-text").classList.remove("hidden");
  document.getElementById("post-text").value="";
  document.getElementById("post-date").value="";
  document.getElementById("post-time").value="";
  document.querySelectorAll(".compose-hashtag").forEach(b=>b.classList.remove("hashtag-selected"));
  releaseComposePreview();composeFileData=null;composeFilesData=[];composePrefillMediaId=null;composePrefillMediaIds=[];composeEditingPostId=null;
  composeAccountSelections={};composeAdvancedState={};composeDirty=false;
  const preview=document.getElementById("compose-media-preview");
  preview.classList.add("hidden");preview.classList.remove("flex");preview.innerHTML="";
  document.getElementById("compose-file-prompt").classList.remove("hidden");
  document.querySelector("#compose-dropzone .media-remove-btn")?.remove();
  const previewDrawer=document.getElementById("preview-drawer");
  previewDrawer.classList.remove("active");
  previewDrawer.inert=true;
  previewDrawer.setAttribute("aria-hidden","true");
  ["compose-platform-error","compose-media-error","compose-date-error","compose-time-error"].forEach(id=>document.getElementById(id).textContent="");
  ["platform-dropdown-trigger","post-text","post-date","post-time"].forEach(id=>document.getElementById(id)?.removeAttribute("aria-invalid"));
  updateCharCount();renderAdvancedSettings();
}
function releaseComposePreview(){
  composeFilesData.forEach(item=>{if(item.previewUrl?.startsWith("blob:"))URL.revokeObjectURL(item.previewUrl);});
}
function clearComposeMedia(){
  releaseComposePreview();composeFileData=null;composeFilesData=[];composePrefillMediaId=null;composePrefillMediaIds=[];
  const preview=document.getElementById("compose-media-preview"),zone=document.getElementById("compose-dropzone");
  if(preview){preview.innerHTML="";preview.classList.add("hidden");preview.classList.remove("flex");}
  document.getElementById("compose-file-prompt")?.classList.remove("hidden");
  zone?.classList.remove("drop-loaded");
  zone?.querySelector(".media-remove-btn")?.remove();
  const input=document.getElementById("compose-file");if(input)input.value="";
  composeDirty=true;updateComposePreview();
}
function ensureComposeRemoveButton(){
  const zone=document.getElementById("compose-dropzone");if(!zone||zone.querySelector(".media-remove-btn"))return;
  const button=document.createElement("button");button.type="button";button.className="media-remove-btn";button.setAttribute("aria-label",uiText("Seçili medyayı kaldır","Remove selected media"));button.innerHTML='<span class="material-symbols-outlined text-[18px]">close</span>';
  button.addEventListener("click",event=>{event.stopPropagation();clearComposeMedia();});zone.appendChild(button);zone.classList.add("drop-loaded");
}
openCompose=function(prefill={}){
  rememberFocus("compose");
  closeAllDropdowns();
  resetCompose();
  const min=todayISO(); document.getElementById("post-date").min=min;
  const savedDraft=frontendState.settings.autoDraft&&!prefill.editId&&!prefill.text&&!prefill.mediaId&&!prefill.mediaIds?.length?localStorage.getItem("socialdash_compose_draft"):"";
  composeEditingPostId=prefill.editId||null;
  document.getElementById("post-text").value="";
  composeAccountSelections=cloneData(prefill.accountIds||{});
  composeAdvancedState=cloneData(prefill.advancedSettings||{});
  if(prefill.text||savedDraft) document.getElementById("post-text").value=prefill.text||savedDraft;
  (prefill.mediaIds?.length?prefill.mediaIds:[prefill.mediaId].filter(Boolean)).forEach((id,index)=>useMediaInCompose(id,false,index>0));
  (prefill.platforms||[prefill.platform].filter(Boolean)).forEach(platform=>selectPlatform(platform,false));
  if(prefill.date)document.getElementById("post-date").value=prefill.date;
  if(prefill.time)document.getElementById("post-time").value=prefill.time;
  const title=document.querySelector("#compose-modal header h2");
  if(title)title.textContent=composeEditingPostId?"Gönderiyi Düzenle":"Yeni Gönderi Oluştur";
  const submit=document.querySelector("#compose-modal footer button:last-child");
  if(submit)submit.textContent=composeEditingPostId?"Güncelle":"Bitti";
  updateCharCount();updateComposePreview();
  document.getElementById("compose-modal").inert=false;
  document.getElementById("compose-modal").classList.add("active");
  document.getElementById("compose-modal").setAttribute("aria-hidden","false");
  syncOverlayInertState();
  lockBodyScroll();
  applyInterfaceLanguage();
  document.getElementById("post-text").focus();
};
closeCompose=function(force=false){
  const hasData=composeDirty || document.getElementById("post-text")?.value.trim() || selectedComposePlatforms().length || composeFileData;
  if(!force && hasData){
    confirmAction("Gönderi penceresini kapat","Kaydedilmemiş bilgiler silinecek.","Yine de Kapat",()=>{closeDialog();closeCompose(true);});
    return;
  }
  document.getElementById("compose-modal").classList.remove("active");
  document.getElementById("compose-modal").setAttribute("aria-hidden","true");
  document.getElementById("compose-modal").inert=true;
  const previewDrawer=document.getElementById("preview-drawer");
  previewDrawer.classList.remove("active");
  previewDrawer.inert=true;
  previewDrawer.setAttribute("aria-hidden","true");
  sdFocusOrigins.delete("preview");
  syncOverlayInertState();
  unlockBodyScroll();restoreFocus("compose");
};

checkChips=function(){ document.getElementById("platform-btn-text").classList.toggle("hidden",selectedComposePlatforms().length>0); };
const charLimits={Instagram:2200,Facebook:63206,X:280,LinkedIn:3000,TikTok:2200,YouTube:5000,Threads:500};
updateCharCount=function(){
  const text=document.getElementById("post-text").value, selected=selectedComposePlatforms();
  const limit=Math.min(...(selected.length?selected.map(p=>charLimits[p]||2200):[2200]));
  const label=selected.length===1?selected[0]:uiText("En düşük sınır","Lowest limit");
  const counter=document.getElementById("char-counter");
  counter.textContent=`${label} ${text.length}/${limit}`;
  counter.classList.toggle("text-error",text.length>limit);
  composeDirty=composeDirty||text.length>0;
  if(frontendState.settings.autoDraft){if(text)localStorage.setItem("socialdash_compose_draft",text);else localStorage.removeItem("socialdash_compose_draft");}
  updateComposePreview();
};
addHashtag=function(tag,button){
  const ta=document.getElementById("post-text"), token=new RegExp(`(^|\\s)${tag.replace("#","\\#")}(?=\\s|$)`,"g");
  if(token.test(ta.value)){ ta.value=ta.value.replace(token," ").replace(/\s+/g," ").trim();button?.classList.remove("hashtag-selected"); }
  else{ ta.value+=(ta.value.trim()?" ":"")+tag;button?.classList.add("hashtag-selected"); }
  composeDirty=true;updateCharCount();
};
function setComposeAccount(platformKey,accountId){composeAccountSelections[platformKey]=accountId;composeDirty=true;updateComposePreview();}
function toggleFrontendSwitch(button){
  const on=button.dataset.on!=="true",key=button.dataset.settingKey;
  button.dataset.on=String(on);if(key)composeAdvancedState[key]=on;
  button.setAttribute("aria-pressed",String(on));
  button.className=`w-12 h-6 rounded-full relative cursor-pointer transition-colors ${on?"bg-primary":"bg-outline-variant/30"}`;
  button.firstElementChild.className=`absolute ${on?"right-1":"left-1"} top-1 w-4 h-4 bg-white rounded-full transition-all`;composeDirty=true;
}
function renderAdvancedSettings(){
  const selected=selectedComposePlatforms();
  const options=[];
  if(selected.some(x=>["Instagram","Facebook"].includes(x))) options.push(["hideLikes","Beğeni sayılarını gizle"],["disableComments","Yorumları kapat"]);
  if(selected.includes("Instagram")) options.push(["crossPostFacebook","Facebook'a otomatik çapraz paylaş"]);
  if(selected.includes("YouTube")) options.push(["madeForKids","Çocuklara özel içerik olarak işaretle"]);
  if(selected.some(x=>["X","Threads"].includes(x))) options.push(["followersOnlyReplies","Yanıtları takipçilerle sınırla"]);
  const accountRows=selected.map(label=>{
    const key=platformKeyFromLabel(label),profiles=connectedProfiles(key);
    if(!profiles.length)return `<div class="rounded-xl border border-error/20 bg-error-container/10 p-3"><p class="text-label-sm font-semibold text-error">${escapeHtml(label)} · ${uiText("Bağlı hesap yok","No connected account")}</p><button type="button" class="mt-2 text-label-sm font-bold text-primary" data-command="activeSettingsTab='hesaplar';closeCompose(true);navigate('settings')">${uiText("Hesap bağla","Connect account")}</button></div>`;
    if(!composeAccountSelections[key]||!profiles.some(x=>String(x.id)===String(composeAccountSelections[key])))composeAccountSelections[key]=selectedPlatformAccount(key)?.id||"";
    return `<label class="block"><span class="text-label-sm font-semibold">${escapeHtml(label)} hesabı</span><select name="compose-account-${key}" class="clean-select w-full mt-1 rounded-xl bg-surface-container-low border-none" data-change-command="setComposeAccount('${key}',this.value)">${profiles.map(account=>`<option value="${escapeHtml(account.id)}" ${String(account.id)===String(composeAccountSelections[key])?"selected":""}>${escapeHtml(account.name)} · ${escapeHtml(account.handle)}</option>`).join("")}</select></label>`;
  }).join("");
  const optionRows=options.map(([key,label])=>{const on=!!composeAdvancedState[key];return `<div class="flex items-center justify-between"><span class="text-body-md text-on-surface">${escapeHtml(label)}</span><button type="button" aria-label="${escapeHtml(label)}" aria-pressed="${on}" data-setting-key="${key}" data-on="${on}" class="w-12 h-6 ${on?"bg-primary":"bg-outline-variant/30"} rounded-full relative cursor-pointer" data-command="toggleFrontendSwitch(this)"><span class="absolute ${on?"right-1":"left-1"} top-1 w-4 h-4 bg-white rounded-full"></span></button></div>`;}).join("");
  document.getElementById("advanced-settings").innerHTML=selected.length?`<div class="grid grid-cols-1 md:grid-cols-2 gap-3 pb-4 border-b border-outline-variant/20">${accountRows}</div>${optionRows||`<p class="text-body-sm text-on-surface-variant">Bu platform için ek ayar bulunmuyor.</p>`}`:`<p class="text-body-sm text-on-surface-variant">Platform seçildiğinde hesap ve ilgili ayarlar burada gösterilir.</p>`;
}
function updateComposePreview(){
  const text=document.getElementById("post-text")?.value || "";
  const card=document.querySelector("#preview-drawer .aspect-\\[4\\/5\\]");
  if(!card) return;
  const mediaUrl=composeFilesData[0]?.previewUrl||composeFilesData[0]?.dataUrl||"";
  const media=mediaUrl ? (composeFileData.type.startsWith("video")?`<video class="w-full h-full object-cover" src="${escapeHtml(mediaUrl)}" controls></video>`:`<img class="w-full h-full object-cover" src="${escapeHtml(mediaUrl)}" alt="${uiText("Gönderi önizlemesi","Post preview")}">`) : `<span class="material-symbols-outlined text-on-surface-variant/20 text-[48px]">image</span>`;
  card.innerHTML=`<div class="p-3 border-b border-outline-variant/5 flex items-center gap-2"><div class="w-8 h-8 rounded-full bg-primary-container"></div><strong class="text-[12px]">${escapeHtml(frontendState.profile.username)}</strong></div>
    <div class="flex-grow bg-surface-container-low/50 flex items-center justify-center overflow-hidden">${media}</div>
    <p class="p-4 text-[12px] whitespace-pre-wrap break-words">${escapeHtml(text)||"Açıklama önizlemesi"}</p>`;
  const analysis=document.querySelector("#preview-drawer .bg-primary-container\\/20 p:last-child");
  if(analysis) analysis.textContent=text.length<40?"Metin kısa; ana mesajı biraz daha açıklayabilirsiniz.":text.length>220?"Metin uzun; X için kısaltmanız gerekebilir.":"Metin uzunluğu seçilen platformlar için dengeli görünüyor.";
}
function renderComposeMediaSelection(){const box=document.getElementById("compose-media-preview");box.className="w-full min-h-44 rounded-xl overflow-hidden bg-surface-container grid gap-2 p-2";box.style.gridTemplateColumns=`repeat(${Math.min(composeFilesData.length,3)},minmax(0,1fr))`;box.innerHTML=composeFilesData.map(item=>{const url=item.previewUrl||item.dataUrl||"";return url?(item.type.startsWith("video")?`<video class="w-full h-36 object-cover rounded-lg" src="${escapeHtml(url)}" controls></video>`:`<img class="w-full h-36 object-cover rounded-lg" src="${escapeHtml(url)}" alt="${escapeHtml(item.name)}">`):`<div class="h-36 flex items-center justify-center"><span class="material-symbols-outlined">image</span></div>`;}).join("");box.classList.remove("hidden");document.getElementById("compose-file-prompt").classList.add("hidden");composeFileData=composeFilesData[0]||null;ensureComposeRemoveButton();updateComposePreview();}
function processComposeFile(file){
  const allowed=["image/jpeg","image/png","image/gif","video/mp4","video/quicktime"];
  if(!allowed.includes(file.type)){document.getElementById("compose-media-error").textContent=uiText("Desteklenmeyen dosya türü.","Unsupported file type.");return;}
  if(file.size>25*1024*1024){document.getElementById("compose-media-error").textContent=uiText("Dosya 25 MB'den küçük olmalı.","File must be smaller than 25 MB.");return;}
  if(composeFilesData.length>=10){document.getElementById("compose-media-error").textContent=uiText("En fazla 10 medya seçilebilir.","You can select up to 10 files.");return;}
  const previewUrl=URL.createObjectURL(file);
  composeFilesData.push({name:file.name,type:file.type,size:file.size,file,previewUrl});document.getElementById("compose-media-error").textContent="";composeDirty=true;renderComposeMediaSelection();
}
function initComposeUpload(){
  const input=document.getElementById("compose-file"),zone=document.getElementById("compose-dropzone");
  zone.addEventListener("click",()=>input.click());
  zone.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();input.click();}});
  input.addEventListener("change",()=>Array.from(input.files).forEach(processComposeFile));
  ["dragenter","dragover"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add("drop-active");}));
  ["dragleave","drop"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove("drop-active");}));
  zone.addEventListener("drop",e=>Array.from(e.dataTransfer.files).forEach(processComposeFile));
}
function useMediaInCompose(id,open=true,append=false){
  const m=frontendState.media.find(x=>x.id===id);if(!m)return;
  if(!append){composeFilesData=[];composePrefillMediaIds=[];}composePrefillMediaIds.push(id);composePrefillMediaId=composePrefillMediaIds[0];composeFilesData.push({id,name:m.name,type:m.mime||(m.tag==="VIDEO"?"video/mp4":"image/jpeg"),size:m.bytes||0,dataUrl:m.dataUrl||""});composeDirty=true;renderComposeMediaSelection();
  if(open) openCompose({mediaId:id});
}
const mediaDbPromise=(()=>{
  if(!("indexedDB" in window))return Promise.resolve(null);
  return new Promise(resolve=>{
    const request=indexedDB.open("socialdash_media_v1",1);
    request.onupgradeneeded=()=>request.result.createObjectStore("assets");
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>resolve(null);
  });
})();
async function saveMediaAsset(id,dataUrl){
  if(!dataUrl)return true;
  const db=await mediaDbPromise;if(!db)return false;
  return new Promise(resolve=>{
    const tx=db.transaction("assets","readwrite");
    tx.objectStore("assets").put(dataUrl,String(id));
    tx.oncomplete=()=>resolve(true);
    tx.onerror=tx.onabort=()=>resolve(false);
  });
}
async function getMediaAsset(id){
  const db=await mediaDbPromise;if(!db)return "";
  return new Promise(resolve=>{const request=db.transaction("assets").objectStore("assets").get(String(id));request.onsuccess=()=>resolve(request.result||"");request.onerror=()=>resolve("");});
}
async function removeMediaAsset(id){
  const db=await mediaDbPromise;if(!db)return;
  await new Promise(resolve=>{const tx=db.transaction("assets","readwrite");tx.objectStore("assets").delete(String(id));tx.oncomplete=tx.onerror=()=>resolve();});
}
async function hydrateMediaAssets(){
  const routeAtStart=currentRoute;
  await Promise.all(frontendState.media.map(async media=>{if(!media.dataUrl)media.dataUrl=await getMediaAsset(media.id);}));
  if(frontendState.auth.sessionActive&&currentRoute===routeAtStart&&["media","home"].includes(currentRoute))render();
}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>reject(reader.error||new Error("FileReader"));reader.readAsDataURL(file);});}
function setComposeBusy(busy){
  document.querySelectorAll("#compose-modal footer button").forEach(button=>button.disabled=busy);
  const submit=document.querySelector("#compose-modal footer button:last-child");
  if(submit){if(busy){submit.dataset.label=submit.textContent;submit.textContent=uiText("İşleniyor…","Processing…");}else if(submit.dataset.label){submit.textContent=submit.dataset.label;delete submit.dataset.label;}}
}
async function saveCompose(status){
  if(document.querySelector("#compose-modal footer button:disabled"))return false;
  status=normalizePostStatus(status);
  const platforms=selectedComposePlatforms(),text=document.getElementById("post-text").value.trim(),date=document.getElementById("post-date").value,time=document.getElementById("post-time").value;
  document.getElementById("compose-platform-error").textContent=platforms.length?"":uiText("En az bir platform seçin.","Select at least one platform.");
  document.getElementById("compose-date-error").textContent=status==="scheduled"&&!date?uiText("Planlama tarihi seçin.","Select a scheduling date."):"";
  document.getElementById("compose-time-error").textContent=status==="scheduled"&&!time?uiText("Planlama saati seçin.","Select a scheduling time."):"";
  document.getElementById("platform-dropdown-trigger").setAttribute("aria-invalid",String(!platforms.length));
  document.getElementById("post-text").setAttribute("aria-invalid",String(!text));
  document.getElementById("post-date").setAttribute("aria-invalid",String(status==="scheduled"&&!date));
  document.getElementById("post-time").setAttribute("aria-invalid",String(status==="scheduled"&&!time));
  if(!platforms.length||!text||(status==="scheduled"&&(!date||!time))){if(!text)showToast(uiText("Açıklama alanı boş bırakılamaz","Caption cannot be empty"));return false;}
  if(status==="scheduled" && date && scheduledDateTime(date,time||"23:59")<new Date()){document.getElementById("compose-date-error").textContent=uiText("Geçmiş tarih ve saat seçilemez.","Past dates and times cannot be selected.");document.getElementById("post-date").setAttribute("aria-invalid","true");return false;}
  const limit=Math.min(...platforms.map(p=>charLimits[p]||2200));if(text.length>limit){showToast(uiText("Metin seçilen platform sınırını aşıyor","Text exceeds the selected platform limit"));return false;}
  const missingAccount=status==="scheduled"&&platforms.find(label=>!composeAccountSelections[platformKeyFromLabel(label)]);
  if(missingAccount){document.getElementById("compose-platform-error").textContent=frontendState.settings.language==="en"?`Select a publishing account for ${missingAccount}.`:`${missingAccount} için paylaşım hesabı seçin.`;document.getElementById("platform-dropdown-trigger").setAttribute("aria-invalid","true");return false;}
  const mediaLimits={Instagram:10,Facebook:1,X:4,LinkedIn:20,TikTok:1,YouTube:1,Threads:10};
  const overLimit=platforms.find(label=>composeFilesData.length>(mediaLimits[label]||1));if(overLimit){document.getElementById("compose-media-error").textContent=`${overLimit} en fazla ${mediaLimits[overLimit]} medya kabul ediyor.`;return false;}
  const videoCount=composeFilesData.filter(item=>item.type.startsWith("video/")).length;
  const invalidMix=composeFilesData.length>1&&videoCount&&platforms.find(label=>["Facebook","X","LinkedIn","TikTok","YouTube"].includes(label));if(invalidMix){document.getElementById("compose-media-error").textContent=`${invalidMix} çoklu gönderide video ile diğer medyaları karıştırmıyor.`;return false;}
  setComposeBusy(true);
  const mediaIds=[];
  try{for(const item of composeFilesData){if(item.id){mediaIds.push(Number(item.id));continue;}if(!item.file)continue;const mediaData=item.dataUrl||await fileToDataUrl(item.file);const formData=new FormData();formData.append("file",item.file);const uploadRes=await api.media.upload(formData);if(!uploadRes?.data?.id)throw new Error("Sunucu medya kimliği döndürmedi.");const serverId=Number(uploadRes.data.id);item.id=serverId;mediaIds.push(serverId);await saveMediaAsset(serverId,mediaData);frontendState.media.unshift({id:serverId,name:item.name,tag:item.type.startsWith("video")?"VIDEO":"FOTOĞRAF",icon:item.type.startsWith("video")?"movie":"image",size:`${(item.size/1024/1024).toFixed(1)} MB`,dateISO:todayISO(),dims:"Yüklenen dosya",uses:[],mime:item.type,bytes:item.size,dataUrl:mediaData});}}
  catch(uploadErr){console.error("Medya sunucuya yüklenemedi:",uploadErr);setComposeBusy(false);showToast(uploadErr?.data?.message||uploadErr.message||uiText("Medya sunucuya yüklenemedi. Gönderi oluşturulmadı.","Media could not be uploaded. The post was not created."));return false;}
  const mediaId=mediaIds[0]||null;
  const existing=composeEditingPostId?frontendState.posts.find(x=>x.id===composeEditingPostId):null;
  if(existing?.mediaId&&existing.mediaId!==mediaId){const oldMedia=frontendState.media.find(item=>item.id===existing.mediaId);if(oldMedia)oldMedia.uses=oldMedia.uses.filter(postId=>postId!==existing.id);}
  const accountIds=Object.fromEntries(platforms.map(label=>{const key=platformKeyFromLabel(label);return [key,composeAccountSelections[key]];}).filter(([,id])=>id));
  const post={id:existing?.id||Date.now()+1,title:text.slice(0,52)+(text.length>52?"…":""),text,platforms,date:date||todayISO(),time:time||"09:00",status,mediaId,mediaIds,accountIds,advancedSettings:cloneData(composeAdvancedState)};

  let backendSaved=false;
  try{
    const numericMediaId=typeof mediaId==="number"&&mediaId<100000000000?mediaId:null;
    const scheduledAt=status==="scheduled"&&date?scheduledDateTime(date,time||"00:00").toISOString():null;
    const body={title:post.title,content:text,platforms,accountIds,advancedSettings:post.advancedSettings,status,scheduledAt,mediaId:numericMediaId,mediaIds:mediaIds.filter(id=>Number.isInteger(id))};
    const isRealBackendId=existing&&Number.isInteger(existing.id)&&existing.id<100000000000;
    const apiRes=isRealBackendId?await api.posts.update(existing.id,body):await api.posts.create(body);
    if(apiRes?.data?.id){post.id=apiRes.data.id;post.scheduledAt=apiRes.data.scheduledAt||scheduledAt;post.publications=apiRes.data.publications||[];backendSaved=true;}
  }catch(apiErr){console.error("Gönderi sunucuya kaydedilemedi:",apiErr);setComposeBusy(false);showToast(apiErr?.data?.message||uiText("Gönderi sunucuya kaydedilemedi.","The post could not be saved to the server."));return false;}

  if(existing){frontendState.posts=frontendState.posts.filter(x=>x.id!==existing.id);frontendState.posts.unshift(post);}
  else frontendState.posts.unshift(post);
  mediaIds.forEach(id=>{const m=frontendState.media.find(x=>x.id===id);if(m&&!m.uses.includes(post.id))m.uses.unshift(post.id);});
  logActivity(status==="draft"?"draft":"check_circle",existing?uiText("Gönderi güncellendi","Post updated"):status==="draft"?uiText("Taslak kaydedildi","Draft saved"):uiText("Gönderi planlandı","Post scheduled"),post.title);
  persistState();
  localStorage.removeItem("socialdash_compose_draft");composeDirty=false;releaseComposePreview();composeFileData=null;composeFilesData=[];setComposeBusy(false);closeCompose(true);
  const savedMsg=existing?uiText("Gönderi güncellendi","Post updated"):status==="draft"?uiText("Taslak kaydedildi","Draft saved"):uiText("Gönderi planlandı","Post scheduled");
  showToast(backendSaved?savedMsg:`${savedMsg} ${uiText("(sunucuya kaydedilemedi, yalnızca bu cihazda)","(not saved to server, local only)")}`);
  if(currentRoute==="calendar"||currentRoute==="media"||currentRoute==="home")render();
  return true;
}
publishToast=function(){saveCompose("scheduled");};

/* ---------- Calendar, post detail and cross-page post state ---------- */

function openComposeMediaLibrary(){
  openDialog(uiText("Medya Seç","Choose Media"),frontendState.media.length?`<div class="grid grid-cols-2 gap-3">${frontendState.media.map(m=>`<button type="button" class="p-3 border rounded-xl text-left" data-command="chooseComposeMedia(${m.id})">${mediaPreviewHtml(m)}<span class="block break-words">${escapeHtml(m.name)}</span></button>`).join("")}</div>`:emptyState(uiText("Henüz medya yok","No media yet")));
}
function chooseComposeMedia(id){if(!composeFilesData.some(m=>m.id===id))useMediaInCompose(id,false,true);closeDialog();}
