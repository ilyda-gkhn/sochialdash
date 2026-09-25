const { makeService } = require("./base");
const graphVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitUntilReady(id,account,fetchJson){for(let attempt=0;attempt<10;attempt+=1){const status=await fetchJson("instagram",`https://graph.instagram.com/${graphVersion}/${encodeURIComponent(id)}?fields=status_code,status`,{headers:{Authorization:`Bearer ${account.accessToken}`}});const code=status.payload.status_code||status.payload.status;if(code==="FINISHED")return;if(["ERROR","EXPIRED"].includes(code))throw new Error(`Instagram medya işleme hatası: ${code}`);await pause(1000);}throw new Error("Instagram medya işlemesi zamanında tamamlanmadı; daha sonra yeniden deneyin.");}
module.exports = makeService({
  name: "instagram",
  clientIdEnv: "INSTAGRAM_CLIENT_ID",
  clientSecretEnv: "INSTAGRAM_CLIENT_SECRET",
  authorizeUrl: "https://api.instagram.com/oauth/authorize",
  tokenUrl: "https://api.instagram.com/oauth/access_token",
  profileUrl: "https://graph.instagram.com/me?fields=id,username,account_type",
  scope: "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights",
  normalizeProfile: payload => ({ id:payload.id, name:payload.username, username:payload.username }),
  fetchStats:async({account,fetchJson})=>{const headers={Authorization:`Bearer ${account.accessToken}`},profile=(await fetchJson("instagram",`https://graph.instagram.com/${graphVersion}/${encodeURIComponent(account.platform_user_id)}?fields=followers_count,media_count`,{headers})).payload;let insights={};try{const data=(await fetchJson("instagram",`https://graph.instagram.com/${graphVersion}/${encodeURIComponent(account.platform_user_id)}/insights?metric=reach,total_interactions&period=day&metric_type=total_value`,{headers})).payload.data||[];for(const item of data)insights[item.name]=item.total_value?.value||item.values?.at(-1)?.value||0;}catch(_){}return {followers:profile.followers_count,postsCount:profile.media_count,reach:insights.reach,impressions:insights.reach,engagement:insights.total_interactions,raw:{profile,insights}};},
  fetchPostStats:async({account,remoteId,fetchJson})=>{const p=(await fetchJson("instagram",`https://graph.instagram.com/${graphVersion}/${encodeURIComponent(remoteId)}?fields=like_count,comments_count`,{headers:{Authorization:`Bearer ${account.accessToken}`}})).payload;return {likes:p.like_count,comments:p.comments_count,raw:p};},
  publish: async ({ account, post, fetchJson }) => {
    const items=post.mediaItems?.length?post.mediaItems:(post.media?[post.media]:[]);if(!items.length)throw new Error("Instagram gönderisi için medya zorunludur.");
    items.forEach(media=>{if(!["image/jpeg","image/png","video/mp4","video/quicktime"].includes(media.mime_type))throw new Error("Instagram için desteklenmeyen medya biçimi.");if(!media.publicUrl)throw new Error("Instagram yayını için dışarıdan erişilebilir HTTPS MEDIA_PUBLIC_BASE_URL yapılandırılmalı.");});
    const userId=encodeURIComponent(account.platform_user_id);
    let createBody;
    if(items.length>1){const children=[];for(const media of items){const isVideo=media.mime_type.startsWith("video/");const childBody=new URLSearchParams(isVideo?{media_type:"VIDEO",video_url:media.publicUrl,is_carousel_item:"true"}:{image_url:media.publicUrl,is_carousel_item:"true"});const child=await fetchJson("instagram",`https://graph.instagram.com/${graphVersion}/${userId}/media`,{method:"POST",headers:{Authorization:`Bearer ${account.accessToken}`,"Content-Type":"application/x-www-form-urlencoded"},body:childBody});if(!child.payload.id)throw new Error("Instagram carousel parçası kimlik döndürmedi.");await waitUntilReady(child.payload.id,account,fetchJson);children.push(child.payload.id);}createBody=new URLSearchParams({media_type:"CAROUSEL",children:children.join(","),caption:post.content});}
    else{const media=items[0],isVideo=media.mime_type.startsWith("video/");createBody=new URLSearchParams(isVideo?{media_type:"REELS",video_url:media.publicUrl,caption:post.content,share_to_feed:"true"}:{image_url:media.publicUrl,caption:post.content});}
    const created=await fetchJson("instagram",`https://graph.instagram.com/${graphVersion}/${userId}/media`,{method:"POST",headers:{Authorization:`Bearer ${account.accessToken}`,"Content-Type":"application/x-www-form-urlencoded"},body:createBody});
    if(!created.payload.id)throw new Error("Instagram medya container kimliği döndürmedi.");
    await waitUntilReady(created.payload.id,account,fetchJson);
    const publishBody=new URLSearchParams({creation_id:created.payload.id});
    const published=await fetchJson("instagram",`https://graph.instagram.com/${graphVersion}/${userId}/media_publish`,{method:"POST",headers:{Authorization:`Bearer ${account.accessToken}`,"Content-Type":"application/x-www-form-urlencoded"},body:publishBody});
    return {id:published.payload.id};
  }
});
