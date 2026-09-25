function filteredMedia(){
  return frontendState.media.filter(m=>normalizeText(m.name).includes(normalizeText(mediaSearch))&&(mediaType==="all"||normalizeText(m.tag)===normalizeText(mediaType)) &&
    (mediaPlatform==="all"||frontendState.posts.some(p=>(p.mediaIds||[p.mediaId].filter(Boolean)).includes(m.id)&&p.platforms.includes(mediaPlatform))) &&
    (mediaDate==="all"||mediaDate==="today"&&m.dateISO===todayISO()||mediaDate==="last7"&&((new Date(todayISO())-new Date(m.dateISO))/86400000)>=0&&((new Date(todayISO())-new Date(m.dateISO))/86400000)<=7) &&
    (!mediaUnused||!frontendState.posts.some(p=>(p.mediaIds||[p.mediaId].filter(Boolean)).includes(m.id))));
}
function mediaPreviewHtml(media,detail=false){
  if(media.dataUrl){
    if(media.mime?.startsWith("video"))return `<video class="w-full h-full object-cover" src="${media.dataUrl}" ${detail?"controls":""}></video>`;
    return `<img class="w-full h-full object-cover" src="${media.dataUrl}" alt="${escapeHtml(media.name)}">`;
  }
  const visuals={
    1:["linear-gradient(135deg,#6e5e0d,#fd8a42)","campaign","Yaz Kampanyası"],
    2:["linear-gradient(135deg,#fff1eb,#f6b994)","inventory_2","Ürün Çekimi"],
    3:["linear-gradient(135deg,#9b4500,#6e5e0d)","auto_awesome","Hikâye Serisi"],
    4:["linear-gradient(135deg,#776617,#d1c79d)","palette","Soyut Arka Plan"],
    5:["linear-gradient(135deg,#351000,#9b4500)","coffee","Kafe Klibi"],
    6:["linear-gradient(135deg,#fde68a,#fd8a42)","dashboard_customize","SocialDash Logo"]
  };
  const v=visuals[media.id]||["linear-gradient(135deg,#6e5e0d,#9b4500)",media.icon||"image","Medya Önizlemesi"];
  return `<div class="demo-media-thumb w-full h-full flex flex-col items-center justify-center text-center p-4" style="background:${v[0]}"><span class="material-symbols-outlined">${v[1]}</span><span class="font-label-md mt-2">${escapeHtml(v[2])}</span><span class="text-[11px] opacity-80 mt-1">${escapeHtml(media.tag||"MEDYA")}</span></div>`;
}
renderMedia=function(){
  const list=filteredMedia();
  return `<div class="space-y-lg relative"><div><h2 class="font-headline-lg text-headline-lg">Medya Kütüphanesi</h2><p class="text-on-surface-variant mt-1">Platform üzerinden yüklediğiniz tüm medya dosyalarını görüntüleyin, filtreleyin ve gönderilerinizde tekrar kullanın.</p></div>
    <section class="bg-white/40 border border-primary-container/20 rounded-2xl p-6 shadow-sm"><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
      <div><label for="media-search" class="text-label-sm font-semibold text-on-surface-variant">${uiText("Arama","Search")}</label><input name="media-search" id="media-search" value="${escapeHtml(mediaSearch)}" class="w-full mt-2 bg-surface-container-lowest border-none rounded-xl" placeholder="${uiText("Medya ara","Search media")}"></div>
      <div><label for="media-type" class="text-label-sm font-semibold text-on-surface-variant">${uiText("Tür","Type")}</label><select name="media-type" id="media-type" class="clean-select w-full mt-2 bg-surface-container-lowest border-none rounded-xl"><option value="all">${uiText("Tümü","All")}</option><option value="FOTOĞRAF">${uiText("FOTOĞRAF","PHOTO")}</option><option value="VIDEO">VIDEO</option><option value="GIF">GIF</option></select></div>
      <div><label for="media-platform" class="text-label-sm font-semibold text-on-surface-variant">${uiText("Platform","Platform")}</label><select name="media-platform" id="media-platform" class="clean-select w-full mt-2 bg-surface-container-lowest border-none rounded-xl"><option value="all">${uiText("Tümü","All")}</option>${["Instagram","Facebook","X","LinkedIn","TikTok","YouTube","Threads"].map(x=>`<option value="${x}">${x}</option>`).join("")}</select></div>
      <div><label for="media-date" class="text-label-sm font-semibold text-on-surface-variant">${uiText("Tarih","Date")}</label><select name="media-date" id="media-date" class="clean-select w-full mt-2 bg-surface-container-lowest border-none rounded-xl"><option value="all">${uiText("Tümü","All")}</option><option value="today">${uiText("Bugün","Today")}</option><option value="last7">${uiText("Son 7 Gün","Last 7 Days")}</option></select></div>
      <label class="flex items-center gap-2 pb-3 text-label-sm"><input name="media-unused" type="checkbox" id="media-unused" ${mediaUnused?"checked":""}> Kullanılmayanlar</label>
    </div></section>
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-md">${list.length?list.map(c=>`<button type="button" class="group bg-surface-container-lowest rounded-xl overflow-hidden border border-primary-container/20 shadow-sm hover:shadow-md text-left" data-command="openMediaDetail(${c.id})"><div class="h-40 bg-surface-container-low flex items-center justify-center overflow-hidden">${mediaPreviewHtml(c)}</div><div class="p-4"><h3 class="font-label-md truncate">${escapeHtml(c.name)}</h3><span class="text-[12px] text-on-surface-variant">${escapeHtml(c.size)} • ${escapeHtml(formatDate(c.dateISO||todayISO(),true))}</span></div></button>`).join(""):emptyState("Bu filtrelere uygun medya bulunamadı")}</div></div>
    <div class="fixed inset-0 bg-on-background/30 backdrop-blur-sm z-[70] hidden" id="media-detail-backdrop" data-command="closeMediaDetail()"></div>
    <aside aria-label="${uiText("Medya detayı","Media details")}" aria-hidden="true" inert role="dialog" aria-modal="true" class="preview-drawer fixed top-0 right-0 h-full w-full sm:w-[380px] bg-surface-container-lowest shadow-2xl z-[75] flex flex-col" id="media-detail-drawer"><header class="px-md py-4 flex items-center justify-between border-b"><span class="font-label-md">${uiText("Medya Detayı","Media Details")}</span><button type="button" aria-label="${uiText("Medya detayını kapat","Close media details")}" data-command="closeMediaDetail()"><span aria-hidden="true" class="material-symbols-outlined">close</span></button></header><div class="flex-grow overflow-y-auto p-md space-y-md" id="media-detail-body" tabindex="0"></div><footer class="p-md border-t grid grid-cols-3 gap-2"><button type="button" class="py-2 rounded-xl bg-primary text-white" data-command="closeMediaDetail();openCompose({mediaId:currentMediaId})">${uiText("Kullan","Use")}</button><button type="button" class="py-2 rounded-xl bg-surface-container" data-command="downloadMedia(currentMediaId)">${uiText("İndir","Download")}</button><button type="button" class="py-2 rounded-xl bg-error-container text-error" data-command="deleteMedia()">${uiText("Sil","Delete")}</button></footer></aside>`;
};
function initMediaPage(){
  const q=document.getElementById("media-search");if(!q)return;
  document.getElementById("media-type").value=mediaType;document.getElementById("media-platform").value=mediaPlatform;document.getElementById("media-date").value=mediaDate;
  q.addEventListener("input",event=>{mediaSearch=event.target.value;render();const next=document.getElementById("media-search");next?.focus();next?.setSelectionRange(mediaSearch.length,mediaSearch.length);});
  document.getElementById("media-type").addEventListener("change",event=>{mediaType=event.target.value;render();});
  document.getElementById("media-platform").addEventListener("change",event=>{mediaPlatform=event.target.value;render();});
  document.getElementById("media-date").addEventListener("change",event=>{mediaDate=event.target.value;render();});
  document.getElementById("media-unused").addEventListener("change",event=>{mediaUnused=event.target.checked;render();});
}
openMediaDetail=function(id){
  rememberFocus("media");
  currentMediaId=id;const m=frontendState.media.find(x=>x.id===id);if(!m)return;
  const uses=frontendState.posts.filter(p=>(p.mediaIds||[p.mediaId].filter(Boolean)).includes(id));
  document.getElementById("media-detail-body").innerHTML=`<div class="h-48 bg-surface-container-low rounded-2xl flex items-center justify-center overflow-hidden">${mediaPreviewHtml(m,true)}</div>
    <div><h3 class="font-label-md break-all">${escapeHtml(m.name)}</h3><button type="button" class="text-primary text-label-sm mt-1" data-command="renameMedia(${m.id})">Dosya adını değiştir</button></div>
    <div class="grid grid-cols-2 gap-3 text-[12px]"><div class="p-3 bg-surface-container-low rounded-xl"><small>Yüklenme Tarihi</small><p class="font-bold">${escapeHtml(formatDate(m.dateISO||todayISO(),true))}</p></div><div class="p-3 bg-surface-container-low rounded-xl"><small>Boyut</small><p class="font-bold">${escapeHtml(m.size)}</p></div></div>
    <div><p class="text-label-sm uppercase mb-2">Kullanıldığı Gönderiler</p>${uses.length?uses.map(p=>`<button type="button" class="w-full text-left px-3 py-2 bg-surface-container-low rounded-lg mb-2" data-command="closeMediaDetail();openPostDetail(${p.id})">${escapeHtml(p.title)}</button>`).join(""):emptyState("Henüz kullanılmadı")}</div>`;
  const drawer=document.getElementById("media-detail-drawer");
  document.getElementById("media-detail-backdrop").classList.remove("hidden");
  drawer.classList.add("active");
  drawer.inert=false;
  drawer.setAttribute("aria-hidden","false");
  syncOverlayInertState();
  lockBodyScroll();setTimeout(()=>drawer.querySelector("button")?.focus(),0);
};
function renameMedia(id){
  const m=frontendState.media.find(x=>x.id===id);if(!m)return;
  openDialog(
    uiText("Dosya Adını Değiştir","Rename File"),
    `<label for="rename-media-input" class="block text-label-sm font-semibold mb-2">${uiText("Yeni dosya adı","New file name")}</label><input name="rename-media-input" id="rename-media-input" class="w-full rounded-xl bg-surface-container-low border border-outline-variant/20 px-4 py-3" value="${escapeHtml(m.name)}" maxlength="120" aria-describedby="rename-media-error"><p class="field-error" id="rename-media-error"></p>`,
    `<button type="button" class="px-5 py-2.5 rounded-xl bg-surface-container" data-command="closeDialog()">${uiText("Vazgeç","Cancel")}</button><button type="button" class="px-5 py-2.5 rounded-xl bg-primary text-white" data-command="saveMediaRename(${id})">${uiText("Kaydet","Save")}</button>`
  );
}
async function saveMediaRename(id){
  const m=frontendState.media.find(x=>x.id===id),input=document.getElementById("rename-media-input");if(!m||!input)return;
  const value=input.value.trim();
  if(!value){document.getElementById("rename-media-error").textContent=uiText("Dosya adı boş bırakılamaz.","File name cannot be empty.");input.setAttribute("aria-invalid","true");input.focus();return;}
  try{const res=await api.media.rename(id,value.slice(0,120));m.name=res?.data?.name||value.slice(0,120);persistState();closeDialog();openMediaDetail(id);showToast(uiText("Dosya adı güncellendi","File name updated"));}
  catch(err){document.getElementById("rename-media-error").textContent=err?.data?.message||uiText("Dosya adı kaydedilemedi.","The file name could not be saved.");}
}
async function downloadMedia(id){
  const m=frontendState.media.find(x=>x.id===id);if(!m)return;
  const data=m.dataUrl||await getMediaAsset(id);
  if(!data){showToast(uiText("Bu medya dosyasının indirilebilir verisi bulunmuyor.","No downloadable data is available for this media file."));return;}
  const a=document.createElement("a");a.download=m.name;a.href=data;document.body.appendChild(a);a.click();a.remove();showToast(uiText("İndirme başlatıldı","Download started"));
}
deleteMedia=function(){
  const i=frontendState.media.findIndex(x=>x.id===currentMediaId);if(i<0)return;const removed=frontendState.media[i];
  const affectedPosts=frontendState.posts.filter(post=>(post.mediaIds||[post.mediaId].filter(Boolean)).includes(removed.id)).map(post=>post.id);
  confirmAction(uiText("Medyayı Sil","Delete Media"),uiText("Medya kütüphaneden kaldırılacak. Gönderilerdeki kullanımı korunur.","Media will be removed from the library. Existing posts keep their attachment."),uiText("Sil","Delete"),async()=>{
    try{await api.media.remove(removed.id);}catch(err){showToast(err?.data?.message||uiText("Medya silinemedi.","The media could not be deleted."));return;}
    frontendState.media.splice(i,1);removeMediaAsset(removed.id);

    persistState();closeDialog();closeMediaDetail();render();
    showUndoToast(uiText("Medya silindi","Media deleted"),async()=>{
      try{await api.media.restore(removed.id);await hydrateFromBackend();render();showToast(uiText("Medya geri alındı","Media restored"));}catch(error){showToast(error.message);}
    });
  });
};

/* ---------- Shared connected-account state and platform pages ---------- */
let platformRange="Son 7 Gün";

