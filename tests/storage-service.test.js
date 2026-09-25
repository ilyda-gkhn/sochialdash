require("./setup");
const request = require("supertest");
const fs = require("fs");
const app = require("../server");

function validPngBuffer(width, height) {
  const header = Buffer.alloc(24);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(header);
  header.writeUInt32BE(width, 16);
  header.writeUInt32BE(height, 20);
  return header;
}

async function registerAndLogin(email) {
  const password = "GoodPass123";
  await request(app).post("/api/auth/register").send({ name: "Storage User", email, password });
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

describe("Storage abstraction (services/storageService.js) end-to-end", () => {
  let token;

  beforeAll(async () => {
    token = await registerAndLogin(`storagetest${Date.now()}@example.com`);
  });

  test("media upload actually writes the file to disk via the custom storage engine", async () => {
    const buf = validPngBuffer(64, 64);
    const res = await request(app)
      .post("/api/media")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", buf, { filename: "test.png", contentType: "image/png" });

    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/^\/uploads\/media\//);

    const filename = res.body.data.url.split("/").pop();
    const diskPath = require("path").join(__dirname, "..", "uploads", "media", filename);
    expect(fs.existsSync(diskPath)).toBe(true);

    // Serving the file back over HTTP proves the public URL is correct too.
    const fileRes = await request(app).get(res.body.data.url);
    expect(fileRes.status).toBe(200);

    // Soft deletion hides the library record while preserving bytes for real undo.
    const del = await request(app).delete(`/api/media/${res.body.data.id}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(fs.existsSync(diskPath)).toBe(true);
    const hidden=await request(app).get(`/api/media/${res.body.data.id}`).set("Authorization", `Bearer ${token}`);
    expect(hidden.status).toBe(404);
    const restored=await request(app).post(`/api/media/${res.body.data.id}/restore`).set("Authorization", `Bearer ${token}`);
    expect(restored.status).toBe(200);
    expect(restored.body.data.id).toBe(res.body.data.id);
    expect((await request(app).get(restored.body.data.url)).status).toBe(200);
    fs.unlinkSync(diskPath);
  });

  test("avatar upload writes to disk and replacing it deletes the old file", async () => {
    const first = await request(app)
      .post("/api/profile/avatar")
      .set("Authorization", `Bearer ${token}`)
      .attach("avatar", validPngBuffer(32, 32), { filename: "a1.png", contentType: "image/png" });
    expect(first.status).toBe(200);
    const firstPath = require("path").join(__dirname, "..", "uploads", "avatars", first.body.profile_image.split("/").pop());
    expect(fs.existsSync(firstPath)).toBe(true);

    const second = await request(app)
      .post("/api/profile/avatar")
      .set("Authorization", `Bearer ${token}`)
      .attach("avatar", validPngBuffer(32, 32), { filename: "a2.png", contentType: "image/png" });
    expect(second.status).toBe(200);

    await new Promise(r => setTimeout(r, 100));
    // Old avatar file must be gone once replaced.
    expect(fs.existsSync(firstPath)).toBe(false);

    const del = await request(app).delete("/api/profile/avatar").set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);
  });

  test("an unsupported MEDIA_STORAGE_PROVIDER fails fast with a clear error", () => {
    const { createStorage } = require("../services/storageService");
    const original = process.env.MEDIA_STORAGE_PROVIDER;
    process.env.MEDIA_STORAGE_PROVIDER = "s3";
    expect(() => createStorage("media")).toThrow(/not implemented/);
    process.env.MEDIA_STORAGE_PROVIDER = original;
  });
});
