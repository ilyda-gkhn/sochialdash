const express = require("express");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { AppError } = require("../middleware/errorHandler");
const socialServices = require("../services/social");
const { collectAccountMetrics } = require("../services/metrics");

const router = express.Router();
router.use(authenticateToken);

function loadOwnedAccount(req) {
  const account = db.prepare("SELECT * FROM social_accounts WHERE id = ? AND user_id = ?").get(req.params.accountId, req.user.id);
  if (!account) throw new AppError(404, "Hesap bulunamadı.");
  return account;
}

router.get("/:accountId/stats", async (req, res, next) => {
  try {
    const account = loadOwnedAccount(req);
    const service = socialServices[account.platform];
    if (!service) throw new AppError(400, "Desteklenmeyen platform.");

    let cached = db.prepare(`
      SELECT * FROM account_metrics WHERE account_id = ? ORDER BY captured_at DESC LIMIT 1
    `).get(account.id);

    if (!service.isConfigured()) {
      return res.status(200).json({
        success: true,
        configured: false,
        message: `${account.platform} için API kimlik bilgileri tanımlı olmadığından güncel istatistik alınamıyor.`,
        data: cached ? { followers: cached.followers, reach: cached.reach, engagement: cached.engagement, capturedAt: cached.captured_at } : null
      });
    }

    const fresh=cached && Date.now()-new Date(cached.captured_at).getTime()<15*60*1000;
    if(!fresh || req.query.refresh==="1") cached=await collectAccountMetrics(account.id);
    const history=db.prepare("SELECT followers,reach,engagement,views,impressions,captured_at capturedAt FROM account_metrics WHERE account_id=? ORDER BY captured_at DESC LIMIT 500").all(account.id);
    return res.json({ success: true, configured: true, data: cached, history });
  } catch (err) {
    next(err);
  }
});

router.get("/:accountId/posts", (req, res, next) => {
  try {
    const account = loadOwnedAccount(req);
    const rows = db.prepare(`
      SELECT p.*,pub.platform_post_id platformPostId,pub.published_at platformPublishedAt FROM posts p
      JOIN post_publications pub ON pub.post_id = p.id
      WHERE p.deleted_at IS NULL AND p.user_id = ? AND pub.account_id = ? AND pub.status = 'published'
      ORDER BY p.published_at DESC LIMIT 50
    `).all(req.user.id, account.id);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/:accountId/analytics", (req, res, next) => {
  try {
    const account = loadOwnedAccount(req);
    const rows = db.prepare(`
      SELECT pm.* FROM post_metrics pm
      JOIN post_publications pub ON pub.id = pm.publication_id
      JOIN posts p ON p.id = pub.post_id
      WHERE p.deleted_at IS NULL AND p.user_id = ? AND pub.account_id = ?
      ORDER BY pm.captured_at DESC LIMIT 100
    `).all(req.user.id, account.id);
    res.json({ success: true, data: rows, note: rows.length ? undefined : "Bu platform için henüz analiz verisi toplanmadı (gerçek API bağlantısı gerekir)." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
