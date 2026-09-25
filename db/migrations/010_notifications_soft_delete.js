module.exports = {
  up(db) {
    const columns = db.prepare("PRAGMA table_info(notifications)").all().map(c => c.name);
    // Deletes are soft (deleted_at set) so a "delete" action can be
    // genuinely undone for a short window, instead of the previous
    // deleteNotifWithUndo() which was misnamed - it deleted immediately
    // with no way back.
    if (!columns.includes("deleted_at")) {
      db.prepare("ALTER TABLE notifications ADD COLUMN deleted_at DATETIME").run();
    }
    db.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON notifications(deleted_at)").run();
  }
};
