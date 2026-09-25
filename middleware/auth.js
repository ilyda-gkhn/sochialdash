const jwt = require("jsonwebtoken");
const db = require("../config/database");

function authError(res, status, code, message) {
  return res.status(status).json({ success: false, message, error: { code, message } });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return authError(res, 401, "NO_TOKEN", "Token bulunamadı.");
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) {
      return authError(res, 403, "INVALID_TOKEN", "Geçersiz veya süresi dolmuş token.");
    }
    if (!payload.sid) {
      return authError(res, 403, "SESSION_MISSING", "Oturum bilgisi eksik. Lütfen tekrar giriş yapın.");
    }

    const session = db.prepare(`
      SELECT id FROM sessions
      WHERE id = ? AND user_id = ? AND revoked = 0 AND julianday(expires_at) > julianday('now')
    `).get(payload.sid, payload.id);
    if (!session) {
      return authError(res, 401, "SESSION_EXPIRED", "Oturum sonlandırılmış veya süresi dolmuş.");
    }

    req.user = { id: payload.id, sessionId: payload.sid };
    next();
  });
}

module.exports = { authenticateToken };
