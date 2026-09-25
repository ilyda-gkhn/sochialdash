const express = require("express");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { AppError } = require("../middleware/errorHandler");
const { validateBody, validateQuery, schemas } = require("../middleware/validation");

const router = express.Router();
router.use(authenticateToken);

router.get("/push/public-key",(req,res)=>res.json({success:true,configured:Boolean(process.env.VAPID_PUBLIC_KEY),data:process.env.VAPID_PUBLIC_KEY||null}));
router.post("/push/subscribe",validateBody(schemas.pushSubscription),(req,res)=>{const {endpoint,keys}=req.body;db.prepare(`INSERT INTO push_subscriptions(user_id,endpoint,p256dh,auth,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)
  ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id,p256dh=excluded.p256dh,auth=excluded.auth,updated_at=CURRENT_TIMESTAMP`).run(req.user.id,endpoint,keys.p256dh,keys.auth);res.status(201).json({success:true,message:"Push bildirimleri etkinleştirildi."});});
router.delete("/push/subscribe",(req,res)=>{const endpoint=String(req.body?.endpoint||"");db.prepare("DELETE FROM push_subscriptions WHERE user_id=? AND endpoint=?").run(req.user.id,endpoint);res.json({success:true});});

router.get("/", validateQuery(schemas.notificationsQuery), (req, res) => {
  const { page, pageSize } = req.validatedQuery;
  const total = db.prepare("SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND deleted_at IS NULL").get(req.user.id).c;
  const rows = db.prepare(`
    SELECT id, type, icon, color, title, message, is_read, created_at
    FROM notifications WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(req.user.id, pageSize, (page - 1) * pageSize);
  res.json({
    success: true,
    data: rows.map(r => ({ ...r, is_read: !!r.is_read })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  });
});

router.patch("/read-all", (req, res) => {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND deleted_at IS NULL").run(req.user.id);
  res.json({ success: true, message: "Tüm bildirimler okundu olarak işaretlendi." });
});

router.patch("/:id/read", (req, res, next) => {
  try {
    const result = db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ? AND deleted_at IS NULL").run(req.params.id, req.user.id);
    if (result.changes === 0) throw new AppError(404, "Bildirim bulunamadı.");
    res.json({ success: true, message: "Bildirim okundu olarak işaretlendi." });
  } catch (err) {
    next(err);
  }
});

// Soft delete: the notification is hidden immediately but stays recoverable
// via POST /:id/restore until the cleanup job purges it (see
// services/scheduler.js), so a "delete" action can be genuinely undone.
router.delete("/", (req, res) => {
  db.prepare("UPDATE notifications SET deleted_at = CURRENT_TIMESTAMP WHERE user_id = ? AND deleted_at IS NULL").run(req.user.id);
  res.json({ success: true, message: "Tüm bildirimler temizlendi." });
});

router.delete("/:id", (req, res, next) => {
  try {
    const result = db.prepare("UPDATE notifications SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL").run(req.params.id, req.user.id);
    if (result.changes === 0) throw new AppError(404, "Bildirim bulunamadı.");
    res.json({ success: true, message: "Bildirim silindi." });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/restore", (req, res, next) => {
  try {
    const result = db.prepare("UPDATE notifications SET deleted_at = NULL WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL").run(req.params.id, req.user.id);
    if (result.changes === 0) throw new AppError(404, "Bildirim geri alınamadı: bulunamadı veya süresi geçmiş.");
    res.json({ success: true, message: "Bildirim geri alındı." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
