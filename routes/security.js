const express = require("express");
const crypto = require("crypto");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { AppError } = require("../middleware/errorHandler");
const { base32Encode, verifyTotp } = require("../services/totp");
const { clearRefreshCookie } = require("../middleware/cookies");

const router = express.Router();
router.use(authenticateToken);

function currentSessionIdFromReq(req) {
  return req.user.sessionId;
}

router.get("/sessions", (req, res) => {
  const currentId = currentSessionIdFromReq(req);
  const sessions = db.prepare(`
    SELECT id, label, ip, created_at, last_used_at, expires_at
    FROM sessions
    WHERE user_id = ? AND revoked = 0 AND julianday(expires_at) > julianday('now')
    ORDER BY last_used_at DESC
  `).all(req.user.id).map(s => ({ ...s, current: s.id === currentId }));

  res.json({ success: true, data: sessions });
});

router.delete("/sessions/:id", (req, res, next) => {
  try {
    const session = db.prepare("SELECT * FROM sessions WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!session) throw new AppError(404, "Oturum bulunamadı.");
    db.prepare("UPDATE sessions SET revoked = 1 WHERE id = ?").run(session.id);
    if (session.id === currentSessionIdFromReq(req)) clearRefreshCookie(res);
    res.json({ success: true, message: "Oturum sonlandırıldı." });
  } catch (err) {
    next(err);
  }
});

router.post("/sessions/revoke-others", (req, res) => {
  const currentId = currentSessionIdFromReq(req);
  if (currentId) {
    db.prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ? AND id != ?").run(req.user.id, currentId);
  } else {
    db.prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ?").run(req.user.id);
  }
  res.json({ success: true, message: "Diğer tüm cihazlardan çıkış yapıldı." });
});

router.post("/sessions/revoke-all", (req, res) => {
  db.prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ?").run(req.user.id);
  clearRefreshCookie(res);
  res.json({ success: true, message: "Tüm cihazlardan çıkış yapıldı." });
});

router.post("/2fa/setup", (req, res) => {
  const secret = crypto.randomBytes(20);
  db.prepare("UPDATE users SET two_factor_secret = ? WHERE id = ?").run(secret.toString("hex"), req.user.id);
  res.json({
    success: true,
    data: {
      secretBase32: base32Encode(secret),
      otpauthUrl: `otpauth://totp/SocialDash:${req.user.id}?secret=${base32Encode(secret)}&issuer=SocialDash`
    }
  });
});

router.post("/2fa/verify", (req, res, next) => {
  try {
    const { token } = req.body || {};
    const user = db.prepare("SELECT two_factor_secret FROM users WHERE id = ?").get(req.user.id);
    if (!user?.two_factor_secret) throw new AppError(400, "Önce 2FA kurulumu yapılmalı.");
    if (!token || !verifyTotp(user.two_factor_secret, token)) {
      throw new AppError(400, "Doğrulama kodu hatalı.");
    }
    db.prepare("UPDATE users SET two_factor_enabled = 1 WHERE id = ?").run(req.user.id);
    res.json({ success: true, message: "İki faktörlü doğrulama etkinleştirildi." });
  } catch (err) {
    next(err);
  }
});

router.delete("/2fa", (req, res) => {
  db.prepare("UPDATE users SET two_factor_enabled = 0, two_factor_secret = '' WHERE id = ?").run(req.user.id);
  res.json({ success: true, message: "İki faktörlü doğrulama kapatıldı." });
});

module.exports = router;
