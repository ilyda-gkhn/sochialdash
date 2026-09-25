let platformCustomRange=null;
function setPlatformRange(value){
  if(value==="Özel Tarih"){
    openDialog(uiText("Özel Tarih","Custom Range"),`<label>${uiText("Başlangıç","Start")}<input id="range-from" type="date" class="w-full rounded-xl" value="${platformCustomRange?.from||todayISO()}"></label><label>${uiText("Bitiş","End")}<input id="range-to" type="date" class="w-full rounded-xl" value="${platformCustomRange?.to||todayISO()}"></label><p id="range-error" class="field-error"></p>`,`<button type="button" class="px-4 py-2 rounded-xl bg-primary text-white" data-command="savePlatformRange()">${uiText("Uygula","Apply")}</button>`);return;
  }
  platformRange=value;render();
}
function savePlatformRange(){
  const from=document.getElementById("range-from").value,to=document.getElementById("range-to").value;
  if(!from||!to||from>to){document.getElementById("range-error").textContent=uiText("Geçerli bir tarih aralığı seçin.","Choose a valid date range.");return;}
  platformCustomRange={from,to};platformRange="Özel Tarih";closeDialog();render();
}
function platformHistoryInRange(history){
  const days=platformRange==="Son 7 Gün"?7:platformRange==="Son 30 Gün"?30:90;
  const lower=Date.now()-days*86400000;
  return history.filter(item=>{const t=sdParseTimestamp(item.capturedAt);if(platformRange==="Özel Tarih"&&platformCustomRange){const date=scheduledAtParts(new Date(t).toISOString()).date;return date>=platformCustomRange.from&&date<=platformCustomRange.to;}return t>=lower;});
}
function openStatDetail(label,value,key){openDialog(`${platformLabel(key)} • ${label}`,`<div class="text-center py-6"><p class="font-headline-lg text-headline-lg">${escapeHtml(value)}</p><p class="text-on-surface-variant mt-2">${uiText(`Seçilen tarih aralığındaki ${normalizeText(label)} değeri`,`${label} for the selected date range`)}</p></div>`,`<button type="button" class="px-5 py-2.5 bg-primary text-white rounded-xl" data-command="closeDialog()">${uiText("Tamam","OK")}</button>`);}
function metricForRange(value){return value??"—";}


