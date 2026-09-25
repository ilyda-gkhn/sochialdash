const express = require("express");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken);

router.get("/", (req, res) => {
  const userId = req.user.id;

  const scheduledCount = db.prepare("SELECT COUNT(*) c FROM posts WHERE deleted_at IS NULL AND user_id = ? AND status = 'scheduled'").get(userId).c;
  const publishedCount = db.prepare("SELECT COUNT(*) c FROM posts WHERE deleted_at IS NULL AND user_id = ? AND status = 'published'").get(userId).c;
  const draftCount = db.prepare("SELECT COUNT(*) c FROM posts WHERE deleted_at IS NULL AND user_id = ? AND status = 'draft'").get(userId).c;
  const failedCount = db.prepare("SELECT COUNT(*) c FROM posts WHERE deleted_at IS NULL AND user_id = ? AND status = 'failed'").get(userId).c;
  const mediaCount = db.prepare("SELECT COUNT(*) c FROM media WHERE deleted_at IS NULL AND user_id = ?").get(userId).c;
  const unreadNotifications = db.prepare("SELECT COUNT(*) c FROM notifications WHERE deleted_at IS NULL AND user_id = ? AND is_read = 0").get(userId).c;
  const connectedAccounts = db.prepare("SELECT platform, status FROM social_accounts WHERE user_id = ?").all(userId);

  const upcomingPosts = db.prepare(`
    SELECT id, title, scheduled_at, status FROM posts
    WHERE deleted_at IS NULL AND user_id = ? AND status = 'scheduled' AND scheduled_at IS NOT NULL
    ORDER BY scheduled_at ASC LIMIT 5
  `).all(userId);

  // Reach/engagement/follower totals require real connected-platform data
  // (account_metrics), which is only populated once a real social API
  // integration is configured - see services/social/*.
  const platformMetrics = db.prepare(`SELECT sa.id accountId,sa.platform,sa.account_name accountName,
    am.followers,am.reach,am.engagement,am.views,am.impressions,am.clicks,am.saves,am.posts_count postsCount,am.captured_at capturedAt
    FROM social_accounts sa LEFT JOIN account_metrics am ON am.id=(SELECT id FROM account_metrics WHERE account_id=sa.id ORDER BY captured_at DESC,id DESC LIMIT 1)
    WHERE sa.user_id=? AND am.id IS NOT NULL ORDER BY sa.platform`).all(userId);
  const hasRealMetrics = platformMetrics.length > 0;
  const totals=platformMetrics.reduce((sum,row)=>{for(const key of ["followers","reach","engagement","views","impressions","clicks","saves"])sum[key]+=Number(row[key]||0);return sum;},{followers:0,reach:0,engagement:0,views:0,impressions:0,clicks:0,saves:0});
  const metricHistory=db.prepare(`SELECT date(am.captured_at) day,SUM(am.followers) followers,SUM(am.reach) reach,SUM(am.engagement) engagement,SUM(am.views) views
    FROM account_metrics am JOIN social_accounts sa ON sa.id=am.account_id
    WHERE sa.user_id=? AND am.captured_at>=datetime('now','-30 days') AND am.id=(SELECT am2.id FROM account_metrics am2
      WHERE am2.account_id=am.account_id AND date(am2.captured_at)=date(am.captured_at) ORDER BY am2.captured_at DESC,am2.id DESC LIMIT 1)
    GROUP BY date(am.captured_at) ORDER BY day`).all(userId);

  res.json({
    success: true,
    data: {
      posts: { scheduled: scheduledCount, published: publishedCount, draft: draftCount, failed: failedCount },
      media: { total: mediaCount },
      notifications: { unread: unreadNotifications },
      accounts: connectedAccounts,
      upcomingPosts,
      platformMetrics: hasRealMetrics
        ? platformMetrics
        : null,
      platformTotals: hasRealMetrics ? totals : null,
      platformMetricHistory: metricHistory,
      platformMetricsNote: hasRealMetrics ? undefined : "Takipçi/erişim/etkileşim toplamları için gerçek platform API bağlantısı gereklidir."
    }
  });
});

module.exports = router;
