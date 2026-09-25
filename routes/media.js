const express = require("express");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { mediaUpload, mediaStorage } = require("../middleware/upload");
const { AppError } = require("../middleware/errorHandler");
const { inspectFile } = require("../services/mediaValidation");
const { validateQuery, schemas } = require("../middleware/validation");

const router = express.Router();
router.use(authenticateToken);

function toApi(row) {
  return {
    id: row.id,
    name: row.original_name,
    tag: row.tag,
    mimeType: row.mime_type,
    size: row.size,
    url: mediaStorage.publicUrl(row.filename),
    dateISO: row.created_at ? row.created_at.slice(0, 10) : null,
    createdAt: row.created_at
  };
}

function inferTag(mime) {
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime === "image/gif") return "GIF";
  return "FOTOĞRAF";
}

const SORTS = {
  newest: "created_at DESC",
  oldest: "created_at ASC",
  name: "original_name COLLATE NOCASE ASC",
  size: "size DESC"
};

router.get("/", validateQuery(schemas.mediaQuery), (req, res) => {
  const { page, pageSize, search, type, sort } = req.validatedQuery;
  let sql = "SELECT * FROM media WHERE user_id = ? AND deleted_at IS NULL";
  const params = [req.user.id];
  if (type) { sql += " AND tag = ?"; params.push(type); }
  if (search) { sql += " AND original_name LIKE ?"; params.push(`%${search}%`); }

  const total = db.prepare(sql.replace("SELECT *", "SELECT COUNT(*) c")).get(...params).c;

  sql += ` ORDER BY ${SORTS[sort] || SORTS.newest} LIMIT ? OFFSET ?`;
  params.push(pageSize, (page - 1) * pageSize);

  const rows = db.prepare(sql).all(...params);
  res.json({
    success: true,
    data: rows.map(toApi),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  });
});

router.get("/:id", (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM media WHERE id = ? AND user_id = ? AND deleted_at IS NULL").get(req.params.id, req.user.id);
    if (!row) throw new AppError(404, "Medya bulunamadı.");
    res.json({ success: true, data: toApi(row) });
  } catch (err) {
    next(err);
  }
});

router.post("/", (req, res, next) => {
  mediaUpload.single("file")(req, res, (err) => {
    if (err) return next(new AppError(400, err.message || "Dosya yüklenemedi."));
    try {
      if (!req.file) throw new AppError(400, "Dosya bulunamadı.");
      try { inspectFile(req.file.path,req.file.mimetype); }
      catch(validationError){ mediaStorage.delete(req.file.path); throw new AppError(400,validationError.message); }
      const tag = inferTag(req.file.mimetype);
      const result = db.prepare(`
        INSERT INTO media (user_id, filename, original_name, mime_type, tag, size, path)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(req.user.id, req.file.filename, req.file.originalname, req.file.mimetype, tag, req.file.size, req.file.path);

      const row = db.prepare("SELECT * FROM media WHERE id = ?").get(result.lastInsertRowid);
      res.status(201).json({ success: true, message: "Medya yüklendi.", data: toApi(row) });
    } catch (e) {
      next(e);
    }
  });
});

router.put("/:id", (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM media WHERE id = ? AND user_id = ? AND deleted_at IS NULL").get(req.params.id, req.user.id);
    if (!row) throw new AppError(404, "Medya bulunamadı.");
    const name = String(req.body?.name || row.original_name).slice(0, 180);
    db.prepare("UPDATE media SET original_name = ? WHERE id = ?").run(name, row.id);
    const updated = db.prepare("SELECT * FROM media WHERE id = ?").get(row.id);
    res.json({ success: true, message: "Medya güncellendi.", data: toApi(updated) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", (req, res, next) => {
  try {
    const row = db.prepare("SELECT * FROM media WHERE id = ? AND user_id = ? AND deleted_at IS NULL").get(req.params.id, req.user.id);
    if (!row) throw new AppError(404, "Medya bulunamadı.");
    db.prepare("UPDATE media SET deleted_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
    res.json({ success: true, message: "Medya silindi." });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/restore",(req,res,next)=>{
  try {
    const result=db.prepare("UPDATE media SET deleted_at=NULL WHERE id=? AND user_id=? AND deleted_at IS NOT NULL").run(req.params.id,req.user.id);
    if(!result.changes)throw new AppError(404,"Silinmiş medya bulunamadı.");
    res.json({success:true,data:toApi(db.prepare("SELECT * FROM media WHERE id=?").get(req.params.id))});
  }catch(error){next(error);}
});
module.exports = router;
