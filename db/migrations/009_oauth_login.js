module.exports = {
  up(db) {
    // Short-lived CSRF/PKCE state for the "Sign in with Google/Apple" flow.
    // Separate from oauth_states (003_oauth_security) because that table is
    // for connecting a social account to an already-authenticated user;
    // login happens before we have a user at all, so there is no user_id yet.
    db.prepare(`
      CREATE TABLE IF NOT EXISTS oauth_login_states (
        state_hash TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        code_verifier TEXT NOT NULL,
        remember INTEGER DEFAULT 0,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_oauth_login_states_expiry ON oauth_login_states(expires_at)").run();

    // Links a local user to their Google/Apple account id, so returning
    // "Sign in with ..." clicks are recognized without relying on email
    // alone (which can change on the provider's side).
    db.prepare(`
      CREATE TABLE IF NOT EXISTS oauth_identities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_user_id TEXT NOT NULL,
        email TEXT DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider, provider_user_id)
      )
    `).run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_oauth_identities_user ON oauth_identities(user_id)").run();

    // The OAuth callback runs in a full-page browser redirect from
    // Google/Apple, so it cannot hand the resulting access/refresh tokens
    // back to the SPA directly without putting them in the URL (which
    // leaks into browser history, logs, and the Referer header). Instead
    // the callback stores the already-issued session tokens here (encrypted,
    // same as social platform tokens), redirects with a short opaque code,
    // and the frontend exchanges that code once via POST for the real
    // tokens. The row is deleted immediately after that single exchange.
    db.prepare(`
      CREATE TABLE IF NOT EXISTS oauth_handoff_codes (
        code_hash TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare("CREATE INDEX IF NOT EXISTS idx_oauth_handoff_expiry ON oauth_handoff_codes(expires_at)").run();
  }
};
