/* =========================================================
   ROUTER
========================================================== */
const routes = ["home","calendar","media","ai","news","settings","profile","platform"];
const platformKeys = ["instagram","facebook","x","linkedin","tiktok","youtube","threads"];
function dateOffsetISO(offset=0){
  const date=new Date();
  date.setHours(12,0,0,0);
  date.setDate(date.getDate()+offset);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}
let currentRoute = "home";
let currentPlatform = "instagram";


document.addEventListener("click", function(e){
  const el = e.target.closest("[data-route]");
  if(el){
    e.preventDefault();
    navigate(el.getAttribute("data-route"), el.getAttribute("data-platform"));
  }
});

window.addEventListener("hashchange", function(){
  const parts = location.hash.replace("#/","").split("/");
  const r = parts[0] || "home";
  if(r === "platform"){
    currentRoute = "platform";
    currentPlatform = platformKeys.includes(parts[1]) ? parts[1] : "instagram";
  } else {
    currentRoute = routes.includes(r) ? r : "home";
  }
  if(frontendState.auth.sessionActive)render();
});

function closeSidebarOnMobile(){
  if(window.innerWidth < 1024) setSidebar(false);
}

function updateActiveNav(){
  document.querySelectorAll("#sidebar-nav .nav-link[data-route], .nav-link-mobile[data-route]").forEach(a=>{
    a.classList.toggle("active-route", a.getAttribute("data-route") === currentRoute);
    a.classList.toggle("text-primary", a.getAttribute("data-route") === currentRoute);
  });
  document.querySelectorAll(".platform-link").forEach(a=>{
    const isActive = currentRoute === "platform" && a.getAttribute("data-platform") === currentPlatform;
    a.classList.toggle("text-primary", isActive);
    a.classList.toggle("font-bold", isActive);
  });
  if(currentRoute === "platform"){
    const menu = document.getElementById("platforms-menu");
    const chev = document.getElementById("platforms-chevron");
    if(menu && menu.classList.contains("hidden")){
      menu.classList.remove("hidden"); menu.classList.add("flex");
      if(chev) chev.style.transform = "rotate(180deg)";
    }
    document.querySelector('[aria-controls="platforms-menu"]')?.setAttribute("aria-expanded","true");
  }
}

function renderShell(){
  const root = document.getElementById("page-root");
  const pageModules = {
    home:{view:renderHome,init:initHomePage},
    calendar:{view:renderCalendar,init:initCalendarPage},
    media:{view:renderMedia,init:()=>{fixSelectArrows();initMediaPage();}},
    ai:{view:renderAI,init:initAiPage},
    news:{view:renderNews,init:()=>{fixSelectArrows();initNewsPage();}},
    settings:{view:renderSettings,init:initSettingsPage},
    profile:{view:renderProfile,init:initProfilePage},
    platform:{view:()=>renderPlatform(currentPlatform),init:()=>{fixSelectArrows();hydrateSelectedPlatformData(currentPlatform);}}
  };
  const page=pageModules[currentRoute]||pageModules.home;
  if(currentRoute==="calendar"&&window.innerWidth<768&&!calendarMobileInitialized){calendarView="liste";calendarMobileInitialized=true;}
  root.innerHTML = '<div class="page-fade">' + page.view() + '</div>';
  updateActiveNav();
  page.init?.();
}


let sdCompactCalendar=window.innerWidth<768;
window.addEventListener("resize",()=>{
  const compact=window.innerWidth<768;
  if(compact!==sdCompactCalendar){sdCompactCalendar=compact;if(frontendState.auth.sessionActive&&currentRoute==="calendar")render();}
  const history=document.getElementById("ai-history-panel");
  if(history){history.inert=window.innerWidth<640&&!history.classList.contains("open");history.setAttribute("aria-hidden",String(history.inert));}
});
