const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.", error: { code: "RATE_LIMITED", message: "Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin." } }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.", error: { code: "RATE_LIMITED", message: "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin." } }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "AI istekleri için hız limiti aşıldı.", error: { code: "RATE_LIMITED", message: "AI istekleri için hız limiti aşıldı." } }
});

module.exports = { apiLimiter, authLimiter, aiLimiter };
