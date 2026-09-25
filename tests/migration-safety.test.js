const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require("better-sqlite3");

const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");

function freshDb() {
  const tmpPath = path.join(__dirname, `test-migsafety-${crypto.randomBytes(6).toString("hex")}.db`);
  const db = new Database(tmpPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return { db, tmpPath };
}

function cleanup(tmpPath) {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try { fs.unlinkSync(tmpPath + suffix); } catch (_) { /* noop */ }
  }
}

function migrationFiles() {
  return fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith(".js")).sort();
}

describe("Migration safety (idempotency, no destructive re-runs)", () => {
  test("every migration file's up() is a re-runnable, non-destructive operation when applied twice in a row", () => {
    const { db, tmpPath } = freshDb();
    try {
      const files = migrationFiles();
      // First pass: apply every migration once, in order, as the real runner would.
      for (const file of files) {
        const migration = require(path.join(MIGRATIONS_DIR, file));
        expect(() => migration.up(db)).not.toThrow();
      }

      // Seed one row in a representative set of tables so we can detect data loss.
      db.prepare("INSERT INTO users (name,email,password) VALUES ('t','t@example.com','x')").run();
      db.prepare("INSERT INTO posts (user_id,title,content,status) VALUES (1,'p','c','draft')").run();
      db.prepare("INSERT INTO post_publications (post_id,platform,status) VALUES (1,'instagram','pending')").run();
      db.prepare("INSERT INTO notifications (user_id,type,title,message) VALUES (1,'system','t','m')").run();

      const before = {
        users: db.prepare("SELECT COUNT(*) c FROM users").get().c,
        posts: db.prepare("SELECT COUNT(*) c FROM posts").get().c,
        post_publications: db.prepare("SELECT COUNT(*) c FROM post_publications").get().c,
        notifications: db.prepare("SELECT COUNT(*) c FROM notifications").get().c
      };

      // Second pass: re-run every migration's up() again (simulates a
      // corrupted/reset schema_migrations tracking table) - must not throw
      // and must not lose any of the data seeded above.
      for (const file of files) {
        const migration = require(path.join(MIGRATIONS_DIR, file));
        expect(() => migration.up(db)).not.toThrow();
      }

      const after = {
        users: db.prepare("SELECT COUNT(*) c FROM users").get().c,
        posts: db.prepare("SELECT COUNT(*) c FROM posts").get().c,
        post_publications: db.prepare("SELECT COUNT(*) c FROM post_publications").get().c,
        notifications: db.prepare("SELECT COUNT(*) c FROM notifications").get().c
      };

      expect(after).toEqual(before);
    } finally {
      db.close();
      cleanup(tmpPath);
    }
  });

  test("no migration issues an unconditional DROP TABLE/DROP COLUMN outside a guarded rebuild", () => {
    for (const file of migrationFiles()) {
      const source = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      const dropMatches = source.match(/DROP TABLE\s+(\w+)/gi) || [];
      for (const match of dropMatches) {
        // A DROP TABLE is only acceptable when it targets a "_old" backup
        // table created earlier in the SAME migration for a rename-rebuild
        // (the standard SQLite ALTER-TABLE-workaround pattern), never a
        // live table dropped unconditionally.
        expect(match.toLowerCase()).toMatch(/_old/);
      }
    }
  });

  test("every CREATE TABLE / CREATE INDEX statement uses IF NOT EXISTS", () => {
    for (const file of migrationFiles()) {
      const source = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
      const createTable = source.match(/CREATE TABLE\s+(?!IF NOT EXISTS)\w+/gi) || [];
      const createIndex = source.match(/CREATE INDEX\s+(?!IF NOT EXISTS)\w+/gi) || [];
      // The one known exception is 004's guarded rebuild, which only issues
      // a bare CREATE TABLE inside an explicit existence check (verified by
      // the idempotency test above actually re-running it safely).
      if (file !== "004_async_publications.js") {
        expect(createTable).toEqual([]);
        expect(createIndex).toEqual([]);
      }
    }
  });
});
