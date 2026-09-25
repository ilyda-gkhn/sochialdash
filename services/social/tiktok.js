const { makeService } = require("./base");
const fs = require("fs/promises");
module.exports = makeService({
  name: "tiktok",
  clientIdEnv: "TIKTOK_CLIENT_ID",
  clientSecretEnv: "TIKTOK_CLIENT_SECRET",
  authorizeUrl: "https://www.tiktok.com/v2/auth/authorize",
  tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
  profileUrl: "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username",
  scope: "video.publish,user.info.basic,user.info.stats",
  authorizationClientParam: "client_key",
  clientIdParam: "client_key",
  normalizeProfile: payload => ({ id:payload.data.user.open_id, name:payload.data.user.display_name, username:payload.data.user.username||payload.data.user.open_id }),
  fetchStats: async ({account,fetchJson})=>{const user=(await fetchJson("tiktok","https://open.tiktokapis.com/v2/user/info/?fields=open_id,follower_count,likes_count,video_count",{headers:{Authorization:`Bearer ${account.accessToken}`}})).payload.data?.user||{};return {followers:user.follower_count,engagement:user.likes_count,postsCount:user.video_count,raw:user};},
  publish: async ({ account, post, fetchJson }) => {
    if(!post.media)throw new Error("TikTok yayını için video zorunludur.");
    if(!["video/mp4","video/quicktime"].includes(post.media.mime_type))throw new Error("TikTok için MP4 veya MOV video seçilmelidir.");
    const bytes=await fs.readFile(post.media.path),size=bytes.length;
    const init=await fetchJson("tiktok","https://open.tiktokapis.com/v2/post/publish/video/init/",{method:"POST",headers:{Authorization:`Bearer ${account.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({post_info:{title:String(post.content||post.title||"").slice(0,2200),privacy_level:process.env.TIKTOK_PRIVACY_LEVEL||"SELF_ONLY",disable_duet:false,disable_comment:false,disable_stitch:false,video_cover_timestamp_ms:1000},source:{source:"FILE_UPLOAD",video_size:size,chunk_size:size,total_chunk_count:1}})});
    const uploadUrl=init.payload.data?.upload_url,publishId=init.payload.data?.publish_id;
    if(!uploadUrl||!publishId)throw new Error("TikTok yükleme adresi veya publish_id döndürmedi.");
    const target=new URL(uploadUrl);if(target.protocol!=="https:")throw new Error("TikTok geçersiz yükleme adresi döndürdü.");
    await fetchJson("tiktok",uploadUrl,{method:"PUT",headers:{"Content-Type":post.media.mime_type,"Content-Length":String(size),"Content-Range":`bytes 0-${size-1}/${size}`},body:bytes});
    return {id:publishId,processing:true};
  },
  checkStatus: async ({account,remoteId,fetchJson}) => {
    const {payload}=await fetchJson("tiktok","https://open.tiktokapis.com/v2/post/publish/status/fetch/",{method:"POST",headers:{Authorization:`Bearer ${account.accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({publish_id:remoteId})});
    const value=payload.data?.status;
    if(value==="PUBLISH_COMPLETE")return {status:"published",id:payload.data?.publicaly_available_post_id?.[0]||remoteId};
    if(value==="FAILED")return {status:"failed",error:payload.data?.fail_reason||"TikTok yayını başarısız."};
    return {status:"processing"};
  }
});
