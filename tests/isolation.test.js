require("./setup");
const request = require("supertest");
const app = require("../server");

async function registerAndLogin(email) {
  const password = "GoodPass123";
  await request(app).post("/api/auth/register").send({ name: "İsolation User", email, password });
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

describe("Cross-user data isolation", () => {
  let tokenA, tokenB, postId, mediaId, chatId, notificationCreated;

  beforeAll(async () => {
    tokenA = await registerAndLogin(`isoA-${Date.now()}@example.com`);
    tokenB = await registerAndLogin(`isoB-${Date.now()}@example.com`);
  });

  test("user A creates a post", async () => {
    const res = await request(app).post("/api/posts")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ title: "A'nın gönderisi", content: "gizli", platforms: ["Instagram"], status: "draft" });
    expect(res.status).toBe(201);
    postId = res.body.data.id;
  });

  test("user A creates an AI chat", async () => {
    const res = await request(app).post("/api/ai/chats")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ title: "A sohbeti" });
    expect(res.status).toBe(201);
    chatId = res.body.data.id;
  });

  test("user B cannot list user A's post", async () => {
    const res = await request(app).get("/api/posts").set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.data.find(p => p.id === postId)).toBeUndefined();
  });

  test("user B cannot read user A's post by ID", async () => {
    const res = await request(app).get(`/api/posts/${postId}`).set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  test("user B cannot update user A's post", async () => {
    const res = await request(app).put(`/api/posts/${postId}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ title: "hacked", content: "x", platforms: [], status: "draft" });
    expect(res.status).toBe(404);
  });

  test("user B cannot delete user A's post", async () => {
    const res = await request(app).delete(`/api/posts/${postId}`).set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  test("user B cannot access user A's AI chat messages", async () => {
    const res = await request(app).get(`/api/ai/chats/${chatId}/messages`).set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  test("user B's settings are isolated from user A's", async () => {
    await request(app).put("/api/settings").set("Authorization", `Bearer ${tokenA}`).send({ theme: "dark" });
    const bSettings = await request(app).get("/api/settings").set("Authorization", `Bearer ${tokenB}`);
    expect(bSettings.body.data.theme).toBe("light");
  });

  test("user A's post is still intact (not mutated by user B's attempts)", async () => {
    const res = await request(app).get(`/api/posts/${postId}`).set("Authorization", `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("A'nın gönderisi");
  });
});
