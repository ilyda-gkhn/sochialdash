const db = require("../config/database");
const { deliverPush } = require("./push");
const { sendNotificationEmail } = require("./mail");

function createNotification(userId, { type = "general", icon = "notifications", color = "primary", title = "", message = "" }) {
  const result=db.prepare(`
    INSERT INTO notifications (user_id, type, icon, color, title, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, type, icon, color, title, message);
  const user=db.prepare(`SELECT u.email,COALESCE(us.email_notifications,1) email_notifications FROM users u LEFT JOIN user_settings us ON us.user_id=u.id WHERE u.id=?`).get(userId);
  void deliverPush(userId,{title,message,url:"/#/notifications",notificationId:result.lastInsertRowid}).catch(err=>console.warn("[push]",err.message));
  if(user?.email_notifications)void sendNotificationEmail(user.email,title,message).catch(err=>console.warn("[mail]",err.message));
  return result.lastInsertRowid;
}

module.exports = { createNotification };
