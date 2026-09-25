const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const tmpDbPath = path.join(__dirname, `test-${crypto.randomBytes(6).toString("hex")}.db`);
process.env.DB_PATH = tmpDbPath;
process.env.JWT_SECRET = "test-secret-key-not-for-production";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.NODE_ENV = "test";

afterAll(() => {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try { fs.unlinkSync(tmpDbPath + suffix); } catch (_) { /* noop */ }
  }
});

module.exports = { tmpDbPath };
