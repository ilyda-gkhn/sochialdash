/* =========================================================
   SIDEBAR / DROPDOWNS
========================================================== */
function setSidebar(open){
  const sidebar = document.getElementById("main-sidebar");
  const backdrop = document.getElementById("sidebar-backdrop");
  const wasOpen=sidebar.classList.contains("open");
  if(open&&!wasOpen)rememberFocus?.("sidebar");
  sidebar.classList.toggle("open", open);
  sidebar.classList.toggle("closed", !open);
  sidebar.inert=!open;
  sidebar.setAttribute("aria-hidden",String(!open));
  backdrop.style.opacity = open ? "1" : "0";
  backdrop.classList.toggle("pointer-events-auto", open);
  backdrop.classList.toggle("pointer-events-none", !open);
  document.querySelectorAll('[aria-controls="main-sidebar"]').forEach(button=>{
    button.setAttribute("aria-expanded",String(open));
    if(button.id!=="header-profile-avatar")button.setAttribute("aria-label",uiText(open?"Menüyü kapat":"Menüyü aç",open?"Close menu":"Open menu"));
  });
  if(open&&!wasOpen)setTimeout(()=>sidebar.querySelector("button,a")?.focus(),0);
  if(!open&&wasOpen)restoreFocus?.("sidebar");
}
function toggleSidebar(){
  const sidebar = document.getElementById("main-sidebar");
  setSidebar(!sidebar.classList.contains("open"));
}
function togglePlatforms(){
  const menu = document.getElementById("platforms-menu");
  const chev = document.getElementById("platforms-chevron");
  const isHidden = menu.classList.contains("hidden");
  menu.classList.toggle("hidden");
  menu.classList.toggle("flex", isHidden);
  chev.style.transform = isHidden ? "rotate(180deg)" : "rotate(0deg)";
  document.querySelector('[aria-controls="platforms-menu"]')?.setAttribute("aria-expanded",String(isHidden));
}

function closeAllDropdowns(except){
  const closing={
    notif:except!=="notif-panel"&&document.getElementById("notif-panel")?.classList.contains("open"),
    profile:except!=="profile-popover"&&document.getElementById("profile-popover")?.classList.contains("open"),
    platformDropdown:except!=="platform-dropdown"&&!document.getElementById("platform-dropdown")?.classList.contains("hidden")
  };
  ["notif-panel","profile-popover","platform-dropdown","global-search-results"].forEach(id=>{
    if(id === except)return;
    const element=document.getElementById(id);
    if(id==="platform-dropdown")element?.classList.add("hidden");
    else element?.classList.remove("open");
    if(["notif-panel","profile-popover"].includes(id)&&element){
      element.inert=true;
      element.setAttribute("aria-hidden","true");
    }
  });
  document.querySelector('[aria-controls="notif-panel"]')?.setAttribute("aria-expanded",String(except==="notif-panel"));
  document.querySelector('[aria-controls="profile-popover"]')?.setAttribute("aria-expanded",String(except==="profile-popover"));
  document.getElementById("platform-dropdown-trigger")?.setAttribute("aria-expanded",String(except==="platform-dropdown"));
  document.getElementById("global-search")?.setAttribute("aria-expanded",String(except==="global-search-results"));
  if(closing.platformDropdown)restoreFocus("platformDropdown");
  else if(closing.profile)restoreFocus("profile");
  else if(closing.notif)restoreFocus("notif");
}
function toggleNotifications(e){
  e?.stopPropagation();
  const trigger=e?.target.closest('[aria-controls="notif-panel"]');
  const panel = document.getElementById("notif-panel");
  const willOpen = !panel.classList.contains("open");
  if(willOpen)rememberFocus?.("notif");
  closeAllDropdowns("notif-panel");
  panel.classList.toggle("open", willOpen);
  panel.inert=!willOpen;
  panel.setAttribute("aria-hidden",String(!willOpen));
  trigger?.setAttribute("aria-expanded",String(willOpen));
  if(willOpen){renderNotifications();setTimeout(()=>panel.querySelector("button")?.focus(),0);}else restoreFocus?.("notif");
}
function toggleProfilePopover(e){
  e?.stopPropagation();
  const trigger=e?.target.closest('[aria-controls="profile-popover"]');
  const panel = document.getElementById("profile-popover");
  const willOpen = !panel.classList.contains("open");
  if(willOpen)rememberFocus?.("profile");
  closeAllDropdowns("profile-popover");
  panel.classList.toggle("open", willOpen);
  panel.inert=!willOpen;
  panel.setAttribute("aria-hidden",String(!willOpen));
  trigger?.setAttribute("aria-expanded",String(willOpen));
  if(willOpen)setTimeout(()=>panel.querySelector("button")?.focus(),0);else restoreFocus?.("profile");
}
document.addEventListener("click", function(e){
  if(!e.target.closest("#notif-panel") && !e.target.closest('[aria-controls="notif-panel"]')){
    const panel=document.getElementById("notif-panel");
    panel?.classList.remove("open");
    if(panel){panel.inert=true;panel.setAttribute("aria-hidden","true");}
    document.querySelector('[aria-controls="notif-panel"]')?.setAttribute("aria-expanded","false");
  }
  if(!e.target.closest("#profile-popover") && !e.target.closest('[aria-controls="profile-popover"]')){
    const panel=document.getElementById("profile-popover");
    panel?.classList.remove("open");
    if(panel){panel.inert=true;panel.setAttribute("aria-hidden","true");}
    document.querySelector('[aria-controls="profile-popover"]')?.setAttribute("aria-expanded","false");
  }
});


