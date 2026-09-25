module.exports = {
  up(db) {
    // Rebuild post_publications with an added CHECK constraint (SQLite has
    // no ALTER TABLE ADD CONSTRAINT, so rename-copy-drop is the standard
    // way to do this). Guarded so the migration is safe to re-run even if
    // it's ever re-invoked outside the normal schema_migrations tracking
    // (e.g. a corrupted tracking row) rather than assuming it only ever
    // runs once.
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").all("post_publications");
    const hasOld = tables.length > 0;
    const columns = hasOld ? db.prepare("PRAGMA table_info(post_publications)").all() : [];
    // next_attempt_at/last_status_check_at/error_type only exist after this
    // migration's rebuild - their presence is the reliable idempotency
    // marker (migration 002's original table also has a CHECK(status IN
    // ...) clause, just with a different value list, so checking for that
    // substring alone would false-positive on the very first run).
    const alreadyRebuilt = columns.some(c => c.name === "next_attempt_at");

    if (hasOld && !alreadyRebuilt) {
      db.prepare("ALTER TABLE post_publications RENAME TO post_publications_old").run();
      db.prepare(`CREATE TABLE post_publications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        account_id INTEGER REFERENCES social_accounts(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','publishing','processing','published','failed')),
        platform_post_id TEXT DEFAULT '', error_message TEXT DEFAULT '', error_type TEXT DEFAULT '',
        attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at DATETIME, last_attempt_at DATETIME,
        last_status_check_at DATETIME, published_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(post_id, platform)
      )`).run();
      db.prepare(`INSERT INTO post_publications
        (id,post_id,platform,account_id,status,platform_post_id,error_message,attempt_count,last_attempt_at,published_at,created_at,updated_at)
        SELECT id,post_id,platform,account_id,status,platform_post_id,error_message,attempt_count,last_attempt_at,published_at,created_at,updated_at FROM post_publications_old`).run();
      db.prepare("DROP TABLE post_publications_old").run();
    } else if (!hasOld) {
      // Fresh database: create the table directly in its final shape.
      db.prepare(`CREATE TABLE post_publications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        account_id INTEGER REFERENCES social_accounts(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','publishing','processing','published','failed')),
        platform_post_id TEXT DEFAULT '', error_message TEXT DEFAULT '', error_type TEXT DEFAULT '',
        attempt_count INTEGER NOT NULL DEFAULT 0, next_attempt_at DATETIME, last_attempt_at DATETIME,
        last_status_check_at DATETIME, published_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(post_id, platform)
      )`).run();
    }

    db.prepare("CREATE INDEX IF NOT EXISTS idx_publications_post ON post_publications(post_id)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_publications_status ON post_publications(status)").run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_publications_retry ON post_publications(next_attempt_at)").run();
  }
};
