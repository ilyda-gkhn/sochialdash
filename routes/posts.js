const express = require("express");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { validateBody, validateQuery, schemas } = require("../middleware/validation");
const { AppError } = require("../middleware/errorHandler");

const router = express.Router();
router.use(authenticateToken);

function getPlatforms(postId) {
  return db.prepare("SELECT platform FROM post_platforms WHERE post_id = ?").all(postId).map(r => r.platform);
}

function getAccountIds(postId) {
  return Object.fromEntries(db.prepare(`
    SELECT platform, account_id FROM post_platforms WHERE post_id = ? AND account_id IS NOT NULL
  `).all(postId).map(row => [row.platform.toLowerCase(), row.account_id]));
}

function getPublications(postId) {
  return db.prepare(`
    SELECT platform, account_id AS accountId, status, platform_post_id AS platformPostId,
           error_message AS errorMessage, attempt_count AS attemptCount,
           error_type AS errorType, next_attempt_at AS nextAttemptAt,
           last_attempt_at AS lastAttemptAt, last_status_check_at AS lastStatusCheckAt, published_at AS publishedAt
    FROM post_publications WHERE post_id = ? ORDER BY id
  `).all(postId);
}
function getMediaIds(postId){return db.prepare("SELECT media_id FROM post_media WHERE post_id=? ORDER BY sort_order").all(postId).map(row=>row.media_id);}
function resolveMedia(userId,mediaId,mediaIds){const ids=[...new Set((mediaIds?.length?mediaIds:[mediaId].filter(Boolean)).map(Number))];if(!ids.length)return [];
  const placeholders=ids.map(()=>"?").join(","),owned=db.prepare(`SELECT id FROM media WHERE user_id=? AND deleted_at IS NULL AND id IN (${placeholders})`).all(userId,...ids);
  if(owned.length!==ids.length)throw new AppError(400,"Seçilen medyalardan biri bulunamadı veya size ait değil.");return ids;}
function setMedia(postId,ids){db.prepare("DELETE FROM post_media WHERE post_id=?").run(postId);const insert=db.prepare("INSERT INTO post_media(post_id,media_id,sort_order) VALUES(?,?,?)");ids.forEach((id,index)=>insert.run(postId,id,index));db.prepare("UPDATE posts SET media_id=? WHERE id=?").run(ids[0]||null,postId);}

function resolveAccounts(userId, platforms, accountIds, requireAccounts) {
  return platforms.map(platform => {
    const accountId = accountIds[platform.toLowerCase()] ?? null;
    if (!accountId) {
      if (requireAccounts) throw new AppError(400, `${platform} için bir yayın hesabı seçilmelidir.`);
      return { platform, accountId: null };
    }
    const account = db.prepare(`
      SELECT id, platform FROM social_accounts WHERE id = ? AND user_id = ?
    `).get(accountId, userId);
    if (!account || account.platform.toLowerCase() !== platform.toLowerCase()) {
      throw new AppError(400, `${platform} için seçilen hesap geçersiz veya size ait değil.`);
    }
    return { platform, accountId: account.id };
  });
}

function setPlatforms(postId, selections) {
  db.prepare("DELETE FROM post_platforms WHERE post_id = ?").run(postId);
  db.prepare("DELETE FROM post_publications WHERE post_id = ?").run(postId);
  const insertPlatform = db.prepare("INSERT INTO post_platforms (post_id, platform, account_id) VALUES (?, ?, ?)");
  const insertPublication = db.prepare(`
    INSERT INTO post_publications (post_id, platform, account_id, status) VALUES (?, ?, ?, 'pending')
  `);
  for (const selection of selections) {
    insertPlatform.run(postId, selection.platform, selection.accountId);
    insertPublication.run(postId, selection.platform, selection.accountId);
  }
}

function assertFuture(value) {
  if (value && Date.parse(value) <= Date.now()) throw new AppError(400, "Planlama tarihi gelecekte olmalıdır.");
}

