module.exports = {
  up(db) {
    const columns = db.prepare("PRAGMA table_info(sessions)").all().map(column => column.name);
    // Retains the refresh token hash that was replaced by rotation. If that
    // exact (already-rotated-away) token is ever presented again, it's a
    // strong signal of token theft, so we can detect and react to reuse.
    if (!columns.includes("previous_refresh_token_hash")) {
      db.prepare("ALTER TABLE sessions ADD COLUMN previous_refresh_token_hash TEXT").run();
    }
  }
};
