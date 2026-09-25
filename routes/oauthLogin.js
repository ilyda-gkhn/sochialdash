const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const db = require("../config/database");
const { AppError } = require("../middleware/errorHandler");
const { authLimiter } = require("../middleware/rateLimit");
const { encrypt, decrypt } = require("../services/tokenVault");
const { setRefreshCookie } = require("../middleware/cookies");
const providers = require("../services/oauthLogin");
const { createSession, signAccessToken, publicUser } = require("./auth");

const router = express.Router();

function stateHash(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }

function redirectToFrontend(res, params) {
  const query = new URLSearchParams(params);
  return res.redirect(`/?${query}`);
}

function beginLogin(provider) {
  return (req, res) => {
    const service = providers[provider];
    if (!service.isConfigured()) {
      return redirectToFrontend(res, {
        oauth: "error",
        provider,
        message: `${provider === "google" ? "Google" : "Apple"} ile giriş yapılandırılmadı.`
      });
    }
    const state = crypto.randomBytes(32).toString("base64url");
    const verifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const remember = req.query.remember === "1" ? 1 : 0;

    db.prepare("DELETE FROM oauth_login_states WHERE julianday(expires_at) <= julianday('now')").run();
    db.prepare(`INSERT INTO oauth_login_states (state_hash, provider, code_verifier, remember, expires_at)
      VALUES (?, ?, ?, ?, ?)`)
      .run(stateHash(state), provider, verifier, remember, new Date(Date.now() + 10 * 60 * 1000).toISOString());

    return res.redirect(service.getAuthorizationUrl({ state, codeChallenge: challenge }));
  };
}

// One local account per verified email: an OAuth sign-in either attaches to
// an existing account with a matching *verified* email, or creates a new
// one. An unverified provider email is never trusted to match an existing
// account, since that would let an attacker with an unverified address on
// the provider's side take over someone else's SocialDash account.
function findOrCreateUser({ provider, providerUserId, email, emailVerified, name }) {
  const existingIdentity = db.prepare(`
    SELECT u.* FROM oauth_identities oi JOIN users u ON u.id = oi.user_id
    WHERE oi.provider = ? AND oi.provider_user_id = ?
  `).get(provider, providerUserId);
  if (existingIdentity) return existingIdentity;

  if (!email) throw new AppError(400, "Sağlayıcı bir e-posta adresi döndürmedi.", "OAUTH_NO_EMAIL");

  let user = null;
  if (emailVerified) {
    user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  }

  const linkIdentity = (userId) => {
    db.prepare(`INSERT INTO oauth_identities (user_id, provider, provider_user_id, email) VALUES (?, ?, ?, ?)`)
      .run(userId, provider, providerUserId, email);
  };

  if (user) {
    linkIdentity(user.id);
    return user;
  }

  try {
    // OAuth-only accounts get an unusable random password hash; the user
    // can set a real password later via "forgot password" if they want to
    // also be able to log in without the provider.
    const unusablePassword = bcrypt.hashSync(crypto.randomBytes(32).toString("hex"), 10);
    const result = db.prepare(`INSERT INTO users (name, email, password) VALUES (?, ?, ?)`)
      .run((name || email.split("@")[0]).slice(0, 120), email, unusablePassword);
    db.prepare(`INSERT INTO user_settings (user_id) VALUES (?)`).run(result.lastInsertRowid);
    linkIdentity(result.lastInsertRowid);
    return db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
  } catch (err) {
    if (String(err.message || "").includes("UNIQUE")) {
      throw new AppError(
        409,
        "Bu e-posta adresi zaten farklı bir yöntemle (şifre ile) kayıtlı. Lütfen şifrenizle giriş yapın.",
        "OAUTH_EMAIL_CONFLICT"
      );
    }
    throw err;
  }
}

function issueHandoffCode(user, req) {
  const { sessionId, refreshToken } = createSession(user.id, {
    remember: true,
    ip: req.ip,
    userAgent: req.headers["user-agent"]
  });
  const accessToken = signAccessToken(user, sessionId);
  const payload = JSON.stringify({
    token: accessToken,
    refreshToken,
    sessionId,
    user: publicUser(user)
  });

  const code = crypto.randomBytes(32).toString("base64url");
  db.prepare("DELETE FROM oauth_handoff_codes WHERE julianday(expires_at) <= julianday('now')").run();
  db.prepare(`INSERT INTO oauth_handoff_codes (code_hash, payload, expires_at) VALUES (?, ?, ?)`)
    .run(stateHash(code), encrypt(payload), new Date(Date.now() + 60 * 1000).toISOString());

  return code;
}

router.get("/google", authLimiter, beginLogin("google"));
router.get("/apple", authLimiter, beginLogin("apple"));

