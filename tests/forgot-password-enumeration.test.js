require("./setup");
const request = require("supertest");
const app = require("../server");

describe("Forgot-password enumeration safety", () => {
  const originalEnv = { ...process.env };
  afterEach(() => { process.env = { ...originalEnv }; });

  test("registered and unregistered emails get an IDENTICAL response when mail is unconfigured", async () => {
    delete process.env.EMAIL_HOST;
    delete process.env.EMAIL_PORT;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;

    const registeredEmail = `registered${Date.now()}@example.com`;
    await request(app).post("/api/auth/register").send({ name: "Real User", email: registeredEmail, password: "GoodPass123" });

    const forRegistered = await request(app).post("/api/auth/forgot-password").send({ email: registeredEmail });
    const forUnregistered = await request(app).post("/api/auth/forgot-password").send({ email: "definitely-not-registered@example.com" });

    expect(forRegistered.status).toBe(200);
    expect(forUnregistered.status).toBe(200);
    // The whole response body must be indistinguishable - this is the actual
    // security property, not just the message string.
    expect(forRegistered.body).toEqual(forUnregistered.body);
    expect(forRegistered.body.mailerConfigured).toBe(false);
  });

  test("registered and unregistered emails get an IDENTICAL response when mail IS configured", async () => {
    process.env.EMAIL_HOST = "smtp.example.com";
    process.env.EMAIL_PORT = "587";
    process.env.EMAIL_USER = "user@example.com";
    process.env.EMAIL_PASS = "secret";
    process.env.EMAIL_FROM = "SocialDash <no-reply@example.com>";

    // Mock the transport so no real network call happens and delivery
    // "succeeds" regardless of whether the account exists.
    jest.resetModules();
    jest.doMock("nodemailer", () => ({
      createTransport: () => ({ sendMail: async () => ({ messageId: "mocked-id" }) })
    }));
    const mailer = require("../services/mail");

    const registeredEmail = `registered2${Date.now()}@example.com`;
    await request(app).post("/api/auth/register").send({ name: "Real User 2", email: registeredEmail, password: "GoodPass123" });

    const forRegistered = await request(app).post("/api/auth/forgot-password").send({ email: registeredEmail });
    const forUnregistered = await request(app).post("/api/auth/forgot-password").send({ email: "still-not-registered@example.com" });

    expect(forRegistered.body).toEqual(forUnregistered.body);
    expect(forRegistered.body.message).not.toMatch(/gönderilemedi|yapılandırılmadı/);

    jest.dontMock("nodemailer");
    void mailer;
  });

  test("a real send failure for a registered user is never surfaced to the caller", async () => {
    process.env.EMAIL_HOST = "smtp.example.com";
    process.env.EMAIL_PORT = "587";
    process.env.EMAIL_USER = "user@example.com";
    process.env.EMAIL_PASS = "secret";
    process.env.EMAIL_FROM = "SocialDash <no-reply@example.com>";

    const registeredEmail = `failcase${Date.now()}@example.com`;
    await request(app).post("/api/auth/register").send({ name: "Fail Case", email: registeredEmail, password: "GoodPass123" });

    // Real transport will fail to connect to smtp.example.com in this
    // sandboxed test environment - that's the point: even a genuine
    // delivery failure must not change the response shape.
    const res = await request(app).post("/api/auth/forgot-password").send({ email: registeredEmail });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("E-posta adresiniz kayıtlıysa bir sıfırlama bağlantısı gönderildi.");
  }, 15000);
});
