module.exports = {
  up(db) {
    // Composite indexes matching real WHERE-clause patterns observed in
    // routes/*.js (single-column user_id indexes already exist from
    // 001_init.js; these add the second predicate SQLite's planner
    // otherwise has to filter with a table scan of that user's rows).
    const statements = [
      // routes/dashboard.js counts posts per user by status; routes/posts.js filters the same way.
      "CREATE INDEX IF NOT EXISTS idx_posts_user_status ON posts(user_id, status)",
      // Calendar/scheduler range queries and the "due posts" scan both filter by user + scheduled_at together.
      "CREATE INDEX IF NOT EXISTS idx_posts_user_scheduled ON posts(user_id, scheduled_at)",
      // Notification list/unread-count/mark-all-read/soft-delete all filter user_id + deleted_at together.
      "CREATE INDEX IF NOT EXISTS idx_notifications_user_deleted ON notifications(user_id, deleted_at)",
      // Unread badge count filters user_id + is_read together.
      "CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)",
      // routes/accounts.js looks up a specific platform connection per user.
      "CREATE INDEX IF NOT EXISTS idx_accounts_user_platform ON social_accounts(user_id, platform)",
      // Media library default sort is newest-first per user (routes/media.js).
      "CREATE INDEX IF NOT EXISTS idx_media_user_created ON media(user_id, created_at)"
    ];
    for (const sql of statements) db.prepare(sql).run();
  }
};
