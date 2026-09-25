const express = require("express");
const { authenticateToken } = require("../middleware/auth");
const { validateQuery, validateBody, schemas } = require("../middleware/validation");
const newsService = require("../services/news");
const db = require("../config/database");

const router = express.Router();
router.use(authenticateToken);

router.get("/", validateQuery(schemas.newsQuery), async (req, res) => {
  try {
    const data = await newsService.fetchNews(req.validatedQuery);
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 502).json({ success: false, message: err.message, error: { code: err.code || "NEWS_UNAVAILABLE", message: err.message } });
  }
});

router.get("/trending", async (req, res) => {
  try {
    const data = await newsService.fetchNews({ trending: true });
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 502).json({ success: false, message: err.message, error: { code: err.code || "NEWS_UNAVAILABLE", message: err.message } });
  }
});

router.post("/newsletter",validateBody(schemas.newsletter),(req,res)=>{const email=req.body.email.toLowerCase();db.prepare(`INSERT INTO newsletter_subscriptions(user_id,email,active,updated_at) VALUES(?,?,1,CURRENT_TIMESTAMP)
  ON CONFLICT(email) DO UPDATE SET user_id=excluded.user_id,active=1,updated_at=CURRENT_TIMESTAMP`).run(req.user.id,email);res.status(201).json({success:true,message:"Bülten aboneliği kaydedildi."});});

module.exports = router;
