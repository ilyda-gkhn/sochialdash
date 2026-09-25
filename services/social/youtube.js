const { makeService } = require("./base");
const fs = require("fs/promises");
const crypto = require("crypto");
module.exports = makeService({
  name: "youtube",
  clientIdEnv: "YOUTUBE_CLIENT_ID",
  clientSecretEnv: "YOUTUBE_CLIENT_SECRET",
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  profileUrl: "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
  scope: "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly",
  authorizationParams: { access_type: "offline", prompt: "consent" },
  normalizeProfile: payload => { const item=payload.items?.[0]; if(!item)throw new Error("YouTube kanalı bulunamadı."); return { id:item.id, name:item.snippet?.title, username:item.snippet?.customUrl||item.id }; },
  fetchStats: async ({account,fetchJson})=>{const item=(await fetchJson("youtube",`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(account.platform_user_id)}`,{headers:{Authorization:`Bearer ${account.accessToken}`}})).payload.items?.[0];if(!item)throw new Error("YouTube kanal istatistikleri bulunamadı.");const s=item.statistics||{};return {followers:s.hiddenSubscriberCount?0:s.subscriberCount,views:s.viewCount,postsCount:s.videoCount,raw:s};},
  fetchPostStats: async ({account,remoteId,fetchJson})=>{const item=(await fetchJson("youtube",`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(remoteId)}`,{headers:{Authorization:`Bearer ${account.accessToken}`}})).payload.items?.[0];const s=item?.statistics||{};return {views:s.viewCount,likes:s.likeCount,comments:s.commentCount,raw:s};},
  publish: async ({ account, post, fetchJson }) => {
    if(!post.media)throw new Error("YouTube yayını için video zorunludur.");
    if(!["video/mp4","video/quicktime"].includes(post.media.mime_type))throw new Error("YouTube için MP4 veya MOV video seçilmelidir.");
    const boundary=`socialdash-${crypto.randomBytes(12).toString("hex")}`;
    const metadata={snippet:{title:String(post.title||"SocialDash video").slice(0,100),description:post.content||"",categoryId:process.env.YOUTUBE_CATEGORY_ID||"22"},status:{privacyStatus:process.env.YOUTUBE_PRIVACY_STATUS||"private"}};
    const video=await fs.readFile(post.media.path);
    const prefix=Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${post.media.mime_type}\r\n\r\n`);
    const suffix=Buffer.from(`\r\n--${boundary}--\r\n`);
    const {payload}=await fetchJson("youtube","https://www.googleapis.com/upload/youtube/v3/videos?part=snippet%2Cstatus&uploadType=multipart",{method:"POST",headers:{Authorization:`Bearer ${account.accessToken}`,"Content-Type":`multipart/related; boundary=${boundary}`},body:Buffer.concat([prefix,video,suffix])});
    if(!payload.id)throw new Error("YouTube video kimliği döndürmedi.");
    return {id:payload.id};
  }
});
