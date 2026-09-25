const express = require("express");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { validateBody, schemas } = require("../middleware/validation");

const router = express.Router();
router.use(authenticateToken);

function toApi(row) {
  return {
    theme: row.theme,
    language: row.language,
    timezone: row.timezone,
    dateFormat: row.date_format,
    emailNotifications: !!row.email_notifications,
    pushNotifications: !!row.push_notifications,
    weeklySummary: !!row.weekly_summary,
    connectionAlerts: !!row.connection_alerts,
    autoDraft: !!row.auto_draft,
    sidebarOpen: !!row.sidebar_open,
    selectedAccounts:JSON.parse(row.selected_accounts||"{}"),
    customTitles:JSON.parse(row.custom_titles||"{}")
  };
}

router.get("/", (req, res) => {
  let row = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(req.user.id);
  if (!row) {
    db.prepare("INSERT INTO user_settings (user_id) VALUES (?)").run(req.user.id);
    row = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(req.user.id);
  }
  res.json({ success: true, data: toApi(row) });
});

router.put("/", validateBody(schemas.settings), (req, res) => {
  const existing = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(req.user.id);
  if (!existing) {
    db.prepare("INSERT INTO user_settings (user_id) VALUES (?)").run(req.user.id);
  }

  const b = req.body;
  if(b.selectedAccounts){
    for(const [platform,id] of Object.entries(b.selectedAccounts)){
      if(!db.prepare("SELECT id FROM social_accounts WHERE id=? AND user_id=? AND platform=?").get(id,req.user.id,platform))return res.status(400).json({success:false,message:"Seçili hesap geçersiz."});
    }
  }
  db.prepare(`
    UPDATE user_settings SET
      selected_accounts = COALESCE(?, selected_accounts),
      custom_titles = COALESCE(?, custom_titles),
      theme = COALESCE(?, theme),
      language = COALESCE(?, language),
      timezone = COALESCE(?, timezone),
      date_format = COALESCE(?, date_format),
      email_notifications = COALESCE(?, email_notifications),
      push_notifications = COALESCE(?, push_notifications),
      weekly_summary = COALESCE(?, weekly_summary),
      connection_alerts = COALESCE(?, connection_alerts),
      auto_draft = COALESCE(?, auto_draft),
      sidebar_open = COALESCE(?, sidebar_open),
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    b.selectedAccounts ? JSON.stringify(b.selectedAccounts) : null, b.customTitles ? JSON.stringify(b.customTitles) : null,
    b.theme ?? null, b.language ?? null, b.timezone ?? null, b.dateFormat ?? null,
    b.emailNotifications === undefined ? null : (b.emailNotifications ? 1 : 0),
    b.pushNotifications === undefined ? null : (b.pushNotifications ? 1 : 0),
    b.weeklySummary === undefined ? null : (b.weeklySummary ? 1 : 0),
    b.connectionAlerts === undefined ? null : (b.connectionAlerts ? 1 : 0),
    b.autoDraft === undefined ? null : (b.autoDraft ? 1 : 0),
    b.sidebarOpen === undefined ? null : (b.sidebarOpen ? 1 : 0),
    req.user.id
  );

  const row = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(req.user.id);
  res.json({ success: true, message: "Ayarlar güncellendi.", data: toApi(row) });
});

module.exports = router;
