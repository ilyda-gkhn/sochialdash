/* =========================================================
   PAGE RENDERERS
========================================================== */


let currentMediaId = null;

function closeMediaDetail(){
  const drawer=document.getElementById("media-detail-drawer"),backdrop=document.getElementById("media-detail-backdrop");
  const wasOpen=drawer?.classList.contains("active");
  drawer?.classList.remove("active");backdrop?.classList.add("hidden");
  if(drawer){drawer.inert=true;drawer.setAttribute("aria-hidden","true");}
  syncOverlayInertState();
  if(wasOpen){unlockBodyScroll();restoreFocus("media");}
}


const platformDefinitions = {
  instagram: {label:"Instagram", icon:"photo_camera", brand:"linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)"},
  facebook: {label:"Facebook", icon:"public", brand:"#1877F2"},
  x: {label:"X", icon:"close", brand:"#000000"},
  linkedin: {label:"LinkedIn", icon:"work", brand:"#0A66C2"},
  tiktok: {label:"TikTok", icon:"music_note", brand:"linear-gradient(135deg,#25F4EE,#000000,#FE2C55)"},
  youtube: {label:"YouTube", icon:"smart_display", brand:"#FF0000"},
  threads: {label:"Threads", icon:"tag", brand:"#000000"}
};
const platformCatalog=Object.fromEntries(Object.entries(platformDefinitions).map(([key,seed])=>[
  key,{label:seed.label,icon:seed.icon,brand:seed.brand}
]));


/* AI conversation history uses a single frontend state model. */


/* =========================================================
   INIT
========================================================== */
(function init(){
  const parts = location.hash.replace("#/","").split("/");
  const r = parts[0];
  if(r === "platform"){
    currentRoute = "platform";
    currentPlatform = platformKeys.includes(parts[1]) ? parts[1] : "instagram";
  } else if(routes.includes(r)){
    currentRoute = r;
  }
})();
