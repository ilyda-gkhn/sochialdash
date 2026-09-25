const { makeService } = require("./base");
const fs = require("fs/promises");
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function uploadVideo(account, post, fetchJson) {
  const bytes=await fs.readFile(post.media.path),endpoint="https://api.x.com/2/media/upload";
  const init=new FormData();init.set("command","INIT");init.set("media_type",post.media.mime_type);init.set("total_bytes",String(bytes.length));init.set("media_category",post.media.mime_type==="image/gif"?"tweet_gif":"tweet_video");
  const initialized=await fetchJson("x",endpoint,{method:"POST",headers:{Authorization:`Bearer ${account.accessToken}`},body:init});
  const mediaId=initialized.payload.data?.id;if(!mediaId)throw new Error("X video yükleme oturumu medya kimliği döndürmedi.");
  const chunkSize=1024*1024;
  for(let offset=0,index=0;offset<bytes.length;offset+=chunkSize,index+=1){const chunk=bytes.subarray(offset,Math.min(offset+chunkSize,bytes.length));const form=new FormData();form.set("command","APPEND");form.set("media_id",String(mediaId));form.set("segment_index",String(index));form.set("media",new Blob([chunk],{type:post.media.mime_type}),`chunk-${index}`);await fetchJson("x",endpoint,{method:"POST",headers:{Authorization:`Bearer ${account.accessToken}`},body:form});}
  const finish=new FormData();finish.set("command","FINALIZE");finish.set("media_id",String(mediaId));let result=(await fetchJson("x",endpoint,{method:"POST",headers:{Authorization:`Bearer ${account.accessToken}`},body:finish})).payload;
  for(let attempt=0;result.data?.processing_info && result.data.processing_info.state!=="succeeded";attempt+=1){if(result.data.processing_info.state==="failed")throw new Error(`X video işleme hatası: ${result.data.processing_info.error?.message||"bilinmeyen hata"}`);if(attempt>=19)throw new Error("X video işlemesi zamanında tamamlanmadı.");await pause(Math.min(Number(result.data.processing_info.check_after_secs||1),5)*1000);result=(await fetchJson("x",`${endpoint}?command=STATUS&media_id=${encodeURIComponent(mediaId)}`,{headers:{Authorization:`Bearer ${account.accessToken}`}})).payload;}
  return String(mediaId);
}
module.exports = makeService({
  name: "x",
  clientIdEnv: "X_CLIENT_ID",
  clientSecretEnv: "X_CLIENT_SECRET",
  authorizeUrl: "https://x.com/i/oauth2/authorize",
  tokenUrl: "https://api.x.com/2/oauth2/token",
  profileUrl: "https://api.x.com/2/users/me?user.fields=id,name,username",
  scope: "tweet.read tweet.write users.read offline.access",
  pkce: true,
  basicTokenAuth: true,
  normalizeProfile: payload => ({ id: payload.data.id, name: payload.data.name, username: payload.data.username }),
  fetchStats: async ({ account, fetchJson }) => {
    const headers={Authorization:`Bearer ${account.accessToken}`};
    const user=(await fetchJson("x",`https://api.x.com/2/users/${encodeURIComponent(account.platform_user_id)}?user.fields=public_metrics`,{headers})).payload.data;
    const posts=(await fetchJson("x",`https://api.x.com/2/users/${encodeURIComponent(account.platform_user_id)}/tweets?max_results=100&tweet.fields=public_metrics`,{headers})).payload.data||[];
    const totals=posts.reduce((sum,item)=>{const m=item.public_metrics||{};sum.impressions+=Number(m.impression_count||0);sum.engagement+=Number(m.like_count||0)+Number(m.reply_count||0)+Number(m.retweet_count||0)+Number(m.quote_count||0)+Number(m.bookmark_count||0);return sum;},{impressions:0,engagement:0});
    return {followers:Number(user?.public_metrics?.followers_count||0),postsCount:Number(user?.public_metrics?.tweet_count||0),impressions:totals.impressions,reach:totals.impressions,engagement:totals.engagement,raw:{user:user?.public_metrics||{},sampledPosts:posts.length}};
  },
  fetchPostStats: async ({account,remoteId,fetchJson})=>{const item=(await fetchJson("x",`https://api.x.com/2/tweets/${encodeURIComponent(remoteId)}?tweet.fields=public_metrics`,{headers:{Authorization:`Bearer ${account.accessToken}`}})).payload.data;const m=item?.public_metrics||{};return {likes:m.like_count,comments:m.reply_count,shares:Number(m.retweet_count||0)+Number(m.quote_count||0),saves:m.bookmark_count,impressions:m.impression_count,reach:m.impression_count,raw:m};},
  publish: async ({ account, post, fetchJson }) => {
    let mediaIds;
    const items=post.mediaItems?.length?post.mediaItems:(post.media?[post.media]:[]);
    if(items.length){mediaIds=[];for(const media of items){let mediaId;const mediaPost={...post,media};
      if(["video/mp4","video/quicktime","image/gif"].includes(media.mime_type))mediaId=await uploadVideo(account,mediaPost,fetchJson);
      else{if(!["image/jpeg","image/png"].includes(media.mime_type))throw new Error("X için desteklenmeyen medya biçimi.");const bytes=await fs.readFile(media.path);const uploaded=await fetchJson("x","https://api.x.com/2/media/upload",{method:"POST",headers:{Authorization:`Bearer ${account.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({media:bytes.toString("base64"),media_category:"tweet_image",media_type:media.mime_type,shared:false})});mediaId=uploaded.payload.data?.id;if(!mediaId)throw new Error("X medya yüklemesi medya kimliği döndürmedi.");}mediaIds.push(String(mediaId));}
    }
    const body = { text: post.content };
    if (mediaIds) body.media = { media_ids: mediaIds };
    const { payload } = await fetchJson("x", "https://api.x.com/2/tweets", {
      method: "POST", headers: { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return { id: payload.data.id };
  }
});
