module.exports = {
  up(db) {
    const columns = db.prepare("PRAGMA table_info(social_accounts)").all().map(column => column.name);
    if (!columns.includes("token_type")) db.prepare("ALTER TABLE social_accounts ADD COLUMN token_type TEXT DEFAULT 'Bearer'").run();
    if (!columns.includes("scopes")) db.prepare("ALTER TABLE social_accounts ADD COLUMN scopes TEXT DEFAULT ''").run();
    db.prepare(`CREATE TABLE IF NOT EXISTS oauth_states (
      state_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      code_verifier TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at)").run();
  }
};
