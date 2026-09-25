const { makeService } = require("./base");
const graphVersion = process.env.META_GRAPH_API_VERSION || "v23.0";
module.exports = makeService({
  name: "facebook",
  clientIdEnv: "FACEBOOK_CLIENT_ID",
  clientSecretEnv: "FACEBOOK_CLIENT_SECRET",
  authorizeUrl: `https://www.facebook.com/${graphVersion}/dialog/oauth`,
  tokenUrl: `https://graph.facebook.com/${graphVersion}/oauth/access_token`,
  profileUrl: `https://graph.facebook.com/${graphVersion}/me?fields=id,name`,
  scope: "pages_show_list,pages_manage_posts,pages_read_engagement,read_insights",
  normalizeProfile: payload => ({ id:payload.id, name:payload.name, username:payload.id }),
  fetchProfiles: async ({ accessToken, fetchJson }) => {
    const { payload } = await fetchJson("facebook", `https://graph.facebook.com/${graphVersion}/me/accounts?fields=id,name,access_token`, { headers:{ Authorization:`Bearer ${accessToken}` } });
    return (payload.data||[]).map(page=>({ id:page.id, name:page.name, username:page.id, accessToken:page.access_token }));
  },
  fetchStats: async ({account,fetchJson})=>{const profile=(await fetchJson("facebook",`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(account.platform_user_id)}?fields=followers_count,fan_count`,{headers:{Authorization:`Bearer ${account.accessToken}`}})).payload;let insights={};try{const result=(await fetchJson("facebook",`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(account.platform_user_id)}/insights?metric=page_impressions_unique,page_post_engagements&period=day`,{headers:{Authorization:`Bearer ${account.accessToken}`}})).payload.data||[];for(const item of result)insights[item.name]=item.values?.at(-1)?.value||0;}catch(_){}return {followers:profile.followers_count||profile.fan_count,reach:insights.page_impressions_unique,impressions:insights.page_impressions_unique,engagement:insights.page_post_engagements,raw:{profile,insights}};},
  fetchPostStats:async({account,remoteId,fetchJson})=>{const p=(await fetchJson("facebook",`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(remoteId)}?fields=likes.summary(true),comments.summary(true),shares`,{headers:{Authorization:`Bearer ${account.accessToken}`}})).payload;return {likes:p.likes?.summary?.total_count,comments:p.comments?.summary?.total_count,shares:p.shares?.count,raw:p};},
  publish: async ({ account, post, fetchJson }) => {
    const base = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(account.platform_user_id)}`;
    if (post.media) {
      if (!["image/jpeg","image/png","video/mp4","video/quicktime"].includes(post.media.mime_type)) throw new Error("Facebook için desteklenmeyen medya biçimi.");
      if (!post.media.publicUrl) throw new Error("Facebook görsel yayını için MEDIA_PUBLIC_BASE_URL yapılandırılmalı.");
      const isVideo=post.media.mime_type.startsWith("video/");
      const body = new URLSearchParams(isVideo?{file_url:post.media.publicUrl,description:post.content,published:"true"}:{url:post.media.publicUrl,caption:post.content,published:"true"});
      const { payload } = await fetchJson("facebook", `${base}/${isVideo?"videos":"photos"}`, { method:"POST", headers:{ Authorization:`Bearer ${account.accessToken}`, "Content-Type":"application/x-www-form-urlencoded" }, body });
      return { id:payload.post_id||payload.id };
    }
    const body = new URLSearchParams({ message:post.content });
    const { payload } = await fetchJson("facebook", `${base}/feed`, { method:"POST", headers:{ Authorization:`Bearer ${account.accessToken}`, "Content-Type":"application/x-www-form-urlencoded" }, body });
    return { id:payload.id };
  }
});
