const cron = require("node-cron");
const db = require("../config/database");
const { createNotification } = require("./notify");
const socialServices = require("./social");
const { encrypt, decrypt } = require("./tokenVault");
const { validateCollection } = require("./mediaValidation");

// Runs every minute. Picks up posts whose scheduled time has passed and
// are still 'scheduled', atomically flips them to 'publishing' (so two
// overlapping runs can never grab the same post), then attempts a real
// publish. Since no social platform credentials are configured in this
// environment, publishing genuinely cannot succeed - the post is marked
// 'failed' with an honest error message rather than faked as published.
function claimDuePosts() {
  const claim = db.transaction(() => {
    const due = db.prepare(`
      SELECT id FROM posts
      WHERE deleted_at IS NULL AND status = 'scheduled' AND julianday(scheduled_at) <= julianday('now')
    `).all();
    const ids = due.map(r => r.id);
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      db.prepare(`UPDATE posts SET status = 'publishing', updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`).run(...ids);
    }
    return ids;
  });
  return claim();
}

async function attemptPublish(postId) {
  const post = db.prepare("SELECT * FROM posts WHERE id = ? AND deleted_at IS NULL").get(postId);
  if (!post) return;
  post.mediaItems=db.prepare(`SELECT m.id,m.path,m.filename,m.original_name,m.mime_type,m.size FROM post_media pm JOIN media m ON m.id=pm.media_id WHERE pm.post_id=? AND m.user_id=? ORDER BY pm.sort_order`).all(postId,post.user_id);
  if(!post.mediaItems.length&&post.media_id){const legacy=db.prepare("SELECT id,path,filename,original_name,mime_type,size FROM media WHERE id=? AND user_id=?").get(post.media_id,post.user_id);if(legacy)post.mediaItems=[legacy];}
  post.media=post.mediaItems[0]||null;
  post.advancedSettings=JSON.parse(post.advanced_settings||"{}");
  if (post.mediaItems.length && process.env.MEDIA_PUBLIC_BASE_URL) {
    try {
      const base = new URL(process.env.MEDIA_PUBLIC_BASE_URL);
      if (base.protocol === "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) {
        post.mediaItems.forEach(media=>{media.publicUrl=new URL(`/uploads/media/${encodeURIComponent(media.filename)}`,base).toString();});
      }
    } catch (_) { /* Invalid public base is reported by the platform adapter. */ }
  }
  if (post.media_id && !post.media) {
    db.prepare("UPDATE posts SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run("Gönderiye bağlı medya dosyası bulunamadı.", postId);
    return;
  }

  const targets = db.prepare(`
    SELECT sa.*, pp.platform AS target_platform, pp.account_id, pub.attempt_count
    FROM post_platforms pp
    JOIN post_publications pub ON pub.post_id = pp.post_id AND pub.platform = pp.platform
    LEFT JOIN social_accounts sa ON sa.id = pp.account_id AND sa.user_id = ?
    WHERE pp.post_id = ? AND pub.status != 'published'
      AND (pub.next_attempt_at IS NULL OR julianday(pub.next_attempt_at) <= julianday('now'))
  `).all(post.user_id, postId);

  const failures = [], successes = [], deferred = [], processing = [];
  const markFailed = db.prepare(`
    UPDATE post_publications SET status = 'failed', error_message = ?, error_type='permanent', next_attempt_at=NULL, attempt_count = attempt_count + 1,
      last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE post_id = ? AND platform = ?
  `);
  for (const target of targets) {
    const platform = target.target_platform;
    try {
      if (!target.account_id) throw new Error("Bu platform için yayın hesabı seçilmemiş.");
      if (!target.access_token || target.status !== "connected") throw new Error("Bağlı hesabın geçerli erişim anahtarı yok.");
      const service = socialServices[target.platform];
      if (!service?.isConfigured()) throw new Error("Platform API kimlik bilgileri eksik.");
      if(post.mediaItems.length)validateCollection(post.mediaItems,target.platform);

      let accessToken = decrypt(target.access_token);
      const expiresSoon = target.token_expires_at && Date.parse(target.token_expires_at) <= Date.now() + 5 * 60 * 1000;
      if (expiresSoon) {
        const refresh = decrypt(target.refresh_token);
        if (!refresh) throw new Error("Erişim anahtarı süresi doldu ve refresh token yok; hesabı yeniden bağlayın.");
        const tokens = await service.refreshToken(refresh);
        accessToken = tokens.access_token;
        db.prepare(`UPDATE social_accounts SET access_token = ?, refresh_token = ?, token_expires_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .run(encrypt(accessToken), encrypt(tokens.refresh_token || refresh), tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000).toISOString() : null, target.id);
      }

      db.prepare("UPDATE post_publications SET status = 'publishing', last_attempt_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE post_id = ? AND platform = ?").run(postId, platform);
      const result = await service.publish({ ...target, accessToken }, post);
      if (result.processing) {
        db.prepare(`UPDATE post_publications SET status='processing', platform_post_id=?, error_message='',
          attempt_count=attempt_count+1, last_status_check_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE post_id=? AND platform=?`)
          .run(String(result.id||""),postId,platform);
        processing.push(platform);continue;
      }
      db.prepare(`UPDATE post_publications SET status = 'published', platform_post_id = ?, error_message = '',
        attempt_count = attempt_count + 1, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE post_id = ? AND platform = ?`)
        .run(String(result.id || ""), postId, platform);
      successes.push(platform);
    } catch (err) {
      const message = String(err.message || "Bilinmeyen yayınlama hatası").slice(0, 1000);
      if(err.retryable && Number(target.attempt_count||0)<3){
        const delayMinutes=2**Number(target.attempt_count||0);
        const next=new Date(Date.now()+delayMinutes*60_000).toISOString();
        db.prepare(`UPDATE post_publications SET status='pending',error_message=?,error_type='transient',attempt_count=attempt_count+1,
          next_attempt_at=?,last_attempt_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE post_id=? AND platform=?`).run(message,next,postId,platform);
        deferred.push(`${platform}: ${message}`);
      }else{
        failures.push(`${platform}: ${message}`);
        markFailed.run(message, postId, platform);
      }
    }
  }
  if (targets.length === 0) failures.push("Yayınlanacak platform seçilmemiş.");
  if (failures.length) {
    db.prepare("UPDATE posts SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(failures.join(" "), postId);
  } else if(processing.length){
    db.prepare("UPDATE posts SET status='processing',error_message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(postId);
  } else if(deferred.length){
    const next=db.prepare("SELECT MIN(next_attempt_at) value FROM post_publications WHERE post_id=? AND status='pending'").get(postId).value;
    db.prepare("UPDATE posts SET status='scheduled',scheduled_at=?,error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(next,deferred.join(" "),postId);
  } else {
    db.prepare("UPDATE posts SET status = 'published', published_at = CURRENT_TIMESTAMP, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(postId);
  }

  if(processing.length||deferred.length)return;
  createNotification(post.user_id, failures.length ? {
    type: "post_failed", icon: "error", color: "error", title: "Gönderi yayınlanamadı",
    message: `"${post.title || "Başlıksız gönderi"}" yayınlanamadı: ${failures.join(" ")}`
  } : {
    type: "post_published", icon: "check_circle", color: "success", title: "Gönderi yayınlandı",
    message: `"${post.title || "Başlıksız gönderi"}" ${successes.join(", ")} platformunda yayınlandı.`
  });
}

function recoverStuckPublications() {
  const rows=db.prepare(`SELECT DISTINCT post_id FROM post_publications WHERE status='publishing' AND datetime(updated_at) < datetime('now','-15 minutes')`).all();
  if(!rows.length)return 0;
  const recover=db.transaction(()=>{for(const row of rows){
    db.prepare(`UPDATE post_publications SET status='pending',error_message='Yarıda kalan yayın işlemi kurtarıldı.',error_type='transient',next_attempt_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE post_id=? AND status='publishing'`).run(row.post_id);
    db.prepare("UPDATE posts SET status='scheduled',scheduled_at=CURRENT_TIMESTAMP,error_message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.post_id);
  }});recover();return rows.length;
}

async function pollProcessingPublications(){
  const rows=db.prepare(`SELECT pub.*,p.user_id,sa.platform AS account_platform,sa.access_token,sa.status AS account_status
    FROM post_publications pub JOIN posts p ON p.id=pub.post_id LEFT JOIN social_accounts sa ON sa.id=pub.account_id
    WHERE pub.status='processing' AND (pub.last_status_check_at IS NULL OR datetime(pub.last_status_check_at) <= datetime('now','-1 minute'))`).all();
  const touched=new Set();
  for(const row of rows){touched.add(row.post_id);try{
    const service=socialServices[row.account_platform];if(!service||!row.access_token)throw new Error("Yayın durumu sorgulanacak hesap bulunamadı.");
    const result=await service.checkStatus({...row,accessToken:decrypt(row.access_token)},row.platform_post_id);
    if(result.status==='published')db.prepare("UPDATE post_publications SET status='published',platform_post_id=?,published_at=CURRENT_TIMESTAMP,last_status_check_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(String(result.id||row.platform_post_id),row.id);
    else if(result.status==='failed')db.prepare("UPDATE post_publications SET status='failed',error_message=?,error_type='permanent',last_status_check_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(String(result.error||"Yayın başarısız."),row.id);
    else db.prepare("UPDATE post_publications SET last_status_check_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
  }catch(err){db.prepare("UPDATE post_publications SET error_message=?,last_status_check_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(String(err.message).slice(0,1000),row.id);}}
  for(const postId of touched){const states=db.prepare("SELECT status,error_message FROM post_publications WHERE post_id=?").all(postId);if(states.some(x=>x.status==='failed'))db.prepare("UPDATE posts SET status='failed',error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(states.filter(x=>x.status==='failed').map(x=>x.error_message).join(' '),postId);else if(states.every(x=>x.status==='published'))db.prepare("UPDATE posts SET status='published',published_at=CURRENT_TIMESTAMP,error_message=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(postId);}
  return rows.length;
}

// Permanently removes notifications that were soft-deleted more than 30
// days ago, so "undo" stays possible for a generous window without
// keeping deleted rows forever.
function purgeOldDeletedNotifications() {
  return db.prepare(`
    DELETE FROM notifications WHERE deleted_at IS NOT NULL AND julianday('now') - julianday(deleted_at) > 30
  `).run().changes;
}

function startScheduler() {
  return cron.schedule("* * * * *", async () => {
    try {
      const ids = claimDuePosts();
      for (const id of ids) {
        await attemptPublish(id);
      }
      recoverStuckPublications();
      await pollProcessingPublications();
    } catch (err) {
      console.error("[scheduler] error:", err);
    }
  });
}

function startDailyCleanup() {
  return cron.schedule("0 3 * * *", () => {
    try {
      const purged = purgeOldDeletedNotifications();
      if (purged) console.log(`[cleanup] purged ${purged} old soft-deleted notifications`);
    } catch (err) {
      console.error("[cleanup] error:", err);
    }
  });
}

module.exports = {
  startScheduler,
  startDailyCleanup,
  claimDuePosts,
  attemptPublish,
  recoverStuckPublications,
  pollProcessingPublications,
  purgeOldDeletedNotifications
};
