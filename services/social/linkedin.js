const { makeService } = require("./base");
const fs = require("fs/promises");
module.exports = makeService({
  name: "linkedin",
  clientIdEnv: "LINKEDIN_CLIENT_ID",
  clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
  authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  profileUrl: "https://api.linkedin.com/v2/userinfo",
  scope: "openid profile w_member_social",
  requiredEnv: ["LINKEDIN_API_VERSION"],
  normalizeProfile: payload => ({ id: payload.sub, name: payload.name, username: payload.email || payload.sub }),
  fetchStats:async({account,fetchJson})=>{const profile=(await fetchJson("linkedin","https://api.linkedin.com/v2/userinfo",{headers:{Authorization:`Bearer ${account.accessToken}`}})).payload;return {raw:{profile,note:"LinkedIn OpenID member access does not expose follower totals."}};},
  fetchPostStats:async({account,remoteId,fetchJson})=>{const headers={Authorization:`Bearer ${account.accessToken}`,"X-Restli-Protocol-Version":"2.0.0","Linkedin-Version":process.env.LINKEDIN_API_VERSION},p=(await fetchJson("linkedin",`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(remoteId)}`,{headers})).payload;return {likes:p.likesSummary?.totalLikes,comments:p.commentsSummary?.totalFirstLevelComments,raw:p};},
  publish: async ({ account, post, fetchJson }) => {
    const apiHeaders = { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json", "X-Restli-Protocol-Version": "2.0.0", "Linkedin-Version": process.env.LINKEDIN_API_VERSION };
    const author = `urn:li:person:${account.platform_user_id}`;
    let content;
    const items=post.mediaItems?.length?post.mediaItems:(post.media?[post.media]:[]);
    if(items.length>1){const images=[];for(const media of items){if(!["image/jpeg","image/png","image/gif"].includes(media.mime_type))throw new Error("LinkedIn çoklu medya gönderisinde yalnızca görsel kabul ediyor.");const initialized=await fetchJson("linkedin","https://api.linkedin.com/rest/images?action=initializeUpload",{method:"POST",headers:apiHeaders,body:JSON.stringify({initializeUploadRequest:{owner:author}})});const uploadUrl=initialized.payload.value?.uploadUrl,imageUrn=initialized.payload.value?.image;if(!uploadUrl||!imageUrn)throw new Error("LinkedIn görsel yükleme bilgilerini döndürmedi.");const parsed=new URL(uploadUrl);if(parsed.protocol!=="https:"||!(parsed.hostname==="linkedin.com"||parsed.hostname.endsWith(".linkedin.com")))throw new Error("LinkedIn geçersiz görsel yükleme adresi döndürdü.");await fetchJson("linkedin",uploadUrl,{method:"PUT",headers:{Authorization:`Bearer ${account.accessToken}`,"Content-Type":media.mime_type},body:await fs.readFile(media.path)});images.push({id:imageUrn,altText:String(media.original_name||post.title||"Gönderi görseli").slice(0,120)});}content={multiImage:{images}};
    }else if (post.media) {
      const bytes=await fs.readFile(post.media.path);
      if(["video/mp4","video/quicktime"].includes(post.media.mime_type)){
        const initialized=await fetchJson("linkedin","https://api.linkedin.com/rest/videos?action=initializeUpload",{method:"POST",headers:apiHeaders,body:JSON.stringify({initializeUploadRequest:{owner:author,fileSizeBytes:bytes.length,uploadCaptions:false,uploadThumbnail:false}})});
        const value=initialized.payload.value||{},instructions=value.uploadInstructions||[];if(!value.video||!instructions.length)throw new Error("LinkedIn video yükleme talimatı döndürmedi.");
        const partIds=[];
        for(const instruction of instructions){const parsed=new URL(instruction.uploadUrl);if(parsed.protocol!=="https:"||!(parsed.hostname==="linkedin.com"||parsed.hostname.endsWith(".linkedin.com")))throw new Error("LinkedIn geçersiz video yükleme adresi döndürdü.");const chunk=bytes.subarray(Number(instruction.firstByte),Math.min(Number(instruction.lastByte)+1,bytes.length));const uploaded=await fetchJson("linkedin",instruction.uploadUrl,{method:"PUT",headers:{Authorization:`Bearer ${account.accessToken}`,"Content-Type":"application/octet-stream"},body:chunk});const etag=uploaded.headers.get("etag");if(!etag)throw new Error("LinkedIn video parçası ETag döndürmedi.");partIds.push(etag.replace(/^\"|\"$/g,""));}
        await fetchJson("linkedin","https://api.linkedin.com/rest/videos?action=finalizeUpload",{method:"POST",headers:apiHeaders,body:JSON.stringify({finalizeUploadRequest:{video:value.video,uploadToken:value.uploadToken||"",uploadedPartIds:partIds}})});
        content={media:{id:value.video,title:String(post.title||"Video").slice(0,200)}};
      }else{
        if (!["image/jpeg", "image/png", "image/gif"].includes(post.media.mime_type)) throw new Error("LinkedIn için desteklenmeyen medya biçimi.");
        const initialized = await fetchJson("linkedin", "https://api.linkedin.com/rest/images?action=initializeUpload", {method:"POST",headers:apiHeaders,body:JSON.stringify({initializeUploadRequest:{owner:author}})});
        const uploadUrl=initialized.payload.value?.uploadUrl,imageUrn=initialized.payload.value?.image;if(!uploadUrl||!imageUrn)throw new Error("LinkedIn görsel yükleme bilgilerini döndürmedi.");
        const parsed=new URL(uploadUrl);if(parsed.protocol!=="https:"||!(parsed.hostname==="linkedin.com"||parsed.hostname.endsWith(".linkedin.com")))throw new Error("LinkedIn geçersiz bir medya yükleme adresi döndürdü.");
        await fetchJson("linkedin",uploadUrl,{method:"PUT",headers:{Authorization:`Bearer ${account.accessToken}`,"Content-Type":post.media.mime_type},body:bytes});content={media:{id:imageUrn,altText:String(post.media.original_name||post.title||"Gönderi görseli").slice(0,120)}};
      }
    }
    const body = { author, commentary: post.content, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false };
    if (content) body.content = content;
    const { headers } = await fetchJson("linkedin", "https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: apiHeaders,
      body: JSON.stringify(body)
    });
    return { id: headers.get("x-restli-id") || "" };
  }
});
