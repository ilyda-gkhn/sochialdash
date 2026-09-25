module.exports = { up(db) {
  for (const [table, columns] of Object.entries({
    posts: { advanced_settings: "TEXT NOT NULL DEFAULT '{}'", deleted_at: "DATETIME" },
    media: { deleted_at: "DATETIME" },
    ai_chats: { pinned: "INTEGER NOT NULL DEFAULT 0", deleted_at: "DATETIME" },
    user_settings: { selected_accounts: "TEXT NOT NULL DEFAULT '{}'", custom_titles: "TEXT NOT NULL DEFAULT '{}'" }
  })) {
    const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
    for (const [column, type] of Object.entries(columns)) {
      if (!existing.has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  }
}};
