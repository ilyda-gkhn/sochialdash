const express = require("express");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { validateQuery, schemas } = require("../middleware/validation");

const router = express.Router();
router.use(authenticateToken);

router.get("/", validateQuery(schemas.searchQuery), (req, res) => {
  const q = `%${req.validatedQuery.q}%`;
  const userId = req.user.id;

  const posts = db.prepare(`
    SELECT id, title, content, status FROM posts
    WHERE deleted_at IS NULL AND user_id = ? AND (title LIKE ? OR content LIKE ?) LIMIT 10
  `).all(userId, q, q);

  const media = db.prepare(`
    SELECT id, original_name, tag FROM media
    WHERE deleted_at IS NULL AND user_id = ? AND original_name LIKE ? LIMIT 10
  `).all(userId, q);

  const accounts = db.prepare(`
    SELECT id, platform, account_name, username FROM social_accounts
    WHERE user_id = ? AND (account_name LIKE ? OR username LIKE ? OR platform LIKE ?) LIMIT 10
  `).all(userId, q, q, q);

  res.json({ success: true, data: { posts, media, accounts } });
});

module.exports = router;