router.get("/google/callback", authLimiter, async (req, res) => {
  const provider = "google";
  try {
    if (req.query.error) {
      return redirectToFrontend(res, { oauth: "cancelled", provider, message: String(req.query.error) });
    }
    if (!req.query.code || !req.query.state) {
      return redirectToFrontend(res, { oauth: "error", provider, message: "Eksik OAuth yanıtı." });
    }
    const state = db.prepare(`
      SELECT * FROM oauth_login_states WHERE state_hash = ? AND provider = ? AND julianday(expires_at) > julianday('now')
    `).get(stateHash(req.query.state), provider);
    if (!state) return redirectToFrontend(res, { oauth: "error", provider, message: "OAuth oturumu geçersiz veya süresi dolmuş." });
    db.prepare("DELETE FROM oauth_login_states WHERE state_hash = ?").run(state.state_hash);

    const service = providers.google;
    if (!service.isConfigured()) return redirectToFrontend(res, { oauth: "error", provider, message: "Google yapılandırması eksik." });

    const tokens = await service.exchangeCode(String(req.query.code), state.code_verifier);
    if (!tokens.access_token) throw new Error("Google access token döndürmedi.");
    const profile = await service.fetchProfile(tokens.access_token);

    const user = findOrCreateUser({
      provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
      emailVerified: profile.emailVerified,
      name: profile.name
    });
    db.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);

    const code = issueHandoffCode(user, req);
    return redirectToFrontend(res, { oauth_code: code });
  } catch (err) {
    console.error("[oauth:google]", err.message);
    const status = err.status || 500;
    return redirectToFrontend(res, { oauth: status === 409 ? "conflict" : "error", provider, message: err.message });
  }
});

router.post("/apple/callback", authLimiter, express.urlencoded({ extended: false }), async (req, res) => {
  const provider = "apple";
  try {
    if (req.body.error) {
      return redirectToFrontend(res, { oauth: "cancelled", provider, message: String(req.body.error) });
    }
    if (!req.body.code || !req.body.state) {
      return redirectToFrontend(res, { oauth: "error", provider, message: "Eksik OAuth yanıtı." });
    }
    const state = db.prepare(`
      SELECT * FROM oauth_login_states WHERE state_hash = ? AND provider = ? AND julianday(expires_at) > julianday('now')
    `).get(stateHash(req.body.state), provider);
    if (!state) return redirectToFrontend(res, { oauth: "error", provider, message: "OAuth oturumu geçersiz veya süresi dolmuş." });
    db.prepare("DELETE FROM oauth_login_states WHERE state_hash = ?").run(state.state_hash);

    const service = providers.apple;
    if (!service.isConfigured()) return redirectToFrontend(res, { oauth: "error", provider, message: "Apple yapılandırması eksik." });

    const tokens = await service.exchangeCode(String(req.body.code), state.code_verifier);
    if (!tokens.id_token) throw new Error("Apple id_token döndürmedi.");
    const profile = await service.verifyIdToken(tokens.id_token);

    // Apple only sends the user's name once, as a JSON string in the `user`
    // form field, on the very first authorization - never again after that.
    let name = "";
    if (req.body.user) {
      try {
        const parsed = JSON.parse(req.body.user);
        name = [parsed?.name?.firstName, parsed?.name?.lastName].filter(Boolean).join(" ");
      } catch (_) { /* ignore malformed/absent name payload */ }
    }

    const user = findOrCreateUser({
      provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
      emailVerified: profile.emailVerified,
      name
    });
    db.prepare("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);

    const code = issueHandoffCode(user, req);
    return redirectToFrontend(res, { oauth_code: code });
  } catch (err) {
    console.error("[oauth:apple]", err.message);
    const status = err.status || 500;
    return redirectToFrontend(res, { oauth: status === 409 ? "conflict" : "error", provider, message: err.message });
  }
});

// The SPA calls this once, immediately after being redirected back with
// ?oauth_code=..., to exchange the opaque one-time code for real tokens.
router.post("/oauth/exchange", authLimiter, (req, res, next) => {
  try {
    const code = String(req.body?.code || "");
    if (!code) throw new AppError(400, "Kod eksik.");
    const row = db.prepare(`
      SELECT * FROM oauth_handoff_codes WHERE code_hash = ? AND julianday(expires_at) > julianday('now')
    `).get(stateHash(code));
    if (!row) throw new AppError(401, "Kod geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.", "OAUTH_CODE_INVALID");
    db.prepare("DELETE FROM oauth_handoff_codes WHERE code_hash = ?").run(row.code_hash);
    const payload = JSON.parse(decrypt(row.payload));
    setRefreshCookie(res, payload.refreshToken, { remember: true });
    return res.json({ success: true, ...payload });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
