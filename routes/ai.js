const express = require("express");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { validateBody, schemas } = require("../middleware/validation");
const { aiLimiter } = require("../middleware/rateLimit");
const { AppError } = require("../middleware/errorHandler");
const aiService = require("../services/ai");

const router = express.Router();
router.use(authenticateToken);

function loadOwnedChat(req) {
  const chat = db.prepare("SELECT * FROM ai_chats WHERE id = ? AND user_id = ? AND deleted_at IS NULL").get(req.params.id, req.user.id);
  if (!chat) throw new AppError(404, "Sohbet bulunamadı.");
  return chat;
}

router.get("/chats", (req, res) => {
  const rows = db.prepare("SELECT * FROM ai_chats WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC").all(req.user.id);
  res.json({ success: true, data: rows.map(r => ({ ...r, archived: !!r.archived })) });
});

router.post("/chats", validateBody(schemas.aiChatCreate), (req, res) => {
  const result = db.prepare("INSERT INTO ai_chats (user_id, title) VALUES (?, ?)").run(req.user.id, req.body.title);
  const chat = db.prepare("SELECT * FROM ai_chats WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: chat });
});

router.get("/chats/:id/messages", (req, res, next) => {
  try {
    const chat = loadOwnedChat(req);
    const messages = db.prepare("SELECT * FROM ai_messages WHERE chat_id = ? ORDER BY id ASC").all(chat.id);
    res.json({ success: true, data: messages });
  } catch (err) {
    next(err);
  }
});

router.post("/chats/:id/messages", aiLimiter, validateBody(schemas.aiMessage), async (req, res, next) => {
  try {
    const chat = loadOwnedChat(req);
    if(chat.archived)throw new AppError(409,"Mesaj göndermeden önce sohbeti arşivden çıkarın.");
    db.prepare("INSERT INTO ai_messages (chat_id, role, content) VALUES (?, 'user', ?)").run(chat.id, req.body.text);
    if(["Yeni Sohbet","New Chat"].includes(chat.title))db.prepare("UPDATE ai_chats SET title=? WHERE id=?").run(req.body.text.slice(0,80),chat.id);

    const history = db.prepare("SELECT role, content FROM ai_messages WHERE chat_id = ? ORDER BY id ASC").all(chat.id)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const replyText = await aiService.generateReply(history);
      db.prepare("INSERT INTO ai_messages (chat_id, role, content) VALUES (?, 'assistant', ?)").run(chat.id, replyText);
      db.prepare("UPDATE ai_chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(chat.id);
      const messages = db.prepare("SELECT * FROM ai_messages WHERE chat_id = ? ORDER BY id ASC").all(chat.id);
      return res.json({ success: true, data: messages });
    } catch (aiErr) {
      db.prepare("UPDATE ai_chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(chat.id);
      return res.status(aiErr.status || 502).json({
        success: false,
        message: aiErr.message,
        error: { code: aiErr.code || "AI_UNAVAILABLE", message: aiErr.message },
        data: db.prepare("SELECT * FROM ai_messages WHERE chat_id = ? ORDER BY id ASC").all(chat.id)
      });
    }
  } catch (err) {
    next(err);
  }
});

router.put("/chats/:id", validateBody(schemas.aiChatUpdate), (req, res, next) => {
  try {
    const chat = loadOwnedChat(req);
    db.prepare("UPDATE ai_chats SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.body.title, chat.id);
    res.json({ success: true, data: db.prepare("SELECT * FROM ai_chats WHERE id = ?").get(chat.id) });
  } catch (err) {
    next(err);
  }
});

router.delete("/chats/:id", (req, res, next) => {
  try {
    const chat = loadOwnedChat(req);
    db.prepare("UPDATE ai_chats SET deleted_at=CURRENT_TIMESTAMP WHERE id = ?").run(chat.id);
    res.json({ success: true, message: "Sohbet silindi." });
  } catch (err) {
    next(err);
  }
});

router.patch("/chats/:id/archive", (req, res, next) => {
  try {
    const chat = loadOwnedChat(req);
    db.prepare("UPDATE ai_chats SET archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(chat.id);
    res.json({ success: true, message: "Sohbet arşivlendi." });
  } catch (err) {
    next(err);
  }
});

router.patch("/chats/:id/unarchive", (req, res, next) => {
  try {
    const chat = loadOwnedChat(req);
    db.prepare("UPDATE ai_chats SET archived = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(chat.id);
    res.json({ success: true, message: "Sohbet arşivden çıkarıldı." });
  } catch (err) {
    next(err);
  }
});

router.post("/hashtags", aiLimiter, validateBody(schemas.aiHashtags), async (req, res) => {
  try {
    const result = await aiService.generateHashtags(req.body.text);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.status || 502).json({ success: false, message: err.message, error: { code: err.code || "AI_UNAVAILABLE", message: err.message } });
  }
});

router.post("/caption", aiLimiter, validateBody(schemas.aiCaption), async (req, res) => {
  try {
    const result = await aiService.generateCaption(req.body.topic, req.body.tone);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.status || 502).json({ success: false, message: err.message, error: { code: err.code || "AI_UNAVAILABLE", message: err.message } });
  }
});

router.post("/content-ideas", aiLimiter, validateBody(schemas.aiIdeas), async (req, res) => {
  try {
    const result = await aiService.generateContentIdeas(req.body.topic);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.status || 502).json({ success: false, message: err.message, error: { code: err.code || "AI_UNAVAILABLE", message: err.message } });
  }
});

router.post("/chats/:id/restore",(req,res,next)=>{
  try{
    const result=db.prepare("UPDATE ai_chats SET deleted_at=NULL WHERE id=? AND user_id=? AND deleted_at IS NOT NULL").run(req.params.id,req.user.id);
    if(!result.changes)throw new AppError(404,"Silinmiş sohbet bulunamadı.");
    res.json({success:true});
  }catch(error){next(error);}
});
router.patch("/chats/:id/pin",(req,res,next)=>{
  try{const chat=loadOwnedChat(req);db.prepare("UPDATE ai_chats SET pinned=? WHERE id=?").run(chat.pinned?0:1,chat.id);res.json({success:true,pinned:!chat.pinned});}catch(error){next(error);}
});
router.post("/chats/:id/duplicate",(req,res,next)=>{
  try {
    const source=loadOwnedChat(req);
    const id=db.transaction(()=>{
      const result=db.prepare("INSERT INTO ai_chats(user_id,title) VALUES(?,?)").run(req.user.id,source.title+" (Copy)");
      db.prepare("INSERT INTO ai_messages(chat_id,role,content) SELECT ?,role,content FROM ai_messages WHERE chat_id=? ORDER BY id").run(result.lastInsertRowid,source.id);
      return result.lastInsertRowid;
    })();
    res.status(201).json({success:true,data:db.prepare("SELECT * FROM ai_chats WHERE id=?").get(id)});
  }catch(error){next(error);}
});
module.exports = router;
