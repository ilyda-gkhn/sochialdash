module.exports = {
  up(db) {
    const accountColumns = new Set(db.prepare("PRAGMA table_info(account_metrics)").all().map(row => row.name));
    for (const [name, type] of [["views", "INTEGER DEFAULT 0"], ["impressions", "INTEGER DEFAULT 0"], ["clicks", "INTEGER DEFAULT 0"], ["saves", "INTEGER DEFAULT 0"], ["posts_count", "INTEGER DEFAULT 0"], ["raw_json", "TEXT"]]) {
      if (!accountColumns.has(name)) db.exec(`ALTER TABLE account_metrics ADD COLUMN ${name} ${type}`);
    }

    const postColumns = new Set(db.prepare("PRAGMA table_info(post_metrics)").all().map(row => row.name));
    for (const [name, type] of [["publication_id", "INTEGER REFERENCES post_publications(id) ON DELETE CASCADE"], ["platform", "TEXT"], ["platform_post_id", "TEXT"], ["views", "INTEGER DEFAULT 0"], ["reach", "INTEGER DEFAULT 0"], ["impressions", "INTEGER DEFAULT 0"], ["clicks", "INTEGER DEFAULT 0"], ["saves", "INTEGER DEFAULT 0"], ["raw_json", "TEXT"]]) {
      if (!postColumns.has(name)) db.exec(`ALTER TABLE post_metrics ADD COLUMN ${name} ${type}`);
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS metrics_sync_state (
        account_id INTEGER PRIMARY KEY REFERENCES social_accounts(id) ON DELETE CASCADE,
        last_success_at DATETIME,
        last_attempt_at DATETIME,
        last_error TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_account_metrics_account_captured ON account_metrics(account_id, captured_at DESC);
      CREATE INDEX IF NOT EXISTS idx_post_metrics_publication_captured ON post_metrics(publication_id, captured_at DESC);
    `);
  }
};
