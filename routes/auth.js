const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");
const { validateBody, schemas } = require("../middleware/validation");
const { AppError } = require("../middleware/errorHandler");
const mailer = require("../services/mail");
const { verifyTotp } = require("../services/totp");
const { setRefreshCookie, clearRefreshCookie, getRefreshCookie } = require("../middleware/cookies");

const router = express.Router();

const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_EXPIRES_DAYS = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30);

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signAccessToken(user, sessionId) {
  return jwt.sign({ id: user.id, sid: sessionId }, process.env.JWT_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
}

function createSession(userId, { remember, ip, userAgent }) {
  const sessionId = crypto.randomUUID();
  const refreshToken = crypto.randomBytes(48).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    INSERT INTO sessions (id, user_id, refresh_token_hash, label, ip, user_agent, remember, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sessionId, userId, hashToken(refreshToken), `${userAgent || "Bilinmeyen cihaz"}`, ip || "", userAgent || "", remember ? 1 : 0, expiresAt);

  return { sessionId, refreshToken };
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    username: user.username,
    title: user.title,
    country: user.country,
    profile_image: user.profile_image,
    plan: user.plan,
    two_factor_enabled: !!user.two_factor_enabled,
    created_at: user.created_at
  };
}

router.post("/register", authLimiter, validateBody(schemas.register), async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const normalizedEmail = req.body.email.trim().toLowerCase();

    const existingUser = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
    if (existingUser) {
      throw new AppError(409, "Bu e-posta adresi zaten kayıtlı.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = db.prepare(`
      INSERT INTO users (name, email, password) VALUES (?, ?, ?)
    `).run(name.trim(), normalizedEmail, hashedPassword);

    db.prepare(`INSERT INTO user_settings (user_id) VALUES (?)`).run(result.lastInsertRowid);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
    db.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);

    // Register uses the exact same session/token mechanism as login, so the
    // frontend can authenticate the user immediately without a second round trip.
    const { sessionId, refreshToken } = createSession(user.id, {
      remember: true,
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });
    const accessToken = signAccessToken(user, sessionId);
    setRefreshCookie(res, refreshToken, { remember: true });

    return res.status(201).json({
      success: true,
      message: "Kayıt başarılı.",
      token: accessToken,
      refreshToken,
      sessionId,
      user: publicUser(user)
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", authLimiter, validateBody(schemas.login), async (req, res, next) => {
  try {
    const normalizedEmail = req.body.email.trim().toLowerCase();
    const { password, remember, twoFactorToken } = req.body;

    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
    if (!user) throw new AppError(401, "E-posta veya şifre hatalı.");

    const passwordCorrect = await bcrypt.compare(password, user.password);
    if (!passwordCorrect) throw new AppError(401, "E-posta veya şifre hatalı.");

    if (user.two_factor_enabled && !twoFactorToken) {
      return res.status(428).json({
        success: false,
        requiresTwoFactor: true,
        message: "İki faktörlü doğrulama kodu gerekli.",
        error: { code: "TWO_FACTOR_REQUIRED", message: "İki faktörlü doğrulama kodu gerekli." }
      });
    }
    if (user.two_factor_enabled && !verifyTotp(user.two_factor_secret, twoFactorToken)) {
      throw new AppError(401, "Doğrulama kodu hatalı.");
    }

    db.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);

    const { sessionId, refreshToken } = createSession(user.id, {
      remember,
      ip: req.ip,
      userAgent: req.headers["user-agent"]
    });
    const accessToken = signAccessToken(user, sessionId);
    setRefreshCookie(res, refreshToken, { remember });

    return res.json({
      success: true,
      message: "Giriş başarılı.",
      token: accessToken,
      refreshToken,
      sessionId,
      user: publicUser(user)
    });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", validateBody(schemas.refresh), (req, res, next) => {
  try {
    // Prefer the HttpOnly cookie (browser flow); fall back to the request
    // body for non-browser API clients that don't carry cookies.
    const refreshToken = getRefreshCookie(req) || req.body.refreshToken;
    if (!refreshToken) throw new AppError(400, "Refresh token eksik.");
    const tokenHash = hashToken(refreshToken);

    const session = db.prepare(`
      SELECT * FROM sessions WHERE refresh_token_hash = ?
    `).get(tokenHash);

    if (!session || session.revoked || new Date(session.expires_at) < new Date()) {
      // Reuse detection: if this exact token matches a hash we already
      // rotated away from, someone is replaying a stolen refresh token.
      // Treat it as a security incident and revoke the whole session family.
      const reused = db.prepare(`
        SELECT * FROM sessions WHERE previous_refresh_token_hash = ? AND revoked = 0
      `).get(tokenHash);
      if (reused) {
        db.prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ?").run(reused.user_id);
        clearRefreshCookie(res);
        throw new AppError(
          401,
          "Oturum güvenliği ihlali tespit edildi. Tüm oturumlar sonlandırıldı, lütfen tekrar giriş yapın.",
          "REFRESH_TOKEN_REUSE"
        );
      }
      throw new AppError(401, "Oturum geçersiz. Lütfen tekrar giriş yapın.");
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id);
    if (!user) throw new AppError(401, "Kullanıcı bulunamadı.");

    // rotate refresh token to prevent reuse, keeping the outgoing hash so
    // a replay of this exact token can be detected as reuse next time.
    const newRefreshToken = crypto.randomBytes(48).toString("hex");
    db.prepare(`
      UPDATE sessions SET refresh_token_hash = ?, previous_refresh_token_hash = ?, last_used_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(hashToken(newRefreshToken), tokenHash, session.id);

    const accessToken = signAccessToken(user, session.id);
    setRefreshCookie(res, newRefreshToken, { remember: !!session.remember });
    return res.json({ success: true, token: accessToken, refreshToken: newRefreshToken, sessionId: session.id });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", validateBody(schemas.refresh), (req, res, next) => {
  try {
    const refreshToken = getRefreshCookie(req) || req.body.refreshToken;
    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);
      db.prepare("UPDATE sessions SET revoked = 1 WHERE refresh_token_hash = ?").run(tokenHash);
    }
    clearRefreshCookie(res);
    return res.json({ success: true, message: "Çıkış yapıldı." });
  } catch (err) {
    next(err);
  }
});

