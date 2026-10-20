require("./setup");
const request = require("supertest");
const app = require("../server");
const db = require("../config/database");

async function registerAndLogin(email) {
  const password = "GoodPass123";
  await request(app).post("/api/auth/register").send({ name: "Pagination User", email, password });
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

describe("Pagination contracts", () => {
  let token, userId;

  beforeAll(async () => {
    const email = `pagination-${Date.now()}@example.com`;
    token = await registerAndLogin(email);
    userId = db.prepare("SELECT id FROM users WHERE email = ?").get(email).id;
  });

  test("posts list returns total/totalPages and paginates", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: `Post ${i}`, content: "x", platforms: [], status: "draft" });
    }
    const page1 = await request(app).get("/api/posts?page=1&pageSize=2").set("Authorization", `Bearer ${token}`);
    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(2);
    expect(page1.body.total).toBeGreaterThanOrEqual(5);
    expect(page1.body.totalPages).toBeGreaterThanOrEqual(3);

    const page2 = await request(app).get("/api/posts?page=2&pageSize=2").set("Authorization", `Bearer ${token}`);
    expect(page2.status).toBe(200);
    expect(page2.body.data.length).toBe(2);
    const ids1 = page1.body.data.map(p => p.id);
    const ids2 = page2.body.data.map(p => p.id);
    expect(ids1.some(id => ids2.includes(id))).toBe(false);
  });

  test("notifications list is no longer capped at 200 and paginates", async () => {
    const insert = db.prepare("INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'system', ?, ?)");
    for (let i = 0; i < 210; i++) insert.run(userId, `Bildirim ${i}`, "test");

    const page1 = await request(app).get("/api/notifications?page=1&pageSize=100").set("Authorization", `Bearer ${token}`);
    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(100);
    expect(page1.body.total).toBeGreaterThanOrEqual(210);
    expect(page1.body.totalPages).toBeGreaterThanOrEqual(3);

    const page3 = await request(app).get("/api/notifications?page=3&pageSize=100").set("Authorization", `Bearer ${token}`);
    expect(page3.status).toBe(200);
    expect(page3.body.data.length).toBeGreaterThan(0);
  });

  test("media list supports pagination, search and type filter", async () => {
    const insert = db.prepare(`INSERT INTO media (user_id, filename, original_name, mime_type, tag, size, path)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    for (let i = 0; i < 12; i++) {
      insert.run(userId, `file${i}.jpg`, `Tatil Fotografi ${i}.jpg`, "image/jpeg", "FOTOĞRAF", 1000, `/tmp/file${i}.jpg`);
    }
    insert.run(userId, "clip.mp4", "Kampanya Videosu.mp4", "video/mp4", "VIDEO", 2000, "/tmp/clip.mp4");

    const page1 = await request(app).get("/api/media?page=1&pageSize=5").set("Authorization", `Bearer ${token}`);
    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(5);
    expect(page1.body.total).toBeGreaterThanOrEqual(13);

    const search = await request(app).get("/api/media?search=Kampanya").set("Authorization", `Bearer ${token}`);
    expect(search.status).toBe(200);
    expect(search.body.data.every(m => m.name.includes("Kampanya"))).toBe(true);

    const byType = await request(app).get("/api/media?type=VIDEO").set("Authorization", `Bearer ${token}`);
    expect(byType.status).toBe(200);
    expect(byType.body.data.every(m => m.tag === "VIDEO" || m.url.endsWith(".mp4"))).toBe(true);
  });

  test("standardized error envelope includes error.code", async () => {
    const res = await request(app).get("/api/posts/999999").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.message).toBe(res.body.error.message);
  });

  test("unauthenticated request returns standardized NO_TOKEN error", async () => {
    const res = await request(app).get("/api/posts");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("NO_TOKEN");
  });
});
