require("./setup");
const request = require("supertest");
const app = require("../server");
const db = require("../config/database");
const { encrypt, decrypt } = require("../services/tokenVault");
const socialServices = require("../services/social");

describe("Social OAuth security", () => {
  let token;
  beforeAll(async () => {
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "test-social-token-key";
    process.env.OAUTH_REDIRECT_BASE = "http://localhost:3000";
    process.env.X_CLIENT_ID = "x-client";
    process.env.X_CLIENT_SECRET = "x-secret";
    process.env.LINKEDIN_API_VERSION = "202606";
    const email = `social-${Date.now()}@example.com`, password = "GoodPass123";
    await request(app).post("/api/auth/register").send({ name: "Social User", email, password });
    token = (await request(app).post("/api/auth/login").send({ email, password })).body.token;
  });

  test("tokens are encrypted and decryptable", () => {
    const ciphertext = encrypt("secret-token");
    expect(ciphertext).toMatch(/^enc:v1:/);
    expect(ciphertext).not.toContain("secret-token");
    expect(decrypt(ciphertext)).toBe("secret-token");
  });

  test("connect URL uses one-time state and S256 PKCE", async () => {
    const res = await request(app).post("/api/accounts/connect").set("Authorization", `Bearer ${token}`).send({ platform: "x" });
    expect(res.status).toBe(200);
    const url = new URL(res.body.authorizationUrl);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(db.prepare("SELECT COUNT(*) AS count FROM oauth_states").get().count).toBe(1);
    expect(db.prepare("SELECT state_hash FROM oauth_states").get().state_hash).not.toBe(url.searchParams.get("state"));
  });

  test("X publishing adapter calls the real API contract", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ data: { id: "tweet-123", text: "Merhaba" } }), { status: 201, headers: { "Content-Type": "application/json" } }));
    try {
      const result = await socialServices.x.publish({ accessToken: "access" }, { content: "Merhaba" });
      expect(result.id).toBe("tweet-123");
      expect(global.fetch).toHaveBeenCalledWith("https://api.x.com/2/tweets", expect.objectContaining({ method: "POST" }));
      const options = global.fetch.mock.calls[0][1];
      expect(options.headers.Authorization).toBe("Bearer access");
      expect(JSON.parse(options.body)).toEqual({ text: "Merhaba" });
    } finally {
      global.fetch = originalFetch;
    }
  });

  test("X image publishing uploads media before creating the post", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data:{ id:"media-7" } }), { status:200, headers:{ "Content-Type":"application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data:{ id:"tweet-7" } }), { status:201, headers:{ "Content-Type":"application/json" } }));
    try {
      const result=await socialServices.x.publish({accessToken:"access"},{content:"Görsel",media:{path:__filename,mime_type:"image/png"}});
      expect(result.id).toBe("tweet-7");
      expect(global.fetch.mock.calls[0][0]).toBe("https://api.x.com/2/media/upload");
      expect(JSON.parse(global.fetch.mock.calls[1][1].body)).toEqual({text:"Görsel",media:{media_ids:["media-7"]}});
    } finally { global.fetch=originalFetch; }
  });

  test("X carousel uploads every image and preserves media order",async()=>{
    const originalFetch=global.fetch;
    global.fetch=jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{id:"media-a"}}),{status:200,headers:{"Content-Type":"application/json"}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{id:"media-b"}}),{status:200,headers:{"Content-Type":"application/json"}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{id:"tweet-carousel"}}),{status:201,headers:{"Content-Type":"application/json"}}));
    try{const item={path:__filename,mime_type:"image/png"};const result=await socialServices.x.publish({accessToken:"access"},{content:"Carousel",mediaItems:[item,item]});expect(result.id).toBe("tweet-carousel");expect(JSON.parse(global.fetch.mock.calls[2][1].body).media.media_ids).toEqual(["media-a","media-b"]);}finally{global.fetch=originalFetch;}
  });

  test("LinkedIn image publishing initializes, uploads, then posts", async () => {
    const originalFetch=global.fetch;
    global.fetch=jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({value:{uploadUrl:"https://upload.linkedin.com/image/1",image:"urn:li:image:1"}}),{status:200,headers:{"Content-Type":"application/json"}}))
      .mockResolvedValueOnce(new Response("",{status:201}))
      .mockResolvedValueOnce(new Response("",{status:201,headers:{"x-restli-id":"urn:li:share:1"}}));
    try{
      const result=await socialServices.linkedin.publish({accessToken:"access",platform_user_id:"person-1"},{title:"Başlık",content:"Görsel",media:{path:__filename,mime_type:"image/png",original_name:"resim.png"}});
      expect(result.id).toBe("urn:li:share:1");
      expect(global.fetch).toHaveBeenCalledTimes(3);
      const postBody=JSON.parse(global.fetch.mock.calls[2][1].body);
      expect(postBody.content.media.id).toBe("urn:li:image:1");
    }finally{global.fetch=originalFetch;}
  });

  test("YouTube adapter uploads a video with multipart metadata", async()=>{
    const originalFetch=global.fetch;
    global.fetch=jest.fn(async()=>new Response(JSON.stringify({id:"video-1"}),{status:200,headers:{"Content-Type":"application/json"}}));
    try{
      const result=await socialServices.youtube.publish({accessToken:"access"},{title:"Video",content:"Açıklama",media:{path:__filename,mime_type:"video/mp4"}});
      expect(result.id).toBe("video-1");
      const [url,options]=global.fetch.mock.calls[0];
      expect(url).toContain("upload/youtube/v3/videos");
      expect(options.headers["Content-Type"]).toMatch(/^multipart\/related; boundary=/);
      expect(options.body).toBeInstanceOf(Buffer);
      expect(options.body.toString()).toContain('"privacyStatus":"private"');
    }finally{global.fetch=originalFetch;}
  });

  test("TikTok upload remains processing until status API confirms publication",async()=>{
    const originalFetch=global.fetch;
    global.fetch=jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{upload_url:"https://upload.tiktokapis.com/video/1",publish_id:"pub-1"}}),{status:200,headers:{"Content-Type":"application/json"}}))
      .mockResolvedValueOnce(new Response("",{status:200}))
      .mockResolvedValueOnce(new Response(JSON.stringify({data:{status:"PUBLISH_COMPLETE",publicaly_available_post_id:["video-9"]}}),{status:200,headers:{"Content-Type":"application/json"}}));
    try{
      const started=await socialServices.tiktok.publish({accessToken:"access"},{title:"Video",content:"TikTok",media:{path:__filename,mime_type:"video/mp4"}});
      expect(started).toEqual({id:"pub-1",processing:true});
      const finished=await socialServices.tiktok.checkStatus({accessToken:"access"},started.id);
      expect(finished).toEqual({status:"published",id:"video-9"});
    }finally{global.fetch=originalFetch;}
  });

  test("Instagram carousel creates ordered children before publishing parent",async()=>{
    const originalFetch=global.fetch,responses=[
      {id:"child-1"},{status_code:"FINISHED"},{id:"child-2"},{status_code:"FINISHED"},{id:"parent-1"},{status_code:"FINISHED"},{id:"ig-post-1"}
    ];global.fetch=jest.fn(async()=>new Response(JSON.stringify(responses.shift()),{status:200,headers:{"Content-Type":"application/json"}}));
    try{const result=await socialServices.instagram.publish({accessToken:"access",platform_user_id:"ig-user"},{content:"Carousel",mediaItems:[{mime_type:"image/png",publicUrl:"https://cdn.example.com/1.png"},{mime_type:"image/png",publicUrl:"https://cdn.example.com/2.png"}]});expect(result.id).toBe("ig-post-1");const parentBody=global.fetch.mock.calls[4][1].body;expect(parentBody.get("media_type")).toBe("CAROUSEL");expect(parentBody.get("children")).toBe("child-1,child-2");}finally{global.fetch=originalFetch;}
  });
});
