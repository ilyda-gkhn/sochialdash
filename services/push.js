const webpush=require("web-push");
const db=require("../config/database");
function isConfigured(){return Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT);}
function configure(){if(isConfigured())webpush.setVapidDetails(process.env.VAPID_SUBJECT,process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);}
async function deliverPush(userId,payload){if(!isConfigured())return {sent:0,configured:false};configure();const rows=db.prepare(`SELECT ps.* FROM push_subscriptions ps JOIN user_settings us ON us.user_id=ps.user_id WHERE ps.user_id=? AND us.push_notifications=1`).all(userId);let sent=0;for(const row of rows){try{await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify(payload),{TTL:3600});sent+=1;}catch(err){if([404,410].includes(err.statusCode))db.prepare("DELETE FROM push_subscriptions WHERE id=?").run(row.id);else console.warn("[push]",err.message);}}return {sent,configured:true};}
module.exports={isConfigured,deliverPush};
