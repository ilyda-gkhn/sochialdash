require("./setup");
const request = require("supertest");
const app = require("../server");
const db = require("../config/database");

async function registerAndLogin(email) {
  const password = "GoodPass123";
  await request(app).post("/api/auth/register").send({ name: "Notif User", email, password });
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.token;
}

describe("Notification soft-delete and restore (real undo)", () => {
  let token, userId, notifId;

  beforeAll(async () => {
    const email = `notifundo${Date.now()}@example.com`;
    token = await registerAndLogin(email);
    userId = db.prepare("SELECT id FROM users WHERE email = ?").get(email).id;
    const result = db.prepare(
      "INSERT INTO notifications (user_id, type, title, message) VALUES (?, 'system', ?, ?)"
    ).run(userId, "Test Notification", "test body");
    notifId = result.lastInsertRowid;
  });

  test("DELETE soft-deletes: notification disappears from list but row still exists", async () => {
    const del = await request(app).delete(`/api/notifications/${notifId}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);

    const list = await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`);
    expect(list.body.data.find(n => n.id === notifId)).toBeUndefined();

    const row = db.prepare("SELECT deleted_at FROM notifications WHERE id = ?").get(notifId);
    expect(row.deleted_at).not.toBeNull();
  });

  test("POST /:id/restore brings it back", async () => {
    const restore = await request(app).post(`/api/notifications/${notifId}/restore`).set("Authorization", `Bearer ${token}`);
    expect(restore.status).toBe(200);

    const list = await request(app).get("/api/notifications").set("Authorization", `Bearer ${token}`);
    expect(list.body.data.find(n => n.id === notifId)).toBeDefined();

    const row = db.prepare("SELECT deleted_at FROM notifications WHERE id = ?").get(notifId);
    expect(row.deleted_at).toBeNull();
  });

  test("restoring an already-active (non-deleted) notification 404s", async () => {
    const res = await request(app).post(`/api/notifications/${notifId}/restore`).set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test("restoring someone else's notification is rejected", async () => {
    const otherToken = await registerAndLogin(`otherundo${Date.now()}@example.com`);
    await request(app).delete(`/api/notifications/${notifId}`).set("Authorization", `Bearer ${token}`);
    const res = await request(app).post(`/api/notifications/${notifId}/restore`).set("Authorization", `Bearer ${otherToken}`);
    expect(res.status).toBe(404);
  });

  test("scheduler purge job removes only notifications soft-deleted long ago", () => {
    const { purgeOldDeletedNotifications } = require("../services/scheduler");
    const oldResult = db.prepare(
      "INSERT INTO notifications (user_id, type, title, message, deleted_at) VALUES (?, 'system', 'old', 'old', datetime('now','-40 days'))"
    ).run(userId);
    const recentResult = db.prepare(
      "INSERT INTO notifications (user_id, type, title, message, deleted_at) VALUES (?, 'system', 'recent', 'recent', datetime('now','-1 days'))"
    ).run(userId);

    purgeOldDeletedNotifications();

    const oldRow = db.prepare("SELECT id FROM notifications WHERE id = ?").get(oldResult.lastInsertRowid);
    const recentRow = db.prepare("SELECT id FROM notifications WHERE id = ?").get(recentResult.lastInsertRowid);
    expect(oldRow).toBeUndefined();
    expect(recentRow).toBeDefined();
  });
});