/* ---------- AI assistant ---------- */
function aiConversations(archived=aiArchiveMode){return frontendState.aiChats.filter(chat=>!!chat.archived===!!archived);}
renderAI=function(){
  const activeSource=aiConversations();
  const active=activeSource.find(c=>c.id===currentAiChatId);
  const language=frontendState.settings.language;
  const suggestions=language==="en"?["Generate summer campaign headlines","Write a caption for an image","Interpret reach rates"]:["Yaz kampanyası başlıkları üret","Görsel için açıklama yaz","Erişim oranlarını yorumla"];
  return `<div class="space-y-md"><div><h2 class="font-headline-lg text-headline-lg">${uiText("Yapay Zekâ Asistanı","AI Assistant")}</h2><p class="text-on-surface-variant">${uiText("İçerik fikirleri üretin, metinleri geliştirin ve konuşmalarınızı yönetin.","Generate content ideas, improve copy and manage your conversations.")}</p></div><div class="ai-workspace flex rounded-2xl overflow-hidden border bg-surface-container-lowest relative">
    <aside class="ai-history-mobile w-72 shrink-0 bg-surface-container-lowest border-r flex flex-col" id="ai-history-panel" aria-hidden="${window.innerWidth<640}" ${window.innerWidth<640?"inert":""}>
      <div class="p-md border-b"><div class="flex items-center justify-between mb-sm"><h2 class="font-bold">${uiText("Geçmiş Konuşmalar","Conversation History")}</h2><button type="button" aria-label="${uiText("Geçmişi kapat","Close history")}" class="p-1 sm:hidden" data-command="toggleAiHistory(false)"><span class="material-symbols-outlined">close</span></button></div>
      <button type="button" class="w-full py-2 mb-2 rounded-xl bg-primary text-white font-label-md flex items-center justify-center gap-2" data-command="newAiChat()"><span class="material-symbols-outlined text-[18px]">add</span>${uiText("Yeni Sohbet","New Chat")}</button>
      <input name="ai-history-search" id="ai-history-search" value="${escapeHtml(aiSearchQuery)}" class="w-full rounded-xl text-label-sm" placeholder="${uiText("Sohbetlerde ara...","Search conversations...")}"></div>
      <div class="flex-1 overflow-y-auto hide-scrollbar p-sm space-y-1" id="ai-history-list"></div>
      <div class="p-md bg-surface-container-low border-t"><button type="button" class="w-full flex items-center justify-center gap-2 bg-white border py-2 rounded-xl text-label-md" data-command="toggleAiArchive()"><span class="material-symbols-outlined">${aiArchiveMode?"forum":"archive"}</span>${aiArchiveMode?uiText("Konuşmalar","Conversations"):uiText("Arşivlenenler","Archived")}</button></div>
    </aside>
    <div class="flex-1 min-w-0 flex flex-col relative">
      <div class="p-2 border-b sm:hidden"><button type="button" aria-label="${uiText("Konuşma geçmişini aç","Open conversation history")}" class="p-2 rounded-lg bg-surface-container" data-command="toggleAiHistory(true)"><span class="material-symbols-outlined">menu</span></button></div>
      <div class="flex-1 overflow-y-auto hide-scrollbar p-md" id="ai-message-scroll"><div class="max-w-3xl mx-auto space-y-md">
        ${active?`<div class="text-center mb-lg"><h2 class="font-headline-md text-headline-md">${escapeHtml(active.title)}</h2><p class="text-body-sm text-on-surface-variant">${uiText("SocialDash AI asistanı","SocialDash AI assistant")}</p>${aiArchiveMode?`<button type="button" class="mt-2 text-primary text-label-sm font-bold" data-command="restoreAiChat(${active.id})">${uiText("Arşivden Çıkar","Restore")}</button>`:""}</div>${active.messages.map((m,i)=>aiMessageHtml(m,i)).join("")}`:`${emptyState(aiArchiveMode?uiText("Arşivlenmiş konuşma yok","No archived conversations"):uiText("Yeni bir sohbet başlatın","Start a new conversation"))}`}
        <div id="ai-typing" class="hidden flex gap-2"><span class="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center"><span class="material-symbols-outlined text-[16px]">smart_toy</span></span><span class="px-4 py-2 rounded-2xl bg-surface-container">${uiText("Yazıyor","Typing")}<span class="animate-pulse">…</span></span></div>
      </div></div>
      ${aiArchiveMode?`<div class="p-md bg-surface-container-low border-t"><div class="max-w-3xl mx-auto flex items-center justify-between gap-3"><p class="text-body-sm text-on-surface-variant">${uiText("Bu konuşma arşivde. Mesaj göndermek için arşivden çıkarın.","This conversation is archived. Restore it to send messages.")}</p>${active?`<button type="button" class="shrink-0 px-4 py-2 bg-primary text-white rounded-xl text-label-sm" data-command="restoreAiChat(${active.id})">${uiText("Arşivden Çıkar","Restore")}</button>`:""}</div></div>`:`<div class="p-md bg-surface/80 border-t"><div class="max-w-3xl mx-auto">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">${suggestions.map(x=>`<button type="button" class="p-2 bg-surface-container-low border rounded-xl text-label-sm text-left" data-command="useAiSuggestion('${x.replace(/'/g,"\\'")}')">${x}</button>`).join("")}</div>
        <div class="bg-surface-container-lowest shadow-sm rounded-2xl border p-2">
          ${aiPendingAttachment?`<div class="mb-2 flex items-center gap-3 rounded-xl bg-surface-container-low p-2">${aiPendingAttachment.preview?`<img class="ai-attachment-preview" src="${escapeHtml(aiPendingAttachment.preview)}" alt="${escapeHtml(aiPendingAttachment.name)}">`:`<span class="material-symbols-outlined text-primary">description</span>`}<div class="min-w-0 flex-1"><p class="truncate text-label-sm font-semibold">${escapeHtml(aiPendingAttachment.name)}</p><p class="text-[11px] text-on-surface-variant">${formatFileSize(aiPendingAttachment.size)}</p></div><button type="button" aria-label="${uiText("Dosyayı kaldır","Remove file")}" class="p-1 text-error" data-command="removeAiAttachment()"><span class="material-symbols-outlined">close</span></button></div>`:""}
          <div class="flex gap-2 items-center px-2 pb-1"><label class="cursor-pointer text-label-sm flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">attach_file</span>${uiText("Dosya Ekle","Attach File")}<input name="ai-file" id="ai-file" class="hidden" type="file" accept="text/plain,text/markdown,text/csv,application/json,.md,.txt,.csv,.json"></label><span class="text-[11px] text-on-surface-variant">${uiText("TXT, MD, CSV veya JSON · en fazla 6.000 karakter","TXT, MD, CSV or JSON · up to 6,000 characters")}</span></div>
          <div class="grid grid-cols-2 gap-2 mb-2">
            <select name="ai-platform" id="ai-platform" aria-label="${uiText("Platform","Platform")}" class="clean-select rounded-xl bg-surface-container-low border border-outline-variant/20 text-label-sm" data-change-command="aiComposerPlatform=this.value">
              <option value="general">${uiText("Genel","General")}</option><option>Instagram</option><option>Facebook</option><option>X</option><option>LinkedIn</option><option>TikTok</option><option>Threads</option><option>YouTube</option>
            </select>
            <select name="ai-tone" id="ai-tone" aria-label="${uiText("Ton","Tone")}" class="clean-select rounded-xl bg-surface-container-low border border-outline-variant/20 text-label-sm" data-change-command="aiComposerTone=this.value">
              <option value="professional">${uiText("Profesyonel","Professional")}</option><option value="friendly">${uiText("Samimi","Friendly")}</option><option value="fun">${uiText("Eğlenceli","Fun")}</option><option value="informative">${uiText("Bilgilendirici","Informative")}</option><option value="persuasive">${uiText("İkna Edici","Persuasive")}</option><option value="minimal">${uiText("Minimal","Minimal")}</option>
            </select>
          </div>
          <div class="flex items-end gap-2"><textarea name="ai-input" id="ai-input" class="flex-1 border-none focus:ring-0 resize-none max-h-32" placeholder="${uiText("Bir şeyler yazın...","Write something...")}" rows="1" ${aiResponsePending?"disabled":""}></textarea><button type="button" aria-label="${uiText("Mesaj gönder","Send message")}" id="ai-send" class="bg-primary text-white w-10 h-10 rounded-xl flex items-center justify-center" ${aiResponsePending?"disabled":""}><span class="material-symbols-outlined">send</span></button></div></div>
        <p class="ai-provider-note text-center text-[10px] text-on-surface-variant mt-2">${uiText("Yanıtlar yapılandırılmış AI sağlayıcısından alınır.","Responses come from the configured AI provider.")}</p>
      </div></div>`}
    </div></div></div>`;
};
function aiMessageHtml(m,index){
  if(m.role==="user")return `<div class="flex justify-end"><div class="bg-primary text-white px-4 py-2.5 rounded-2xl rounded-tr-none max-w-[85%] whitespace-pre-wrap">${m.attachment?`${m.attachment.preview?`<img class="ai-attachment-preview mb-2" src="${escapeHtml(m.attachment.preview)}" alt="${escapeHtml(m.attachment.name)}">`:""}<span class="mb-2 flex items-center gap-1 rounded-lg bg-white/15 px-2 py-1 text-[11px]"><span class="material-symbols-outlined text-[15px]">attach_file</span>${escapeHtml(m.attachment.name)} · ${formatFileSize(m.attachment.size)}</span>`:""}${m.platform||m.tone?`<span class="mb-2 block text-[10px] opacity-80">${escapeHtml([m.platform,m.tone].filter(Boolean).join(" · "))}</span>`:""}${escapeHtml(m.text)}</div></div>`;
  return `<div class="flex gap-2"><div class="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shrink-0"><span class="material-symbols-outlined text-[16px]">smart_toy</span></div><div class="max-w-[88%]"><div class="bg-surface-container-lowest border px-4 py-2.5 rounded-2xl rounded-tl-none whitespace-pre-wrap">${escapeHtml(m.text)}</div><div class="flex flex-wrap gap-2 mt-1"><button type="button" class="text-[11px] text-primary" data-command="copyAiMessage(${index})">${uiText("Kopyala","Copy")}</button><button type="button" class="text-[11px] text-primary" data-command="regenerateAiResponse(${index})">${uiText("Yeniden Oluştur","Regenerate")}</button><button type="button" class="text-[11px] text-primary" data-command="convertAiMessage(${index})">${uiText("Gönderiye Aktar","Send to Post")}</button></div></div></div>`;
}
function renderAiHistoryFiltered(query=""){
  const list=document.getElementById("ai-history-list");if(!list)return;
  aiSearchQuery=query;
  const source=aiConversations();
  const normalized=normalizeText(query);
  const filtered=source.filter(chat=>normalizeText(`${chat.title} ${(chat.messages||[]).map(message=>message.text).join(" ")}`).includes(normalized)).sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned));
  list.innerHTML=filtered.length?filtered.map(h=>`<div class="relative group"><button type="button" class="w-full text-left p-sm pr-9 rounded-xl ${h.id===currentAiChatId?"bg-primary-container/20 border-l-4 border-primary":"hover:bg-surface-container"}" data-command="selectAiChat(${h.id})"><p class="font-label-md truncate flex items-center gap-1">${!aiArchiveMode&&h.pinned?'<span class="material-symbols-outlined text-[14px] text-primary">push_pin</span>':""}${escapeHtml(h.title)}</p><p class="text-[11px] text-on-surface-variant">${escapeHtml(h.time||uiText("Şimdi","Now"))}</p></button><button type="button" aria-label="${uiText("Konuşma işlemleri","Conversation actions")}" aria-haspopup="true" aria-expanded="${openAiMenuId===h.id}" data-ai-menu-id="${h.id}" class="ai-chat-menu-button absolute right-1 top-2 p-1 rounded-lg hover:bg-surface-container-high" data-command="event.stopPropagation();toggleAiMenu(${h.id})"><span class="material-symbols-outlined text-[18px]">more_vert</span></button><div class="ai-item-menu ${openAiMenuId===h.id?"":"hidden"} absolute right-1 top-9 w-48 bg-surface-container-lowest border rounded-xl shadow-xl z-20 py-1">${aiArchiveMode?`<button type="button" class="w-full text-left px-3 py-2 text-label-sm hover:bg-surface-container-low flex items-center gap-2" data-command="event.stopPropagation();restoreAiChat(${h.id})"><span class="material-symbols-outlined text-[16px]">unarchive</span>${uiText("Arşivden Çıkar","Restore")}</button>`:`<button type="button" class="w-full text-left px-3 py-2 text-label-sm hover:bg-surface-container-low flex items-center gap-2" data-command="event.stopPropagation();renameAiChat(${h.id})"><span class="material-symbols-outlined text-[16px]">edit</span>${uiText("Yeniden Adlandır","Rename")}</button><button type="button" class="w-full text-left px-3 py-2 text-label-sm hover:bg-surface-container-low flex items-center gap-2" data-command="event.stopPropagation();pinAiChat(${h.id})"><span class="material-symbols-outlined text-[16px]">push_pin</span>${h.pinned?uiText("Sabitlemeyi Kaldır","Unpin"):uiText("Sabitle","Pin")}</button><button type="button" class="w-full text-left px-3 py-2 text-label-sm hover:bg-surface-container-low flex items-center gap-2" data-command="event.stopPropagation();duplicateAiChat(${h.id})"><span class="material-symbols-outlined text-[16px]">content_copy</span>${uiText("Çoğalt","Duplicate")}</button><button type="button" class="w-full text-left px-3 py-2 text-label-sm hover:bg-surface-container-low flex items-center gap-2" data-command="event.stopPropagation();archiveAiChat(${h.id})"><span class="material-symbols-outlined text-[16px]">archive</span>${uiText("Arşivle","Archive")}</button>`}<button type="button" class="w-full text-left px-3 py-2 text-label-sm text-error hover:bg-error-container/10 flex items-center gap-2" data-command="event.stopPropagation();deleteAiChat(${h.id},${aiArchiveMode})"><span class="material-symbols-outlined text-[16px]">delete</span>${uiText("Sil","Delete")}</button></div></div>`).join(""):emptyState(aiArchiveMode?uiText("Arşiv bulunamadı","No archived conversations found"):uiText("Konuşma bulunamadı","No conversations found"));
}
let aiSearchTimer=null;
initAiPage=function(){
  renderAiHistoryFiltered(aiSearchQuery);
  const input=document.getElementById("ai-input"),send=document.getElementById("ai-send"),search=document.getElementById("ai-history-search"),file=document.getElementById("ai-file");
  if(send&&input){send.addEventListener("click",sendAiMessage);input.addEventListener("input",()=>autoGrowAiInput(input));input.addEventListener("keydown",event=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();sendAiMessage();}});autoGrowAiInput(input);}
  if(search)search.addEventListener("input",event=>{const value=event.target.value;clearTimeout(aiSearchTimer);aiSearchTimer=setTimeout(()=>renderAiHistoryFiltered(value),180);});
  if(file)file.addEventListener("change",()=>handleAiFileSelection(file.files[0]));if(document.getElementById("ai-platform"))document.getElementById("ai-platform").value=aiComposerPlatform;if(document.getElementById("ai-tone"))document.getElementById("ai-tone").value=aiComposerTone;
  setTimeout(()=>{const s=document.getElementById("ai-message-scroll");if(s)s.scrollTop=s.scrollHeight;},10);
};
function toggleAiHistory(open){
  const panel=document.getElementById("ai-history-panel");if(!panel)return;
  if(open)rememberFocus("aiHistory");
  panel.classList.toggle("open",open);
  panel.inert=!open&&window.innerWidth<640;
  panel.setAttribute("aria-hidden",String(!open&&window.innerWidth<640));
  if(open)setTimeout(()=>panel.querySelector("button,input")?.focus(),0);
  else restoreFocus("aiHistory");
}
function selectAiChat(id){const source=aiConversations();if(!source.some(c=>c.id===id))return;currentAiChatId=id;frontendState.aiChats.forEach(c=>c.active=c.id===id);toggleAiHistory(false);render();hydrateAiChatMessages(id).then(()=>{if(currentAiChatId===id)render();});}
let aiCreatePending=null;
async function newAiChat(){
  if(aiCreatePending)return aiCreatePending;
  aiCreatePending=(async()=>{
    try{
      const empty=frontendState.aiChats.find(chat=>!chat.archived&&chat._hydrated&&!chat.messages?.length);
      if(empty){currentAiChatId=empty.id;aiArchiveMode=false;render();return empty;}
      const res=await api.aiChats.create(uiText("Yeni Sohbet","New Chat"));
      const chat={...res.data,messages:[],archived:false,_hydrated:true};
      frontendState.aiChats.unshift(chat);currentAiChatId=chat.id;aiArchiveMode=false;persistState();
      if(currentRoute==="ai")render();return chat;
    }catch(error){showToast(error.message);return null;}
  })();
  try{return await aiCreatePending;}finally{aiCreatePending=null;}
}

