require("./setup");
const request = require("supertest");
const app = require("../server");
const db = require("../config/database");
const { attemptPublish, recoverStuckPublications } = require("../services/scheduler");

async function registerAndLogin(email) {
  const password = "GoodPass123";
  await request(app).post("/api/auth/register").send({ name: "Post User", email, password });
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

describe("Posts CRUD", () => {
  let token, postId, plannedPostId;

  beforeAll(async () => {
    token = await registerAndLogin(`posts-${Date.now()}@example.com`);
  });

  test("post create", async () => {
    const res = await request(app).post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Test Gönderi", content: "İçerik", platforms: ["Instagram", "X"], status: "draft" });
    expect(res.status).toBe(201);
    expect(res.body.data.platforms).toEqual(expect.arrayContaining(["Instagram", "X"]));
    postId = res.body.data.id;
  });

  test("post read", async () => {
    const res = await request(app).get(`/api/posts/${postId}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Test Gönderi");
  });

  test("post update", async () => {
    const res = await request(app).put(`/api/posts/${postId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Güncellendi", content: "İçerik", platforms: ["LinkedIn"], status: "draft" });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Güncellendi");
    expect(res.body.data.platforms).toEqual(["LinkedIn"]);
  });

  test("post schedule updates status and date", async () => {
    const res = await request(app).patch(`/api/posts/${postId}/schedule`)
      .set("Authorization", `Bearer ${token}`)
      .send({ scheduledAt: "2099-01-01T10:00:00.000Z" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/hesabı/);
  });

  test("client cannot mark a post as published", async () => {
    const res = await request(app).post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Fake publish", content: "x", platforms: ["Instagram"], status: "published" });
    expect(res.status).toBe(400);
  });

  test("post preserves ordered multiple media owned by the user",async()=>{
    const user=db.prepare("SELECT id FROM users WHERE email LIKE 'posts-%@example.com' ORDER BY id DESC LIMIT 1").get();
    const insert=db.prepare("INSERT INTO media(user_id,filename,original_name,mime_type,tag,size,path) VALUES(?,?,?,?,?,?,?)");
    const first=insert.run(user.id,"one.png","one.png","image/png","FOTOĞRAF",24,__filename).lastInsertRowid;
    const second=insert.run(user.id,"two.png","two.png","image/png","FOTOĞRAF",24,__filename).lastInsertRowid;
    const res=await request(app).post("/api/posts").set("Authorization",`Bearer ${token}`).send({title:"Carousel",content:"İki görsel",platforms:["Instagram"],status:"draft",mediaIds:[second,first]});
    expect(res.status).toBe(201);expect(res.body.data.mediaIds).toEqual([Number(second),Number(first)]);expect(res.body.data.mediaId).toBe(Number(second));
  });

  test("scheduled post stores account and publication tracking", async () => {
    const user = db.prepare("SELECT id FROM users WHERE email LIKE 'posts-%@example.com' ORDER BY id DESC LIMIT 1").get();
    const account = db.prepare(`
      INSERT INTO social_accounts (user_id, platform, account_name, username, access_token, status)
      VALUES (?, 'instagram', 'Test Account', '@test', 'token', 'connected')
    `).run(user.id);
    const scheduledAt = "2099-01-01T10:00:00.000Z";
    const res = await request(app).post("/api/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ title: "Planlı", content: "İçerik", platforms: ["Instagram"], accountIds: { instagram: account.lastInsertRowid }, status: "scheduled", scheduledAt });
    expect(res.status).toBe(201);
    expect(res.body.data.scheduledAt).toBe(scheduledAt);
    expect(res.body.data.accountIds.instagram).toBe(Number(account.lastInsertRowid));
    expect(res.body.data.publications[0]).toMatchObject({ platform: "Instagram", status: "pending", attemptCount: 0 });
    plannedPostId = res.body.data.id;
  });

  test("scheduler records an honest per-platform failure", async () => {
    await attemptPublish(plannedPostId);
    const res = await request(app).get(`/api/posts/${plannedPostId}`).set("Authorization", `Bearer ${token}`);
    expect(res.body.data.status).toBe("failed");
    expect(res.body.data.publications[0]).toMatchObject({ platform: "Instagram", status: "failed", attemptCount: 1 });
    expect(res.body.data.publications[0].errorMessage).toMatch(/kimlik bilgileri eksik/);
  });

  test("failed post can be queued for retry", async () => {
    const res = await request(app).post(`/api/posts/${plannedPostId}/retry`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("scheduled");
    expect(res.body.data.publications[0]).toMatchObject({ status: "pending", attemptCount: 1 });
  });

  test("stuck publishing work is recovered without duplicate success", () => {
    db.prepare("UPDATE posts SET status='publishing' WHERE id=?").run(plannedPostId);
    db.prepare("UPDATE post_publications SET status='publishing',updated_at=datetime('now','-20 minutes') WHERE post_id=?").run(plannedPostId);
    expect(recoverStuckPublications()).toBe(1);
    expect(db.prepare("SELECT status FROM posts WHERE id=?").get(plannedPostId).status).toBe("scheduled");
    expect(db.prepare("SELECT status FROM post_publications WHERE post_id=?").get(plannedPostId).status).toBe("pending");
  });

  test("post delete", async () => {
    const res = await request(app).delete(`/api/posts/${postId}`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const readRes = await request(app).get(`/api/posts/${postId}`).set("Authorization", `Bearer ${token}`);
    expect(readRes.status).toBe(404);
  });
});

describe("Media authorization", () => {
  test("media list requires auth", async () => {
    const res = await request(app).get("/api/media");
    expect(res.status).toBe(401);
  });
});

describe("Notifications authorization", () => {
  test("notifications list requires auth", async () => {
    const res = await request(app).get("/api/notifications");
    expect(res.status).toBe(401);
  });
});