function toApi(row) {
  return {
    id: row.id,
    title: row.title,
    text: row.content,
    status: row.status,
    mediaId: row.media_id,
    mediaIds: getMediaIds(row.id),
    scheduledAt: row.scheduled_at,
    date: row.scheduled_at ? row.scheduled_at.slice(0, 10) : null,
    time: row.scheduled_at ? row.scheduled_at.slice(11, 16) : null,
    publishedAt: row.published_at,
    errorMessage: row.error_message,
    platforms: getPlatforms(row.id),
    accountIds: getAccountIds(row.id),
    publications: getPublications(row.id),
    createdAt: row.created_at,
    advancedSettings: JSON.parse(row.advanced_settings || "{}"),
    updatedAt: row.updated_at
  };
}

router.get("/", validateQuery(schemas.postsQuery), (req, res) => {
  const { status, platform, from, to, search, page, pageSize } = req.validatedQuery;
  let sql = "SELECT DISTINCT p.* FROM posts p LEFT JOIN post_platforms pp ON pp.post_id = p.id WHERE p.user_id = ? AND p.deleted_at IS NULL";
  const params = [req.user.id];

  if (status) { sql += " AND p.status = ?"; params.push(status); }
  if (platform) { sql += " AND pp.platform = ?"; params.push(platform); }
  if (from) { sql += " AND p.scheduled_at >= ?"; params.push(from); }
  if (to) { sql += " AND p.scheduled_at <= ?"; params.push(to); }
  if (search) { sql += " AND (p.title LIKE ? OR p.content LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }

  const countSql = sql.replace("SELECT DISTINCT p.*", "SELECT COUNT(DISTINCT p.id) c");
  const total = db.prepare(countSql).get(...params).c;

  sql += " ORDER BY p.scheduled_at IS NULL, p.scheduled_at ASC, p.created_at DESC LIMIT ? OFFSET ?";
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
    const row = db.prepare("SELECT * FROM posts WHERE id = ? AND user_id = ? AND deleted_at IS NULL").get(req.params.id, req.user.id);
    if (!row) throw new AppError(404, "Gönderi bulunamadı.");
    res.json({ success: true, data: toApi(row) });
  } catch (err) {
    next(err);
  }
});

