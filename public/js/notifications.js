function visibleNotifications(){
  return frontendState.notifications;
}
function renderNotifications(){
  renderNotificationsShell(visibleNotifications());
  updateNotifDot();
}

async function markAllRead(){
  if(!frontendState.notifications.some(item=>!item.read))return;
  try{await api.notifications.markAllRead();frontendState.notifications.forEach(notification=>notification.read=true);persistState();renderNotifications();showToast(uiText("Tüm bildirimler okundu","All notifications marked read"));}
  catch(err){showToast(err?.data?.message||uiText("Bildirimler güncellenemedi.","Notifications could not be updated."));}
}
markRead=async function(id){try{await api.notifications.markRead(id);const notification=frontendState.notifications.find(item=>item.id===id);if(notification)notification.read=true;persistState();renderNotifications();}catch(err){showToast(err?.data?.message||uiText("Bildirim güncellenemedi.","Notification could not be updated."));}};
deleteNotif=async function(id){
  const index=frontendState.notifications.findIndex(item=>item.id===id);
  const removed=frontendState.notifications[index];
  if(!removed)return;
  try{
    await api.notifications.remove(id);
    frontendState.notifications=frontendState.notifications.filter(item=>item.id!==id);
    persistState();renderNotifications();
    // Real undo: the backend soft-deletes (see routes/notifications.js), so
    // restoring here actually brings the notification back server-side too,
    // not just in this browser tab.
    showUndoToast(uiText("Bildirim silindi","Notification deleted"),async()=>{
      try{
        await api.notifications.restore(id);
        frontendState.notifications.splice(Math.min(index,frontendState.notifications.length),0,removed);
        persistState();renderNotifications();
        showToast(uiText("Bildirim geri alındı","Notification restored"));
      }catch(err){
        showToast(err?.data?.message||uiText("Bildirim geri alınamadı.","Notification could not be restored."));
      }
    });
  }catch(err){showToast(err?.data?.message||uiText("Bildirim silinemedi.","Notification could not be deleted."));}
};
function deleteNotifWithUndo(id){deleteNotif(id);}
attachSwipeHandlers=function(){
  document.querySelectorAll(".notif-row").forEach(row=>{
    if(row.dataset.swipeReady)return;
    row.dataset.swipeReady="1";
    const fg=row.querySelector(".notif-fg"),id=Number(row.dataset.id);
    let startX=0,startY=0,deltaX=0,dragging=false,horizontal=false;
    const reset=()=>{fg.style.transition="transform .2s ease";fg.style.transform="";startX=0;startY=0;deltaX=0;dragging=false;horizontal=false;};
    fg.addEventListener("pointerdown",event=>{
      if(event.target.closest("button,a"))return;
      startX=event.clientX;startY=event.clientY;deltaX=0;dragging=true;horizontal=false;
      fg.style.transition="none";
      try{fg.setPointerCapture(event.pointerId);}catch(_){ }
    });
    fg.addEventListener("pointermove",event=>{
      if(!dragging)return;
      const dx=event.clientX-startX,dy=event.clientY-startY;
      if(!horizontal && Math.abs(dx)<8 && Math.abs(dy)<8)return;
      if(!horizontal && Math.abs(dy)>Math.abs(dx)){reset();return;}
      horizontal=true;deltaX=Math.max(-130,Math.min(130,dx));
      fg.style.transform=`translateX(${deltaX}px)`;
    });
    const finish=()=>{
      if(!dragging)return;
      fg.style.transition="transform .2s ease";
      if(deltaX>=72){fg.style.transform="translateX(110px)";setTimeout(()=>markRead(id),150);}
      else if(deltaX<=-72){fg.style.transform="translateX(-110px)";setTimeout(()=>deleteNotifWithUndo(id),150);}
      else reset();
      dragging=false;
    };
    fg.addEventListener("pointerup",finish);
    fg.addEventListener("pointercancel",reset);
    fg.addEventListener("lostpointercapture",()=>{if(dragging)finish();});
  });
};
function directSettingsTab(tab){activeSettingsTab=tab;navigate("settings");}
navigate=function(route,platform){
  closeAllDropdowns();
  if(!routes.includes(route))route="home";
  currentRoute=route;
  if(route==="platform"){currentPlatform=platformKeys.includes(platform)?platform:"instagram";}
  const target=route==="platform"?`#/platform/${currentPlatform}`:`#/${route}`;
  if(location.hash!==target)history.pushState({route,currentPlatform},"",target);
  render();window.scrollTo({top:0,behavior:"instant"});closeSidebarOnMobile();
};


document.getElementById("shared-dialog").addEventListener("click",e=>{if(e.target.id==="shared-dialog")closeDialog();});
document.addEventListener("click",e=>{if(!e.target.closest("#global-search-results")&&!e.target.closest("#global-search"))document.getElementById("global-search-results")?.classList.remove("open");});
initGlobalSearch();
updateProfileUI();
if(frontendState.settings.sidebarOpen && !document.getElementById("app-shell").classList.contains("hidden"))setSidebar(true);

if(!Array.isArray(frontendState.media))frontendState.media=cloneData(defaultFrontendState.media);
frontendState.media.forEach((media,index)=>{media.dateISO=/^\d{4}-\d{2}-\d{2}$/.test(media.dateISO||"")?media.dateISO:dateOffsetISO(-index);media.platforms=Array.isArray(media.platforms)?media.platforms:[];media.uses=Array.isArray(media.uses)?media.uses:[];});
initComposeUpload();