function toggleAiArchive(){aiArchiveMode=!aiArchiveMode;openAiMenuId=null;aiSearchQuery="";currentAiChatId=null;render();}
function toggleAiMenu(id){
  const opening=openAiMenuId!==id;
  openAiMenuId=opening?id:null;
  renderAiHistoryFiltered(aiSearchQuery);
  setTimeout(()=>{
    if(opening)document.querySelector(".ai-item-menu:not(.hidden) button")?.focus();
    else document.querySelector(`[data-ai-menu-id="${id}"]`)?.focus();
  },0);
}
function useAiSuggestion(text){const input=document.getElementById("ai-input");input.value=text;input.focus();}
function formatFileSize(size=0){return size>=1024*1024?`${(size/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(size/1024))} KB`;}
function autoGrowAiInput(input){input.style.height="auto";input.style.height=`${Math.min(input.scrollHeight,128)}px`;}
function removeAiAttachment(){if(aiPendingAttachment?.preview?.startsWith("blob:"))URL.revokeObjectURL(aiPendingAttachment.preview);aiPendingAttachment=null;render();}
async function handleAiFileSelection(selected){
  if(!selected)return;
  const allowed=["text/plain","text/markdown","text/csv","application/json"];
  const extension=selected.name.split(".").pop()?.toLowerCase();
  if(!allowed.includes(selected.type)&&!["md","txt","csv","json"].includes(extension)){showToast(uiText("Bu dosya türü desteklenmiyor","This file type is not supported"));return;}
  if(selected.size>5*1024*1024){showToast(uiText("Dosya 5 MB'den küçük olmalı","The file must be smaller than 5 MB"));return;}
  const isImage=selected.type.startsWith("image/");
  let preview="",content="";
  if(isImage)preview=URL.createObjectURL(selected);
  else content=(await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||""));reader.onerror=()=>resolve("");reader.readAsText(selected);})).slice(0,20000);
  if(content.length>6000){showToast(uiText("Dosya en fazla 6.000 karakter içerebilir.","The file must contain at most 6,000 characters."));return;}
  aiPendingAttachment={name:selected.name,type:selected.type||"text/plain",size:selected.size,preview,content};
  render();
}
async function sendAiMessage(){
  if(aiResponsePending)return;
  if(!(await capabilities()).ai){showToast(uiText("Yapay zekâ servisi henüz yapılandırılmadı.","The AI service is not configured yet."));return;}
  const input=document.getElementById("ai-input"),text=input.value.trim();if(!text&&!aiPendingAttachment)return;
  if(text.length+(aiPendingAttachment?.content?.length||0)>7500){showToast(uiText("Mesaj ve dosya toplamı çok uzun.","The message and attachment are too long."));return;}
  const platformEl=document.getElementById("ai-platform"),toneEl=document.getElementById("ai-tone");
  const platformValue=platformEl?.value||aiComposerPlatform||"general",toneValue=toneEl?.value||aiComposerTone||"professional";aiComposerPlatform=platformValue;aiComposerTone=toneValue;
  const platformLabelAI=platformValue==="general"?uiText("Genel","General"):platformValue;
  const toneLabels={professional:uiText("Profesyonel","Professional"),friendly:uiText("Samimi","Friendly"),fun:uiText("Eğlenceli","Fun"),informative:uiText("Bilgilendirici","Informative"),persuasive:uiText("İkna Edici","Persuasive"),minimal:uiText("Minimal","Minimal")};
  const toneLabelAI=toneLabels[toneValue]||toneValue;
  let chat=frontendState.aiChats.find(c=>c.id===currentAiChatId);if(!chat){await newAiChat();chat=frontendState.aiChats.find(c=>c.id===currentAiChatId);}
  if(!chat)return;
  const attachment=aiPendingAttachment?cloneData(aiPendingAttachment):null;
  const prompt=text||(frontendState.settings.language==="en"?`Review ${attachment.name}`:`${attachment.name} dosyasını incele`);
  aiResponsePending=true;
  chat.messages.push({role:"user",text:prompt,attachment,platform:platformLabelAI,tone:toneLabelAI});if(["Yeni Sohbet","New Chat"].includes(chat.title))chat.title=prompt.slice(0,36);input.value="";aiPendingAttachment=null;persistState();render();
  const typing=document.getElementById("ai-typing");typing?.classList.remove("hidden");

  const fullPrompt=attachment
    ?`[${platformLabelAI} · ${toneLabelAI}] ${prompt}\n\n[${uiText("Ek dosya","Attachment")}: ${attachment.name}]\n${attachment.content}`
    :`[${platformLabelAI} · ${toneLabelAI}] ${prompt}`;

  try{
    const isRealChatId=Number.isInteger(chat.id)&&chat.id<100000000000;
    if(!isRealChatId)throw Object.assign(new Error(uiText("Sohbet sunucuda henüz oluşturulmadı.","The chat was not created on the server yet.")),{status:0});
    const res=await api.aiChats.sendMessage(chat.id,fullPrompt);
    chat.messages=(res.data||[]).map(m=>({role:m.role,text:m.content}));
  }catch(err){
    if(Array.isArray(err?.data?.data))chat.messages=err.data.data.map(m=>({role:m.role,text:m.content}));
    else {chat._hydrated=false;await hydrateAiChatMessages(chat.id);}
    showToast(err?.data?.message||err.message||uiText("AI servisi kullanılamıyor.","AI service unavailable."));

  }finally{
    typing?.classList.add("hidden");
    if(frontendState.aiChats.includes(chat)){chat.time=uiText("Şimdi","Now");persistState();}
    aiResponsePending=false;
    if(currentRoute==="ai")render();
  }
}
function currentAiChat(){return aiConversations().find(c=>c.id===currentAiChatId);}
function fallbackCopyText(text){
  const area=document.createElement("textarea");
  area.value=text;
  area.setAttribute("readonly","");
  area.style.position="fixed";
  area.style.left="-9999px";
  area.style.top="0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0,area.value.length);
  let copied=false;
  try{copied=document.execCommand("copy");}catch(_){copied=false;}
  area.remove();
  return copied;
}
async function copyAiMessage(index){
  const text=currentAiChat()?.messages[index]?.text;
  if(!text)return;
  try{
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(text);
      showToast(uiText("Mesaj kopyalandı","Message copied"));
      return;
    }
  }catch(_){}
  if(fallbackCopyText(text))showToast(uiText("Mesaj kopyalandı","Message copied"));
  else showToast(uiText("Mesaj kopyalanamadı; tarayıcı iznini kontrol edin","Message could not be copied; check browser permission"));
}
function convertAiMessage(index){const text=currentAiChat()?.messages[index]?.text;if(!text)return;openCompose({text});}
renameAiChat=function(id){
  const source=aiConversations();
  const h=source.find(x=>x.id===id);if(!h)return;
  openAiMenuId=null;
  openDialog(
    uiText("Konuşmayı Yeniden Adlandır","Rename Conversation"),
    `<label for="rename-ai-input" class="block text-label-sm font-semibold mb-2">${uiText("Yeni başlık","New title")}</label><input name="rename-ai-input" id="rename-ai-input" class="w-full rounded-xl bg-surface-container-low border border-outline-variant/20 px-4 py-3" value="${escapeHtml(h.title)}" maxlength="80" aria-describedby="rename-ai-error"><p class="field-error" id="rename-ai-error"></p>`,
    `<button type="button" class="px-5 py-2.5 rounded-xl bg-surface-container" data-command="closeDialog()">${uiText("Vazgeç","Cancel")}</button><button type="button" class="px-5 py-2.5 rounded-xl bg-primary text-white" data-command="saveAiRename(${id})">${uiText("Kaydet","Save")}</button>`
  );
};

