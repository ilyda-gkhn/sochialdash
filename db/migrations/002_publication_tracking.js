module.exports = {
  up(db) {
    const platformColumns = db.prepare("PRAGMA table_info(post_platforms)").all().map(column => column.name);
    if (!platformColumns.includes("account_id")) {
      db.prepare("ALTER TABLE post_platforms ADD COLUMN account_id INTEGER REFERENCES social_accounts(id) ON DELETE SET NULL").run();
    }

    db.prepare("CREATE INDEX IF NOT EXISTS idx_post_platforms_account ON post_platforms(account_id)").run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS post_publications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        account_id INTEGER REFERENCES social_accounts(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK(status IN ('pending', 'publishing', 'published', 'failed')),
        platform_post_id TEXT DEFAULT '',
        error_message TEXT DEFAULT '',
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_attempt_at DATETIME,
        published_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, platform)
      )
    `).run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_publications_post ON post_publications(post_id)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_publications_status ON post_publications(status)").run();
  }
};
