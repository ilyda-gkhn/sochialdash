require("./setup");
const request = require("supertest");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const app = require("../server");

function queryFromLocation(location) {
  return Object.fromEntries(new URL(location, "http://localhost").searchParams);
}

describe("Google/Apple sign-in", () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; jest.restoreAllMocks(); });

  test("GET /api/auth/google redirects with an honest not-configured message when unset", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    const res = await request(app).get("/api/auth/google");
    expect(res.status).toBe(302);
    const q = queryFromLocation(res.headers.location);
    expect(q.oauth).toBe("error");
    expect(q.provider).toBe("google");
  });

  test("GET /api/auth/apple redirects with an honest not-configured message when unset", async () => {
    delete process.env.APPLE_CLIENT_ID;
    const res = await request(app).get("/api/auth/apple");
    expect(res.status).toBe(302);
    const q = queryFromLocation(res.headers.location);
    expect(q.oauth).toBe("error");
    expect(q.provider).toBe("apple");
  });

  test("full Google sign-in flow: authorize -> callback -> handoff exchange -> real session", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-google-client";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    process.env.OAUTH_REDIRECT_BASE = "http://localhost:3000";
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "test-handoff-encryption-key";

    const start = await request(app).get("/api/auth/google?remember=1");
    expect(start.status).toBe(302);
    expect(start.headers.location).toMatch(/^https:\/\/accounts\.google\.com/);
    const { state, code_challenge: codeChallenge } = queryFromLocation(start.headers.location);
    expect(state).toBeTruthy();
    expect(codeChallenge).toBeTruthy();

    global.fetch = jest.fn().mockImplementation((url) => {
      const u = String(url);
      if (u.startsWith("https://oauth2.googleapis.com/token")) {
        return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ access_token: "google-access-token", token_type: "Bearer" }) });
      }
      if (u.startsWith("https://openidconnect.googleapis.com/v1/userinfo")) {
        return Promise.resolve({
          ok: true, status: 200,
          text: async () => JSON.stringify({ sub: "google-user-123", email: "newgoogleuser@example.com", email_verified: true, name: "Google User" })
        });
      }
      throw new Error(`Unexpected fetch to ${u}`);
    });

    const callback = await request(app).get(`/api/auth/google/callback?code=abc123&state=${encodeURIComponent(state)}`);
    expect(callback.status).toBe(302);
    const { oauth_code: oauthCode } = queryFromLocation(callback.headers.location);
    expect(oauthCode).toBeTruthy();

    const exchange = await request(app).post("/api/auth/oauth/exchange").send({ code: oauthCode });
    expect(exchange.status).toBe(200);
    expect(exchange.body.token).toBeDefined();
    expect(exchange.body.refreshToken).toBeDefined();
    expect(exchange.body.user.email).toBe("newgoogleuser@example.com");

    // Token actually works.
    const profile = await request(app).get("/api/profile").set("Authorization", `Bearer ${exchange.body.token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.user.email).toBe("newgoogleuser@example.com");

    // Handoff code is single-use.
    const secondExchange = await request(app).post("/api/auth/oauth/exchange").send({ code: oauthCode });
    expect(secondExchange.status).toBe(401);
  });

  test("Google sign-in links to an existing account when the verified email already exists", async () => {
    process.env.GOOGLE_CLIENT_ID = "test-google-client";
    process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
    process.env.OAUTH_REDIRECT_BASE = "http://localhost:3000";
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "test-handoff-encryption-key";

    const existingEmail = `existing${Date.now()}@example.com`;
    await request(app).post("/api/auth/register").send({ name: "Existing User", email: existingEmail, password: "GoodPass123" });

    const start = await request(app).get("/api/auth/google");
    const { state } = queryFromLocation(start.headers.location);

    global.fetch = jest.fn().mockImplementation((url) => {
      const u = String(url);
      if (u.startsWith("https://oauth2.googleapis.com/token")) {
        return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ access_token: "tok" }) });
      }
      return Promise.resolve({
        ok: true, status: 200,
        text: async () => JSON.stringify({ sub: "google-existing-1", email: existingEmail, email_verified: true, name: "Existing User" })
      });
    });

    const callback = await request(app).get(`/api/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);
    const { oauth_code: oauthCode } = queryFromLocation(callback.headers.location);
    const exchange = await request(app).post("/api/auth/oauth/exchange").send({ code: oauthCode });
    expect(exchange.status).toBe(200);
    expect(exchange.body.user.email).toBe(existingEmail);

    const db = require("../config/database");
    const userCount = db.prepare("SELECT COUNT(*) c FROM users WHERE email = ?").get(existingEmail).c;
    expect(userCount).toBe(1); // linked, not duplicated
  });

  test("Apple sign-in verifies the id_token signature against the provider's real JWKS shape", async () => {
    // Two independent key pairs: APPLE_PRIVATE_KEY (ours, EC) signs the
    // client_secret JWT we send to Apple. The RSA pair below simulates
    // Apple's own signing key for the id_token, which our code must verify
    // against the JWKS response - it has nothing to do with our key.
    const { privateKey: ourPrivateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const { publicKey: applePublicKey, privateKey: applePrivateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

    process.env.APPLE_CLIENT_ID = "test.apple.client";
    process.env.APPLE_TEAM_ID = "TEAMID123";
    process.env.APPLE_KEY_ID = "KEYID123";
    process.env.APPLE_PRIVATE_KEY = ourPrivateKey.export({ type: "pkcs8", format: "pem" });
    process.env.OAUTH_REDIRECT_BASE = "http://localhost:3000";
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "test-handoff-encryption-key";

    const start = await request(app).get("/api/auth/apple");
    expect(start.status).toBe(302);
    const { state } = queryFromLocation(start.headers.location);

    const idToken = jwt.sign(
      { email: "appleuser@example.com", email_verified: "true" },
      applePrivateKey,
      { algorithm: "RS256", keyid: "APPLE-SIGNING-KEY", subject: "apple-user-999", issuer: "https://appleid.apple.com", audience: "test.apple.client", expiresIn: "5m" }
    );
    const applePublicJwk = applePublicKey.export({ format: "jwk" });

    global.fetch = jest.fn().mockImplementation((url) => {
      const u = String(url);
      if (u.startsWith("https://appleid.apple.com/auth/token")) {
        return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ id_token: idToken }) });
      }
      if (u.startsWith("https://appleid.apple.com/auth/keys")) {
        return Promise.resolve({ ok: true, json: async () => ({ keys: [{ ...applePublicJwk, kid: "APPLE-SIGNING-KEY", alg: "RS256", use: "sig" }] }) });
      }
      throw new Error(`Unexpected fetch to ${u}`);
    });

    const callback = await request(app)
      .post("/api/auth/apple/callback")
      .type("form")
      .send({ code: "applecode", state, user: JSON.stringify({ name: { firstName: "Apple", lastName: "User" } }) });
    expect(callback.status).toBe(302);
    const { oauth_code: oauthCode } = queryFromLocation(callback.headers.location);
    expect(oauthCode).toBeTruthy();

    const exchange = await request(app).post("/api/auth/oauth/exchange").send({ code: oauthCode });
    expect(exchange.status).toBe(200);
    expect(exchange.body.user.email).toBe("appleuser@example.com");
  });

  test("Apple sign-in rejects an id_token with a tampered signature", async () => {
    const { privateKey: ourPrivateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const { publicKey: applePublicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const { privateKey: attackerPrivateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });

    process.env.APPLE_CLIENT_ID = "test.apple.client";
    process.env.APPLE_TEAM_ID = "TEAMID123";
    process.env.APPLE_KEY_ID = "KEYID123";
    process.env.APPLE_PRIVATE_KEY = ourPrivateKey.export({ type: "pkcs8", format: "pem" });
    process.env.OAUTH_REDIRECT_BASE = "http://localhost:3000";
    process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "test-handoff-encryption-key";

    const start = await request(app).get("/api/auth/apple");
    const { state } = queryFromLocation(start.headers.location);

    // Token is signed with the attacker's key and claims a kid that isn't
    // in Apple's published JWKS at all - simulates a forged/tampered
    // id_token that can't be matched to any legitimate signing key.
    const forgedToken = jwt.sign(
      { email: "attacker@example.com", email_verified: "true" },
      attackerPrivateKey,
      { algorithm: "RS256", keyid: "FORGED-KEY-ID", subject: "attacker-1", issuer: "https://appleid.apple.com", audience: "test.apple.client", expiresIn: "5m" }
    );
    const applePublicJwk = applePublicKey.export({ format: "jwk" });

    global.fetch = jest.fn().mockImplementation((url) => {
      const u = String(url);
      if (u.startsWith("https://appleid.apple.com/auth/token")) {
        return Promise.resolve({ ok: true, status: 200, text: async () => JSON.stringify({ id_token: forgedToken }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ keys: [{ ...applePublicJwk, kid: "APPLE-SIGNING-KEY", alg: "RS256", use: "sig" }] }) });
    });

    const callback = await request(app).post("/api/auth/apple/callback").type("form").send({ code: "x", state });
    const q = queryFromLocation(callback.headers.location);
    expect(q.oauth).toBe("error");
  });
});