async function pinAiChat(id){
  const chat=frontendState.aiChats.find(c=>c.id===id);if(!chat)return;
  try{const res=await api.aiChats.pin(id);chat.pinned=res.pinned;openAiMenuId=null;persistState();render();}catch(error){showToast(error.message);}
}
async function duplicateAiChat(id){
  try{const res=await api.aiChats.duplicate(id);const copy={...res.data,messages:[],_hydrated:false,archived:false};frontendState.aiChats.unshift(copy);await hydrateAiChatMessages(copy.id);currentAiChatId=copy.id;aiArchiveMode=false;openAiMenuId=null;render();showToast(uiText("Konuşma çoğaltıldı","Conversation duplicated"));}catch(error){showToast(error.message);}
}

async function regenerateAiResponse(index){
  if(aiResponsePending)return;
  const chat=currentAiChat();if(!chat)return;
  const prev=chat.messages.slice(0,index).reverse().find(m=>m.role==="user");if(!prev)return;
  aiResponsePending=true;
  try{const res=await api.aiChats.sendMessage(chat.id,prev.text);chat.messages=res.data.map(m=>({role:m.role,text:m.content}));}
  catch(error){if(Array.isArray(error?.data?.data))chat.messages=error.data.data.map(m=>({role:m.role,text:m.content}));showToast(error.message);}
  finally{aiResponsePending=false;persistState();if(currentRoute==="ai")render();}
}

