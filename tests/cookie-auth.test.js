require("./setup");
const request = require("supertest");
const app = require("../server");

function findCookie(res, name) {
  const raw = res.headers["set-cookie"] || [];
  return raw.find(c => c.startsWith(`${name}=`));
}

describe("Refresh token HttpOnly cookie", () => {
  const email = `cookieauth${Date.now()}@example.com`;
  const password = "GoodPass123";

  test("register sets an HttpOnly, SameSite=Strict refresh cookie", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "Cookie User", email, password });
    expect(res.status).toBe(201);
    const cookie = findCookie(res, "sd_refresh");
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/auth/i);
    // Still present in the JSON body too, for non-browser API clients.
    expect(res.body.refreshToken).toBeDefined();
  });

  test("browser-style agent can refresh using only the cookie, no body token needed", async () => {
    const agent = request.agent(app);
    const loginRes = await agent.post("/api/auth/login").send({ email, password });
    expect(loginRes.status).toBe(200);
    expect(findCookie(loginRes, "sd_refresh")).toBeDefined();

    // Deliberately send an empty body - the cookie must be sufficient.
    const refreshRes = await agent.post("/api/auth/refresh").send({});
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.token).toBeDefined();

    // Rotated cookie replaces the old one on the agent's jar automatically.
    expect(findCookie(refreshRes, "sd_refresh")).toBeDefined();
  });

  test("refresh with neither cookie nor body token is rejected", async () => {
    const res = await request(app).post("/api/auth/refresh").send({});
    expect(res.status).toBe(400);
  });

  test("logout clears the cookie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email, password });
    const logoutRes = await agent.post("/api/auth/logout").send({});
    expect(logoutRes.status).toBe(200);
    const cleared = findCookie(logoutRes, "sd_refresh");
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/Max-Age=0/);

    // The cleared cookie must actually be unusable afterwards.
    const refreshAfterLogout = await agent.post("/api/auth/refresh").send({});
    expect(refreshAfterLogout.status).toBe(400);
  });

  test("cookie-based reuse detection revokes the whole session family", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({ email, password });
    const originalCookie = findCookie(login, "sd_refresh");

    // Rotate legitimately once via the agent (updates its cookie jar).
    const firstRefresh = await agent.post("/api/auth/refresh").send({});
    expect(firstRefresh.status).toBe(200);

    // Replay the ORIGINAL (now-superseded) cookie value directly.
    const replay = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", originalCookie.split(";")[0])
      .send({});
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("REFRESH_TOKEN_REUSE");

    // The agent's legitimately-rotated cookie must now be dead too.
    const afterReuse = await agent.post("/api/auth/refresh").send({});
    expect(afterReuse.status).toBe(401);
  });

  test("OAuth handoff exchange also sets the refresh cookie", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-google-client";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    process.env.OAUTH_REDIRECT_BASE = "http://localhost:3000";
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "test-handoff-encryption-key";

    const start = await request(app).get("/api/auth/google");
    const state = new URL(start.headers.location, "http://localhost").searchParams.get("state");

    global.fetch = jest.fn().mockImplementation((url) => {
      const u = String(url);
      if (u.startsWith("https://oauth2.googleapis.com/token")) {
        return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ access_token: "tok" }) });
      }
      return Promise.resolve({
        ok: true, status: 200,
        text: async () => JSON.stringify({ sub: "google-cookie-user", email: `googlecookie${Date.now()}@example.com`, email_verified: true, name: "G User" })
      });
    });

    const callback = await request(app).get(`/api/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);
    const code = new URL(callback.headers.location, "http://localhost").searchParams.get("oauth_code");

    const exchange = await request(app).post("/api/auth/oauth/exchange").send({ code });
    expect(exchange.status).toBe(200);
    expect(findCookie(exchange, "sd_refresh")).toBeDefined();

    jest.restoreAllMocks();
  });
});
