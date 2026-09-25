module.exports = {
  up(db) {
    // users table (kept compatible with the pre-existing table/columns)
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        phone TEXT DEFAULT '',
        username TEXT DEFAULT '',
        title TEXT DEFAULT '',
        country TEXT DEFAULT '+90',
        profile_image TEXT DEFAULT '',
        plan TEXT DEFAULT 'free',
        two_factor_enabled INTEGER DEFAULT 0,
        two_factor_secret TEXT DEFAULT '',
        last_login_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Add columns to a pre-existing users table that may lack them (safe no-ops if already present)
    const existingCols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
    const wanted = [
      ["profile_image", "TEXT DEFAULT ''"],
      ["plan", "TEXT DEFAULT 'free'"],
      ["two_factor_enabled", "INTEGER DEFAULT 0"],
      ["two_factor_secret", "TEXT DEFAULT ''"],
      ["last_login_at", "DATETIME"],
      ["updated_at", "DATETIME"],
      ["phone", "TEXT DEFAULT ''"],
      ["username", "TEXT DEFAULT ''"],
      ["title", "TEXT DEFAULT ''"],
      ["country", "TEXT DEFAULT '+90'"]
    ];
    for (const [col, def] of wanted) {
      if (!existingCols.includes(col)) {
        db.prepare(`ALTER TABLE users ADD COLUMN ${col} ${def}`).run();
      }
    }
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`).run();
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username != ''`).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        theme TEXT DEFAULT 'light',
        language TEXT DEFAULT 'tr',
        timezone TEXT DEFAULT 'Europe/Istanbul',
        date_format TEXT DEFAULT 'DD.MM.YYYY',
        email_notifications INTEGER DEFAULT 1,
        push_notifications INTEGER DEFAULT 1,
        weekly_summary INTEGER DEFAULT 0,
        connection_alerts INTEGER DEFAULT 1,
        auto_draft INTEGER DEFAULT 1,
        sidebar_open INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        refresh_token_hash TEXT NOT NULL,
        label TEXT DEFAULT '',
        ip TEXT DEFAULT '',
        user_agent TEXT DEFAULT '',
        remember INTEGER DEFAULT 0,
        revoked INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        used INTEGER DEFAULT 0,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS social_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        platform_user_id TEXT DEFAULT '',
        account_name TEXT DEFAULT '',
        username TEXT DEFAULT '',
        access_token TEXT DEFAULT '',
        refresh_token TEXT DEFAULT '',
        token_expires_at DATETIME,
        status TEXT DEFAULT 'disconnected',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_accounts_user ON social_accounts(user_id)`).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT DEFAULT '',
        content TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        media_id INTEGER,
        scheduled_at DATETIME,
        published_at DATETIME,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_posts_scheduled ON posts(scheduled_at)`).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS post_platforms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        platform TEXT NOT NULL,
        UNIQUE(post_id, platform)
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        original_name TEXT DEFAULT '',
        mime_type TEXT DEFAULT '',
        tag TEXT DEFAULT 'FOTOĞRAF',
        size INTEGER DEFAULT 0,
        path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_media_user ON media(user_id)`).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT DEFAULT 'general',
        icon TEXT DEFAULT 'notifications',
        color TEXT DEFAULT 'primary',
        title TEXT DEFAULT '',
        message TEXT DEFAULT '',
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)`).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS ai_chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT DEFAULT 'Yeni Sohbet',
        archived INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_aichats_user ON ai_chats(user_id)`).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL REFERENCES ai_chats(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_aimessages_chat ON ai_messages(chat_id)`).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS account_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id INTEGER NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
        followers INTEGER DEFAULT 0,
        reach INTEGER DEFAULT 0,
        engagement INTEGER DEFAULT 0,
        captured_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS post_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        likes INTEGER DEFAULT 0,
        comments INTEGER DEFAULT 0,
        shares INTEGER DEFAULT 0,
        captured_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
  }
};
