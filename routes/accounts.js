const express = require("express");
const crypto = require("crypto");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { validateBody, schemas } = require("../middleware/validation");
const { AppError } = require("../middleware/errorHandler");
const socialServices = require("../services/social");
const { encrypt, decrypt } = require("../services/tokenVault");

const router = express.Router();

function stateHash(value) { return crypto.createHash("sha256").update(String(value)).digest("hex"); }
function oauthRedirect(res, status, platform, message = "") {
  const params = new URLSearchParams({ oauth: status, platform });
  if (message) params.set("message", message.slice(0, 180));
  return res.redirect(`/?${params}`);
}

// OAuth providers cannot send the app's Bearer token back to this callback.
// A short-lived, one-time state record safely binds the callback to the user.
router.get("/:platform/callback", async (req, res) => {
  const platform = String(req.params.platform || "").toLowerCase();
  try {
    if (req.query.error) return oauthRedirect(res, "cancelled", platform, String(req.query.error_description || req.query.error));
    if (!req.query.code || !req.query.state) return oauthRedirect(res, "error", platform, "Eksik OAuth yanıtı.");
    const state = db.prepare(`
      SELECT * FROM oauth_states WHERE state_hash = ? AND platform = ? AND julianday(expires_at) > julianday('now')
    `).get(stateHash(req.query.state), platform);
    if (!state) return oauthRedirect(res, "error", platform, "OAuth oturumu geçersiz veya süresi dolmuş.");
    db.prepare("DELETE FROM oauth_states WHERE state_hash = ?").run(state.state_hash);
    const service = socialServices[platform];
    if (!service?.isConfigured()) return oauthRedirect(res, "error", platform, "Platform yapılandırması eksik.");

    const tokens = await service.exchangeCode(String(req.query.code), state.code_verifier);
    if (!tokens.access_token) throw new Error("Sağlayıcı access token döndürmedi.");
    const profiles = await service.fetchProfiles(tokens.access_token);
    if (!profiles.length) throw new Error("Yayınlanabilir hesap veya sayfa bulunamadı.");
    const expiresAt = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString() : null;
    db.transaction(() => {
      for (const profile of profiles) {
        const profileAccessToken = profile.accessToken || tokens.access_token;
        const existing = db.prepare("SELECT id FROM social_accounts WHERE user_id = ? AND platform = ? AND platform_user_id = ?").get(state.user_id, platform, String(profile.id));
        if (existing) {
          db.prepare(`UPDATE social_accounts SET account_name = ?, username = ?, access_token = ?, refresh_token = ?,
            token_expires_at = ?, token_type = ?, scopes = ?, status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(profile.name || profile.username || platform, profile.username || "", encrypt(profileAccessToken), encrypt(tokens.refresh_token || ""), expiresAt, tokens.token_type || "Bearer", tokens.scope || "", existing.id);
        } else {
          db.prepare(`INSERT INTO social_accounts
            (user_id, platform, platform_user_id, account_name, username, access_token, refresh_token, token_expires_at, token_type, scopes, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected')`)
            .run(state.user_id, platform, String(profile.id), profile.name || profile.username || platform, profile.username || "", encrypt(profileAccessToken), encrypt(tokens.refresh_token || ""), expiresAt, tokens.token_type || "Bearer", tokens.scope || "");
        }
      }
    })();
    return oauthRedirect(res, "success", platform);
  } catch (err) {
    console.error(`[oauth:${platform}]`, err.message);
    return oauthRedirect(res, "error", platform, err.message);
  }
});

router.use(authenticateToken);

function toApi(row) {
  // Never return access_token / refresh_token to the client.
  return {
    id: row.id,
    platform: row.platform,
    accountName: row.account_name,
    username: row.username,
    status: row.status,
    tokenExpiresAt: row.token_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    metrics: row.metric_id ? {
      followers: row.followers, reach: row.reach, engagement: row.engagement, views: row.views,
      impressions: row.impressions, clicks: row.clicks, saves: row.saves, postsCount: row.posts_count,
      capturedAt: row.metric_captured_at
    } : null,
    metricsError: row.last_error || null
  };
}

const accountSelect=`SELECT sa.*,am.id metric_id,am.followers,am.reach,am.engagement,am.views,am.impressions,am.clicks,am.saves,am.posts_count,
  am.captured_at metric_captured_at,mss.last_error FROM social_accounts sa
  LEFT JOIN account_metrics am ON am.id=(SELECT id FROM account_metrics WHERE account_id=sa.id ORDER BY captured_at DESC,id DESC LIMIT 1)
  LEFT JOIN metrics_sync_state mss ON mss.account_id=sa.id`;

router.get("/", (req, res) => {
  const rows = db.prepare(`${accountSelect} WHERE sa.user_id = ? ORDER BY sa.platform`).all(req.user.id);
  res.json({ success: true, data: rows.map(toApi) });
});

router.get("/:id", (req, res, next) => {
  try {
    const row = db.prepare(`${accountSelect} WHERE sa.id = ? AND sa.user_id = ?`).get(req.params.id, req.user.id);
    if (!row) throw new AppError(404, "Hesap bulunamadı.");
    res.json({ success: true, data: toApi(row) });
  } catch (err) {
    next(err);
  }
});

// Begins a real OAuth connection where infrastructure exists. Since no
// platform app credentials are configured, this reports that honestly
// instead of pretending the account got connected.
router.post("/connect", validateBody(schemas.accountConnect), (req, res, next) => {
  try {
    const { platform } = req.body;
    const service = socialServices[platform];
    if (!service) throw new AppError(400, "Desteklenmeyen platform.");

    const state = crypto.randomBytes(32).toString("base64url");
    const verifier = crypto.randomBytes(48).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const result = service.getAuthorizationUrl({ state, codeChallenge: challenge });
    if (!result.configured) {
      const message = `${platform} için API kimlik bilgileri (.env) tanımlanmadığından gerçek bağlantı kurulamıyor.`;
      return res.status(501).json({
        success: false,
        message,
        error: { code: "PLATFORM_NOT_CONFIGURED", message },
        requiredEnv: result.requiredEnv
      });
    }

    db.prepare("DELETE FROM oauth_states WHERE julianday(expires_at) <= julianday('now')").run();
    db.prepare(`INSERT INTO oauth_states (state_hash, user_id, platform, code_verifier, expires_at)
      VALUES (?, ?, ?, ?, ?)`)
      .run(stateHash(state), req.user.id, platform, verifier, new Date(Date.now() + 10 * 60 * 1000).toISOString());

    return res.json({ success: true, authorizationUrl: result.url });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM social_accounts WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!row) throw new AppError(404, "Hesap bulunamadı.");
    const accountName = String(req.body?.accountName ?? row.account_name);
    db.prepare("UPDATE social_accounts SET account_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(accountName, row.id);
    res.json({ success: true, data: toApi(db.prepare("SELECT * FROM social_accounts WHERE id = ?").get(row.id)) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", (req, res, next) => {
  try {
    const result = db.prepare("DELETE FROM social_accounts WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id);
    if (result.changes === 0) throw new AppError(404, "Hesap bulunamadı.");
    res.json({ success: true, message: "Hesap bağlantısı kaldırıldı." });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/refresh", async (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM social_accounts WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id);
    if (!row) throw new AppError(404, "Hesap bulunamadı.");
    const service = socialServices[row.platform];
    if (!service || !service.isConfigured()) {
      const message = `${row.platform} için API kimlik bilgileri tanımlı olmadığından token yenilenemiyor.`;
      return res.status(501).json({ success: false, message, error: { code: "PLATFORM_NOT_CONFIGURED", message } });
    }
    const refresh = decrypt(row.refresh_token);
    if (!refresh) throw new AppError(400, "Bu hesap için refresh token bulunmuyor; hesabı yeniden bağlayın.");
    const tokens = await service.refreshToken(refresh);
    const expiresAt = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString() : row.token_expires_at;
    db.prepare(`UPDATE social_accounts SET access_token = ?, refresh_token = ?, token_expires_at = ?,
      token_type = ?, scopes = ?, status = 'connected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(encrypt(tokens.access_token), encrypt(tokens.refresh_token || refresh), expiresAt, tokens.token_type || row.token_type || "Bearer", tokens.scope || row.scopes || "", row.id);
    return res.json({ success: true, message: "Erişim anahtarı yenilendi.", data: toApi(db.prepare("SELECT * FROM social_accounts WHERE id = ?").get(row.id)) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
