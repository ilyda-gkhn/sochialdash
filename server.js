const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
require("dotenv").config();

if (!process.env.JWT_SECRET) {
  console.error("HATA: JWT_SECRET .env dosyasında tanımlı değil. Sunucu güvenli şekilde başlatılamaz.");
  process.exit(1);
}
const production=process.env.NODE_ENV==="production";
if(production){
  const invalid=[];
  if(String(process.env.JWT_SECRET).length<32||/change-this/i.test(process.env.JWT_SECRET))invalid.push("JWT_SECRET");
  if(!process.env.FRONTEND_ORIGIN)invalid.push("FRONTEND_ORIGIN");
  if(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY&&(String(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY).length<32||/change-this/i.test(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY)))invalid.push("SOCIAL_TOKEN_ENCRYPTION_KEY");
  if(invalid.length)throw new Error(`Güvensiz veya eksik üretim yapılandırması: ${invalid.join(", ")}`);
}

const db = require("./config/database"); // eslint-disable-line no-unused-vars
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");
const { startScheduler, startDailyCleanup } = require("./services/scheduler");
const { startMetricsScheduler } = require("./services/metrics");
const { apiLimiter } = require("./middleware/rateLimit");

const authRoutes = require("./routes/auth").router;
const oauthLoginRoutes = require("./routes/oauthLogin");
const profileRoutes = require("./routes/profile");
const securityRoutes = require("./routes/security");
const accountsRoutes = require("./routes/accounts");
const platformsRoutes = require("./routes/platforms");
const postsRoutes = require("./routes/posts");
const mediaRoutes = require("./routes/media");
const notificationsRoutes = require("./routes/notifications");
const aiRoutes = require("./routes/ai");
const newsRoutes = require("./routes/news");
const settingsRoutes = require("./routes/settings");
const dashboardRoutes = require("./routes/dashboard");
const searchRoutes = require("./routes/search");

const app = express();
const PORT = process.env.PORT || 3000;
if(process.env.TRUST_PROXY)app?.set?.("trust proxy",Number(process.env.TRUST_PROXY)||process.env.TRUST_PROXY);

const allowedOrigins = (process.env.FRONTEND_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
// Production requires FRONTEND_ORIGIN (enforced above) or the process
// won't even start, so this fallback list only ever applies in
// development - a fixed set of common local origins, never "accept
// anything" (origin:true), per the CORS hardening requirement.
const devFallbackOrigins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"];

// CSP: script-src has no 'unsafe-inline' - every script is external
// (public/js/*.js) and there are zero onXXX=/inline handlers, verified by
// tests/csp-hardening.test.js. style-src still allows 'unsafe-inline'
// because a handful of render functions compute per-item dynamic values
// (colors, bar widths/heights) as style="..." attributes in template
// strings (see public/js/media.js, news.js, platforms.js, settings.js);
// converting those to element.style.x assignments after DOM injection is a
// real follow-up but wasn't done here to avoid an unverified visual
// regression risk (no browser available to check rendering in this
// environment).
app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:","blob:","https:"],fontSrc:["'self'","data:"],connectSrc:["'self'"],workerSrc:["'self'","blob:"],objectSrc:["'none'"],frameAncestors:["'none'"],baseUri:["'self'"],formAction:["'self'"]}},referrerPolicy:{policy:"no-referrer"},crossOriginResourcePolicy:{policy:"cross-origin"}}));
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : devFallbackOrigins,
  credentials: true
}));
app.use(express.json({ limit: "2mb" }));
app.use("/api",apiLimiter);

app.use("/uploads", express.static(path.join(__dirname, "uploads"),{dotfiles:"deny",setHeaders:res=>{res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Cache-Control","public, max-age=86400");}}));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/capabilities",(req,res)=>res.json({success:true,data:{ai:require("./services/ai").isConfigured(),news:require("./services/news").isConfigured(),platforms:Object.fromEntries(Object.entries(require("./services/social")).map(([key,service])=>[key,service.isConfigured()]))}}));

app.get("/api/test", (req, res) => {
  res.json({ message: "SocialDash backend çalışıyor." });
});

app.use("/api/auth", authRoutes);
app.use("/api/auth", oauthLoginRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/platforms", platformsRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/search", searchRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use("/api", notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  const publicationTask=startScheduler();
  const metricsTask=startMetricsScheduler();
  const cleanupTask=startDailyCleanup();
  const server=app.listen(PORT, () => {
    console.log(`SocialDash çalışıyor: http://localhost:${PORT}`);
  });
  const shutdown=signal=>{console.log(`${signal}: sunucu kapatılıyor.`);publicationTask?.stop?.();metricsTask?.stop?.();cleanupTask?.stop?.();server.close(()=>{db.close();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();};
  process.once("SIGTERM",()=>shutdown("SIGTERM"));process.once("SIGINT",()=>shutdown("SIGINT"));
}

module.exports = app;
