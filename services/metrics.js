const cron = require("node-cron");
const db = require("../config/database");
const socialServices = require("./social");
const { decrypt } = require("./tokenVault");

const number = value => Math.max(0, Math.round(Number(value) || 0));
const normalized = value => ({
  followers:number(value?.followers), reach:number(value?.reach), engagement:number(value?.engagement),
  views:number(value?.views), impressions:number(value?.impressions), clicks:number(value?.clicks),
  saves:number(value?.saves), postsCount:number(value?.postsCount), raw:value?.raw || null
});

function saveSyncState(accountId, error) {
  db.prepare(`INSERT INTO metrics_sync_state (account_id,last_success_at,last_attempt_at,last_error,updated_at)
    VALUES (?,CASE WHEN ? IS NULL THEN CURRENT_TIMESTAMP END,CURRENT_TIMESTAMP,?,CURRENT_TIMESTAMP)
    ON CONFLICT(account_id) DO UPDATE SET
      last_success_at=CASE WHEN excluded.last_error IS NULL THEN CURRENT_TIMESTAMP ELSE metrics_sync_state.last_success_at END,
      last_attempt_at=CURRENT_TIMESTAMP,last_error=excluded.last_error,updated_at=CURRENT_TIMESTAMP`).run(accountId,error,error);
}

async function collectAccountMetrics(accountId) {
  const account=db.prepare("SELECT * FROM social_accounts WHERE id = ? AND status = 'connected'").get(accountId);
  if(!account) throw Object.assign(new Error("Bağlı sosyal hesap bulunamadı."),{status:404});
  const service=socialServices[account.platform];
  if(!service?.isConfigured()) throw Object.assign(new Error(`${account.platform} API yapılandırması eksik.`),{status:501});
  try {
    const live={...account,accessToken:decrypt(account.access_token)};
    if(!live.accessToken) throw new Error("Hesabın erişim anahtarı okunamadı; hesabı yeniden bağlayın.");
    const metric=normalized(await service.fetchStats(live));
    const result=db.prepare(`INSERT INTO account_metrics
      (account_id,followers,reach,engagement,views,impressions,clicks,saves,posts_count,raw_json)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(account.id,metric.followers,metric.reach,metric.engagement,metric.views,metric.impressions,metric.clicks,metric.saves,metric.postsCount,JSON.stringify(metric.raw));
    const publications=db.prepare(`SELECT pp.id,pp.post_id,pp.platform_post_id FROM post_publications pp
      JOIN posts p ON p.id=pp.post_id WHERE pp.account_id=? AND pp.status='published' AND pp.platform_post_id IS NOT NULL
      ORDER BY pp.published_at DESC LIMIT 50`).all(account.id);
    for(const publication of publications){
      try{const raw=await service.fetchPostStats(live,publication.platform_post_id);if(!raw)break;const m=normalized(raw);db.prepare(`INSERT INTO post_metrics
        (post_id,publication_id,platform,platform_post_id,likes,comments,shares,views,reach,impressions,clicks,saves,raw_json)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(publication.post_id,publication.id,account.platform,publication.platform_post_id,number(raw.likes),number(raw.comments),number(raw.shares),m.views,m.reach,m.impressions,m.clicks,m.saves,JSON.stringify(raw.raw||null));}catch(err){console.warn(`[metrics:${account.platform}:post]`,err.message);}
    }
    saveSyncState(account.id,null);
    return db.prepare("SELECT * FROM account_metrics WHERE id=?").get(result.lastInsertRowid);
  } catch(err){saveSyncState(account.id,String(err.message).slice(0,500));throw err;}
}

async function collectAllMetrics(){
  const accounts=db.prepare("SELECT id FROM social_accounts WHERE status='connected'").all();
  const result=[];
  for(const account of accounts){try{result.push({accountId:account.id,success:true,data:await collectAccountMetrics(account.id)});}catch(err){result.push({accountId:account.id,success:false,error:err.message});}}
  return result;
}

function startMetricsScheduler(){
  return cron.schedule(process.env.METRICS_CRON||"*/30 * * * *",()=>collectAllMetrics().catch(err=>console.error("[metrics]",err.message)));
}

module.exports={collectAccountMetrics,collectAllMetrics,startMetricsScheduler,normalized};
