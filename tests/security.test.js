require("./setup");
const crypto = require("crypto");
const request = require("supertest");
const app = require("../server");
const db = require("../config/database");

function currentTotp(secretHex) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hmac = crypto.createHmac("sha1", Buffer.from(secretHex, "hex")).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

describe("Session and 2FA security", () => {
  const email = `security${Date.now()}@example.com`;
  const password = "GoodPass123";

  beforeAll(async () => {
    await request(app).post("/api/auth/register").send({ name: "Security User", email, password });
  });

  test("login returns a session id and marks that session as current", async () => {
    const login = await request(app).post("/api/auth/login").send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.sessionId).toBeDefined();

    const sessions = await request(app).get("/api/security/sessions")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(sessions.status).toBe(200);
    expect(sessions.body.data.find(s => s.id === login.body.sessionId).current).toBe(true);
  });

  test("revoking a session invalidates its access token immediately", async () => {
    const login = await request(app).post("/api/auth/login").send({ email, password });
    const revoked = await request(app).delete(`/api/security/sessions/${login.body.sessionId}`)
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(revoked.status).toBe(200);

    const profile = await request(app).get("/api/profile")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(profile.status).toBe(401);
  });

  test("2FA-enabled login requires and verifies a TOTP code", async () => {
    const secretHex = crypto.randomBytes(20).toString("hex");
    db.prepare("UPDATE users SET two_factor_enabled = 1, two_factor_secret = ? WHERE email = ?")
      .run(secretHex, email);

    const missing = await request(app).post("/api/auth/login").send({ email, password });
    expect(missing.status).toBe(428);
    expect(missing.body.requiresTwoFactor).toBe(true);

    const invalid = await request(app).post("/api/auth/login")
      .send({ email, password, twoFactorToken: "000000" });
    expect(invalid.status).toBe(401);

    const valid = await request(app).post("/api/auth/login")
      .send({ email, password, twoFactorToken: currentTotp(secretHex) });
    expect(valid.status).toBe(200);
    expect(valid.body.token).toBeDefined();
  });
});