function editAiResponse(index){
  const chat=frontendState.aiChats.find(c=>c.id===currentAiChatId);if(!chat)return;
  const target=chat.messages[index];if(!target||target.role!=="assistant")return;
  openDialog(uiText("AI Yanıtını Düzenle","Edit AI Response"),`<label for="edit-ai-response-input" class="sd-visually-hidden">${uiText("AI yanıtı","AI response")}</label><textarea name="edit-ai-response-input" id="edit-ai-response-input" class="w-full min-h-[180px] rounded-xl bg-surface-container-low border border-outline-variant/20 p-3">${escapeHtml(target.text)}</textarea>`,
    `<button type="button" class="px-5 py-2.5 rounded-xl bg-surface-container" data-command="closeDialog()">${uiText("Vazgeç","Cancel")}</button><button type="button" class="px-5 py-2.5 rounded-xl bg-primary text-white" data-command="saveEditedAiResponse(${index})">${uiText("Kaydet","Save")}</button>`);
}
function saveEditedAiResponse(index){
  const chat=frontendState.aiChats.find(c=>c.id===currentAiChatId),input=document.getElementById("edit-ai-response-input");if(!chat||!input)return;
  const value=input.value.trim();if(!value)return;
  chat.messages[index].text=value;persistState();closeDialog();render();
}
function rateAiResponse(index,rating){
  const chat=frontendState.aiChats.find(c=>c.id===currentAiChatId);if(!chat)return;
  chat.messages[index].rating=rating;persistState();render();showToast(rating==="up"?uiText("Geri bildirim kaydedildi","Feedback saved"):uiText("Geri bildirim kaydedildi","Feedback saved"));
}
async function saveAiRename(id){
  const chat=frontendState.aiChats.find(c=>c.id===id),input=document.getElementById("rename-ai-input");if(!chat||!input)return;
  const value=input.value.trim();if(!value){document.getElementById("rename-ai-error").textContent=uiText("Başlık boş bırakılamaz.","Title cannot be empty.");return;}
  try{await api.aiChats.rename(id,value);chat.title=value;closeDialog();render();showToast(uiText("Konuşma adı güncellendi","Conversation renamed"));}catch(error){showToast(error.message);}
}
archiveAiChat=async function(id){
  const chat=frontendState.aiChats.find(c=>c.id===id);if(!chat)return;
  try{await api.aiChats.archive(id);chat.archived=true;currentAiChatId=null;openAiMenuId=null;render();showToast(uiText("Konuşma arşivlendi","Conversation archived"));}catch(error){showToast(error.message);}
};
async function restoreAiChat(id){
  const chat=frontendState.aiChats.find(c=>c.id===id);if(!chat)return;
  try{await api.aiChats.unarchive(id);chat.archived=false;currentAiChatId=null;openAiMenuId=null;aiArchiveMode=true;render();showToast(uiText("Konuşma arşivden çıkarıldı","Conversation restored"));}catch(error){showToast(error.message);}
}
function deleteAiChat(id,fromArchive=aiArchiveMode){
  const target=frontendState.aiChats.find(c=>c.id===id);if(!target)return;
  confirmAction(uiText("Konuşmayı Sil","Delete Conversation"),uiText(`“${target.title}” konuşması silinecek.`,`“${target.title}” will be deleted.`),uiText("Sil","Delete"),async()=>{
    try{
      await api.aiChats.remove(id);frontendState.aiChats=frontendState.aiChats.filter(c=>c.id!==id);if(currentAiChatId===id)currentAiChatId=null;openAiMenuId=null;closeDialog();render();
      showUndoToast(uiText("Konuşma silindi","Conversation deleted"),async()=>{
        try{await api.aiChats.restore(id);frontendState.aiChats.unshift(target);if(currentRoute==="ai")render();showToast(uiText("Konuşma geri alındı","Conversation restored"));}catch(error){showToast(error.message);}
      });
    }catch(error){showToast(error.message);}
  });
}


let newsItems=[];
let newsLoadError="";
let newsFilters={category:"all",platform:"all",source:"all",trend:"all",date:"all",sort:"newest"};
