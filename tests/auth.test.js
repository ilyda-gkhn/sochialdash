require("./setup");
const request = require("supertest");
const app = require("../server");

describe("Auth", () => {
  const email = `user${Date.now()}@example.com`;
  const password = "GoodPass123";

  test("register success", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "Test User", email, password });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test("register auto-authenticates the user (same shape as login)", async () => {
    const regEmail = `autologin${Date.now()}@example.com`;
    const res = await request(app).post("/api/auth/register").send({ name: "Auto Login", email: regEmail, password });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.sessionId).toBeDefined();
    expect(res.body.user.email).toBe(regEmail);

    // The token returned by register must actually work on a protected route,
    // proving it's a real, valid session and not a placeholder.
    const profileRes = await request(app).get("/api/profile").set("Authorization", `Bearer ${res.body.token}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.user.email).toBe(regEmail);
  });

  test("duplicate email is rejected", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "Test User", email, password });
    expect(res.status).toBe(409);
  });

  test("invalid password is rejected", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test User", email: `weak${Date.now()}@example.com`, password: "weak"
    });
    expect(res.status).toBe(400);
  });

  test("login success", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  test("wrong password is rejected", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password: "WrongPass123" });
    expect(res.status).toBe(401);
  });

  test("missing token is rejected on protected route", async () => {
    const res = await request(app).get("/api/profile");
    expect(res.status).toBe(401);
  });

  test("invalid token is rejected on protected route", async () => {
    const res = await request(app).get("/api/profile").set("Authorization", "Bearer not-a-real-token");
    expect(res.status).toBe(403);
  });

  test("profile GET works with valid token", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({ email, password });
    const res = await request(app).get("/api/profile").set("Authorization", `Bearer ${loginRes.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
  });

  test("profile PUT works with valid token", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({ email, password });
    const res = await request(app).put("/api/profile")
      .set("Authorization", `Bearer ${loginRes.body.token}`)
      .send({ name: "Updated Name", email, phone: "5551234567", username: "updateduser", title: "Manager", country: "+90" });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Updated Name");
  });

  test("refresh token issues a new access token", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({ email, password });
    const res = await request(app).post("/api/auth/refresh").send({ refreshToken: loginRes.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test("reused (already-rotated) refresh token is detected and revokes all sessions", async () => {
    const reuseEmail = `reuse${Date.now()}@example.com`;
    const reg = await request(app).post("/api/auth/register").send({ name: "Reuse User", email: reuseEmail, password });
    const originalRefreshToken = reg.body.refreshToken;

    // Legitimate rotation: exchange the original token once.
    const firstRefresh = await request(app).post("/api/auth/refresh").send({ refreshToken: originalRefreshToken });
    expect(firstRefresh.status).toBe(200);
    const rotatedRefreshToken = firstRefresh.body.refreshToken;

    // An attacker (or a bug) replays the original, already-rotated-away token.
    const reuseAttempt = await request(app).post("/api/auth/refresh").send({ refreshToken: originalRefreshToken });
    expect(reuseAttempt.status).toBe(401);
    expect(reuseAttempt.body.error.code).toBe("REFRESH_TOKEN_REUSE");

    // The legitimate rotated token must now also be dead, since the whole
    // session family was revoked in response to the detected reuse.
    const afterReuse = await request(app).post("/api/auth/refresh").send({ refreshToken: rotatedRefreshToken });
    expect(afterReuse.status).toBe(401);
  });

  test("change password works and old password stops working", async () => {
    const loginRes = await request(app).post("/api/auth/login").send({ email, password });
    const changeRes = await request(app).put("/api/auth/password")
      .set("Authorization", `Bearer ${loginRes.body.token}`)
      .send({ currentPassword: password, newPassword: "NewPass456" });
    expect(changeRes.status).toBe(200);

    const oldLogin = await request(app).post("/api/auth/login").send({ email, password });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app).post("/api/auth/login").send({ email, password: "NewPass456" });
    expect(newLogin.status).toBe(200);
  });

  test("account deletion requires the current password", async () => {
    const deleteEmail = `delete${Date.now()}@example.com`;
    await request(app).post("/api/auth/register").send({ name: "Delete User", email: deleteEmail, password });
    const login = await request(app).post("/api/auth/login").send({ email: deleteEmail, password });

    const wrong = await request(app).delete("/api/profile")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ currentPassword: "WrongPass123" });
    expect(wrong.status).toBe(401);

    const deleted = await request(app).delete("/api/profile")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ currentPassword: password });
    expect(deleted.status).toBe(200);

    const relogin = await request(app).post("/api/auth/login").send({ email: deleteEmail, password });
    expect(relogin.status).toBe(401);
  });
});