/* =========================================================
   ACCESSIBILITY — focus management for overlays
========================================================= */
/* =========================================================
   NOTIFICATIONS — scrollable list, swipe right=read, left=delete
========================================================== */
function notificationTime(notification){
  const timestamp=Number(notification.createdAt);if(!Number.isFinite(timestamp))return notification.time||"";
  const delta=Math.max(0,Date.now()-timestamp),minutes=Math.floor(delta/60000),hours=Math.floor(delta/3600000),days=Math.floor(delta/86400000);
  if(minutes<1)return uiText("Şimdi","Now");
  if(minutes<60)return uiText(`${minutes} dk önce`,`${minutes} min ago`);
  if(hours<24)return uiText(`${hours} saat önce`,`${hours} hr ago`);
  if(days===1)return uiText("Dün","Yesterday");
  return uiText(`${days} gün önce`,`${days} days ago`);
}

function renderNotificationsShell(items=frontendState?.notifications||[]){
  const list = document.getElementById("notif-list");
  if(items.length === 0){
    list.innerHTML = `<div class="p-lg text-center text-on-surface-variant text-body-sm">${uiText("Bildirim yok","No notifications")}</div>`;
  } else {
    list.innerHTML = items.map(n => {
      const id=Number(n.id);
      const color=["primary","secondary","tertiary","error"].includes(n.color)?n.color:"primary";
      const icon=/^[a-z0-9_]+$/i.test(String(n.icon||""))?n.icon:"notifications";
      return `
      <div class="notif-row border-b border-outline-variant/10" data-id="${id}">
        <div class="notif-bg">
          <span class="left-label">✓ OKUNDU</span>
          <span class="right-label">SİL</span>
        </div>
        <div class="notif-fg flex gap-3 px-md py-3 ${n.read ? "read" : ""}">
          <div class="notif-icon-${color} w-9 h-9 rounded-full flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-[18px]">${icon}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-body-sm font-bold text-on-surface break-words">${escapeHtml(n.title)}</p>
            <p class="text-[12px] text-on-surface-variant leading-snug">${escapeHtml(n.body)}</p>
            <p class="notif-time text-[10px] mt-1 uppercase tracking-wide">${escapeHtml(notificationTime(n))}</p>
            <div class="notif-actions">
              ${!n.read?`<button type="button" class="bg-primary-container text-on-primary-container" data-command="event.stopPropagation();markRead(${id})">${uiText("Okundu","Read")}</button>`:""}
              ${id===3?`<button type="button" class="bg-surface-container text-primary" data-command="event.stopPropagation();activeSettingsTab='hesaplar';navigate('settings')">${uiText("Ayarlar","Settings")}</button>`:""}
              <button type="button" class="bg-error-container text-error" data-command="event.stopPropagation();deleteNotifWithUndo(${id})">${uiText("Sil","Delete")}</button>
            </div>
          </div>
          ${!n.read ? '<span class="w-2 h-2 mt-1 rounded-full bg-secondary shrink-0"></span>' : ''}
        </div>
      </div>
    `;}).join("");
  }
  updateNotifDot();
  attachSwipeHandlers();
}

function markNotificationRead(id){markRead(id);}
function deleteNotification(id){deleteNotifWithUndo(id);}
function updateNotifDot(){
  const hasUnread = visibleNotifications().some(n=>!n.read);
  document.getElementById("notif-dot").style.display = hasUnread ? "block" : "none";
}


/* =========================================================
   COMPOSE MODAL — global overlay, does NOT alter shell/page
========================================================== */


function toggleDropdown(id){
  const dropdown=document.getElementById(id);if(!dropdown)return;
  const willOpen=dropdown.classList.contains("hidden");
  if(willOpen)rememberFocus("platformDropdown");
  closeAllDropdowns(willOpen?id:undefined);
  dropdown.classList.toggle("hidden",!willOpen);
  const trigger=document.querySelector(`[aria-controls="${id}"]`);
  trigger?.setAttribute("aria-expanded",String(willOpen));
  if(willOpen)setTimeout(()=>dropdown.querySelector('[role="option"],button')?.focus(),0);
  else restoreFocus("platformDropdown");
}


function togglePreview(){
  const drawer=document.getElementById("preview-drawer");
  const open=!drawer.classList.contains("active");
  if(open)rememberFocus("preview");
  drawer.classList.toggle("active",open);
  drawer.inert=!open;
  drawer.setAttribute("aria-hidden",String(!open));
  if(open)setTimeout(()=>drawer.querySelector("button")?.focus(),0);
  else restoreFocus("preview");
}
function toggleAccordion(btn){ btn.parentElement.classList.toggle("active"); }

function showToast(msg){
  const t = document.getElementById("toast");
  clearTimeout(showToast.timer);
  clearTimeout(showUndoToast?.timer);
  const text=typeof localizeRuntimeText==="function"?localizeRuntimeText(msg||"Kaydedildi"):(msg||"Kaydedildi");
  t.textContent = text;
  t.classList.add("show");
  showToast.timer=setTimeout(()=>t.classList.remove("show"), 2200);
}

/* =========================================================
   AUTH
========================================================== */


/* =========================================================
   SELECT double-arrow fix
========================================================== */
function fixSelectArrows(){
  document.querySelectorAll("#page-root select").forEach(s=>s.classList.add("clean-select"));
}

