const { makeService } = require("./base");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
module.exports = makeService({
  name: "threads",
  clientIdEnv: "THREADS_CLIENT_ID",
  clientSecretEnv: "THREADS_CLIENT_SECRET",
  authorizeUrl: "https://threads.net/oauth/authorize",
  tokenUrl: "https://graph.threads.net/oauth/access_token",
  profileUrl: "https://graph.threads.net/v1.0/me?fields=id,username,name",
  scope: "threads_basic,threads_content_publish,threads_manage_insights",
  normalizeProfile: payload => ({ id:payload.id, name:payload.name||payload.username, username:payload.username }),
  fetchStats:async({account,fetchJson})=>{const headers={Authorization:`Bearer ${account.accessToken}`},profile=(await fetchJson("threads",`https://graph.threads.net/v1.0/${encodeURIComponent(account.platform_user_id)}?fields=id,username`,{headers})).payload,data=(await fetchJson("threads",`https://graph.threads.net/v1.0/${encodeURIComponent(account.platform_user_id)}/threads_insights?metric=views,likes,replies,reposts,quotes,followers_count`,{headers})).payload.data||[],values={};for(const item of data)values[item.name]=item.total_value?.value||item.values?.at(-1)?.value||0;return {followers:values.followers_count,views:values.views,impressions:values.views,reach:values.views,engagement:Number(values.likes||0)+Number(values.replies||0)+Number(values.reposts||0)+Number(values.quotes||0),raw:{profile,values}};},
  fetchPostStats:async({account,remoteId,fetchJson})=>{const data=(await fetchJson("threads",`https://graph.threads.net/v1.0/${encodeURIComponent(remoteId)}/insights?metric=views,likes,replies,reposts,quotes`,{headers:{Authorization:`Bearer ${account.accessToken}`}})).payload.data||[],v={};for(const item of data)v[item.name]=item.values?.at(-1)?.value||item.total_value?.value||0;return {views:v.views,impressions:v.views,reach:v.views,likes:v.likes,comments:v.replies,shares:Number(v.reposts||0)+Number(v.quotes||0),raw:v};},
  publish: async ({ account, post, fetchJson }) => {
    const items=post.mediaItems?.length?post.mediaItems:(post.media?[post.media]:[]);items.forEach(media=>{if(!["image/jpeg","image/png","video/mp4","video/quicktime"].includes(media.mime_type))throw new Error("Threads için desteklenmeyen medya biçimi.");if(!media.publicUrl)throw new Error("Threads medya yayını için dışarıdan erişilebilir HTTPS MEDIA_PUBLIC_BASE_URL yapılandırılmalı.");});
    let createBody;if(items.length>1){const children=[];for(const media of items){const isVideo=media.mime_type.startsWith("video/");const childBody=new URLSearchParams(isVideo?{media_type:"VIDEO",video_url:media.publicUrl,is_carousel_item:"true"}:{media_type:"IMAGE",image_url:media.publicUrl,is_carousel_item:"true"});const child=await fetchJson("threads","https://graph.threads.net/v1.0/me/threads",{method:"POST",headers:{Authorization:`Bearer ${account.accessToken}`,"Content-Type":"application/x-www-form-urlencoded"},body:childBody});if(!child.payload.id)throw new Error("Threads carousel parçası kimlik döndürmedi.");children.push(child.payload.id);}createBody=new URLSearchParams({media_type:"CAROUSEL",children:children.join(","),text:post.content});}else{const media=items[0],isVideo=media?.mime_type?.startsWith("video/");createBody=new URLSearchParams(media?(isVideo?{media_type:"VIDEO",video_url:media.publicUrl,text:post.content}:{media_type:"IMAGE",image_url:media.publicUrl,text:post.content}):{media_type:"TEXT",text:post.content});}
    const created = await fetchJson("threads", "https://graph.threads.net/v1.0/me/threads", { method:"POST", headers:{ Authorization:`Bearer ${account.accessToken}`, "Content-Type":"application/x-www-form-urlencoded" }, body:createBody });
    if(!created.payload.id)throw new Error("Threads medya container kimliği döndürmedi.");
    if(post.media){
      let ready=false;
      for(let attempt=0;attempt<5;attempt+=1){
        const status=await fetchJson("threads",`https://graph.threads.net/v1.0/${encodeURIComponent(created.payload.id)}?fields=status,error_message`,{headers:{Authorization:`Bearer ${account.accessToken}`}});
        if(status.payload.status==="FINISHED"){ready=true;break;}
        if(["ERROR","EXPIRED"].includes(status.payload.status))throw new Error(`Threads medya işleme hatası: ${status.payload.error_message||status.payload.status}`);
        await pause(1000);
      }
      if(!ready)throw new Error("Threads medya işlemesi zamanında tamamlanmadı; daha sonra yeniden deneyin.");
    }
    const publishBody = new URLSearchParams({ creation_id: created.payload.id });
    const published = await fetchJson("threads", "https://graph.threads.net/v1.0/me/threads_publish", { method:"POST", headers:{ Authorization:`Bearer ${account.accessToken}`, "Content-Type":"application/x-www-form-urlencoded" }, body:publishBody });
    return { id:published.payload.id };
  }
});
