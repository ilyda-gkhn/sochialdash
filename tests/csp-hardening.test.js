require("./setup");
const request = require("supertest");
const app = require("../server");

describe("Content-Security-Policy hardening", () => {
  test("script-src has no 'unsafe-inline' (all app JS is external, loaded via <script src>)", async () => {
    const res = await request(app).get("/");
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();

    const scriptSrc = csp.split(";").map(s => s.trim()).find(s => s.startsWith("script-src"));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toMatch(/unsafe-inline/);
    expect(scriptSrc).toMatch(/'self'/);
  });

  test("the served page has zero inline <script> blocks and zero onXXX= handlers", async () => {
    const res = await request(app).get("/");
    const html = res.text;
    // Every script tag must be external (src=...), never inline code.
    const scriptTags = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
    for (const [full, body] of scriptTags) {
      expect(full).toMatch(/\bsrc=/);
      expect(body.trim()).toBe("");
    }
    expect(html).not.toMatch(/\son(click|change|input|submit|load|error)\s*=/i);
  });
});