router.post("/", validateBody(schemas.post), (req, res, next) => {
  try {
    const { title, content, platforms, accountIds, status, scheduledAt, mediaId, mediaIds } = req.body;
    assertFuture(scheduledAt);
    const selections = resolveAccounts(req.user.id, platforms, accountIds, status === "scheduled");

    const resolvedMedia=resolveMedia(req.user.id,mediaId,mediaIds);

    const result = db.transaction(() => {
      const created = db.prepare(`
        INSERT INTO posts (user_id, title, content, status, media_id, scheduled_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(req.user.id, title, content, status, resolvedMedia[0] ?? null, scheduledAt || null);
      setPlatforms(created.lastInsertRowid, selections);
      setMedia(created.lastInsertRowid,resolvedMedia);
      db.prepare("UPDATE posts SET advanced_settings=? WHERE id=?").run(JSON.stringify(req.body.advancedSettings),created.lastInsertRowid);
      return created;
    })();
    const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ success: true, message: "Gönderi oluşturuldu.", data: toApi(row) });
  } catch (err) {
    next(err);
  }
});

router.put("/:id", validateBody(schemas.post), (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM posts WHERE id = ? AND user_id = ? AND deleted_at IS NULL").get(req.params.id, req.user.id);
    if (!existing) throw new AppError(404, "Gönderi bulunamadı.");
    if (["publishing", "processing", "published"].includes(existing.status)) throw new AppError(409,"Yayına alınmış gönderi değiştirilemez; taslak kopya oluşturun.");

    const { title, content, platforms, accountIds, status, scheduledAt, mediaId, mediaIds } = req.body;
    assertFuture(scheduledAt);
    const selections = resolveAccounts(req.user.id, platforms, accountIds, status === "scheduled");

    const resolvedMedia=resolveMedia(req.user.id,mediaId,mediaIds);

    db.transaction(() => {
      db.prepare(`
        UPDATE posts SET title = ?, content = ?, status = ?, media_id = ?, scheduled_at = ?,
          published_at = NULL, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(title, content, status, resolvedMedia[0] ?? null, scheduledAt || null, existing.id);
      setPlatforms(existing.id, selections);
      setMedia(existing.id,resolvedMedia);
      db.prepare("UPDATE posts SET advanced_settings=? WHERE id=?").run(JSON.stringify(req.body.advancedSettings),existing.id);
    })();
    const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(existing.id);
    res.json({ success: true, message: "Gönderi güncellendi.", data: toApi(row) });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/schedule", validateBody(schemas.postSchedule), (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM posts WHERE id = ? AND user_id = ? AND deleted_at IS NULL").get(req.params.id, req.user.id);
    if (!existing) throw new AppError(404, "Gönderi bulunamadı.");
    if (["publishing", "processing", "published"].includes(existing.status)) throw new AppError(409,"Yayına alınmış gönderi değiştirilemez; taslak kopya oluşturun.");
    if (existing.status === "published") throw new AppError(400, "Yayınlanmış bir gönderinin tarihi değiştirilemez.");
    assertFuture(req.body.scheduledAt);
    const missingAccount = db.prepare(`
      SELECT platform FROM post_platforms WHERE post_id = ? AND account_id IS NULL LIMIT 1
    `).get(existing.id);
    if (missingAccount) throw new AppError(400, `${missingAccount.platform} için bir yayın hesabı seçilmelidir.`);

    db.transaction(() => {
      db.prepare(`
        UPDATE posts SET scheduled_at = ?, status = 'scheduled', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(req.body.scheduledAt, existing.id);
      db.prepare(`
        UPDATE post_publications SET status = 'pending', error_message = '', updated_at = CURRENT_TIMESTAMP WHERE post_id = ?
      `).run(existing.id);
    })();

    const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(existing.id);
    res.json({ success: true, message: "Gönderi tarihi güncellendi.", data: toApi(row) });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/retry", (req, res, next) => {
  try {
    const existing = db.prepare("SELECT * FROM posts WHERE id = ? AND user_id = ? AND deleted_at IS NULL").get(req.params.id, req.user.id);
    if (!existing) throw new AppError(404, "Gönderi bulunamadı.");
    if (["publishing", "processing", "published"].includes(existing.status)) throw new AppError(409,"Yayına alınmış gönderi değiştirilemez; taslak kopya oluşturun.");
    if (existing.status !== "failed") throw new AppError(400, "Yalnızca başarısız gönderiler yeniden denenebilir.");
    const missingAccount = db.prepare("SELECT platform FROM post_platforms WHERE post_id = ? AND account_id IS NULL LIMIT 1").get(existing.id);
    if (missingAccount) throw new AppError(400, `${missingAccount.platform} için bir yayın hesabı seçilmelidir.`);
    const scheduledAt = new Date(Date.now() + 60_000).toISOString();
    db.transaction(() => {
      db.prepare("UPDATE posts SET status = 'scheduled', scheduled_at = ?, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(scheduledAt, existing.id);
      db.prepare("UPDATE post_publications SET status='pending',error_message='',error_type='',next_attempt_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE post_id=? AND status!='published'").run(existing.id);
    })();
    res.json({ success: true, message: "Gönderi yeniden deneme kuyruğuna alındı.", data: toApi(db.prepare("SELECT * FROM posts WHERE id = ?").get(existing.id)) });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", (req, res, next) => {
  try {
    const result = db.prepare("UPDATE posts SET deleted_at=CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL AND status NOT IN ('publishing','processing')").run(req.params.id, req.user.id);
    if (result.changes === 0) throw new AppError(404, "Gönderi bulunamadı.");
    res.json({ success: true, message: "Gönderi silindi." });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/restore", (req,res,next)=>{
  try {
    const result=db.prepare("UPDATE posts SET deleted_at=NULL, status=CASE WHEN status='scheduled' THEN 'draft' ELSE status END, scheduled_at=CASE WHEN status='scheduled' THEN NULL ELSE scheduled_at END WHERE id=? AND user_id=? AND deleted_at IS NOT NULL").run(req.params.id,req.user.id);
    if(!result.changes) throw new AppError(404,"Silinmiş gönderi bulunamadı.");
    res.json({success:true,data:toApi(db.prepare("SELECT * FROM posts WHERE id=?").get(req.params.id))});
  }catch(error){next(error);}
});
module.exports = router;