router.post("/forgot-password", authLimiter, validateBody(schemas.forgotPassword), async (req, res, next) => {
  try {
    const normalizedEmail = req.body.email.trim().toLowerCase();
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);

    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      db.prepare(`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)
      `).run(user.id, hashToken(rawToken), expiresAt);

      const sent = await mailer.sendPasswordResetEmail(user.email, rawToken);
      // Any per-request send failure (transient SMTP error, etc.) is logged
      // for operators but never surfaced to the caller: doing so would let
      // an attacker distinguish "registered email, mail failed" from
      // "unregistered email" by comparing response bodies.
      if (!sent.ok) console.error(`[forgot-password] gönderim başarısız (${sent.reason}) — user #${user.id}`);
    }

    // The response depends only on GLOBAL mailer configuration (a static
    // server setting, not per-email information), never on whether this
    // specific address is registered or whether its send happened to
    // succeed - that would leak account existence.
    if (!mailer.isConfigured()) {
      return res.json({
        success: true,
        message: "İstek alındı, ancak e-posta servisi şu anda yapılandırılmadı. Lütfen daha sonra tekrar deneyin.",
        mailerConfigured: false
      });
    }

    return res.json({ success: true, message: "E-posta adresiniz kayıtlıysa bir sıfırlama bağlantısı gönderildi." });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", authLimiter, validateBody(schemas.resetPassword), async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const tokenHash = hashToken(token);

    const resetRow = db.prepare(`
      SELECT * FROM password_reset_tokens WHERE token_hash = ?
    `).get(tokenHash);

    if (!resetRow || resetRow.used || new Date(resetRow.expires_at) < new Date()) {
      throw new AppError(400, "Sıfırlama bağlantısı geçersiz veya süresi dolmuş.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    db.prepare("UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(hashedPassword, resetRow.user_id);
    db.prepare("UPDATE password_reset_tokens SET used = 1 WHERE id = ?").run(resetRow.id);
    db.prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ?").run(resetRow.user_id);
    clearRefreshCookie(res);

    return res.json({ success: true, message: "Şifre başarıyla güncellendi." });
  } catch (err) {
    next(err);
  }
});

router.put("/password", authenticateToken, validateBody(schemas.changePassword), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!user) throw new AppError(404, "Kullanıcı bulunamadı.");

    const correct = await bcrypt.compare(currentPassword, user.password);
    if (!correct) throw new AppError(401, "Mevcut şifre hatalı.");

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.prepare("UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(hashedPassword, user.id);
    db.prepare("UPDATE sessions SET revoked = 1 WHERE user_id = ? AND id != ?").run(user.id, req.user.sessionId);

    return res.json({ success: true, message: "Şifre başarıyla değiştirildi." });
  } catch (err) {
    next(err);
  }
});

module.exports = { router, publicUser, createSession, signAccessToken, hashToken };
