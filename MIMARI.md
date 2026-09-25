# SocialDash kod haritası

## Katmanlar

- public/: mevcut tek sayfa arayüz, stiller ve tarayıcı JavaScript'i.
- server.js: Express başlangıcı, middleware, route bağlantıları ve sunucu yaşam döngüsü.
- routes/: auth, kullanıcı, ayarlar, sosyal hesaplar, gönderiler, medya, AI, haberler, bildirimler ve dashboard API'leri.
- services/: yayınlama, sosyal sağlayıcılar, depolama, AI, haber, e-posta ve zamanlayıcı.
- config/database.js: SQLite bağlantısı ve transaction içinde migration çalıştırma.
- db/migrations/: mevcut şema ve veri kaybetmeden eklenen kolonlar.
- middleware/: kimlik doğrulama ve güvenlik.
- tests/: API, sahiplik, güvenlik, kalıcılık ve hata senaryoları.

## Route tanımları

Aşağıdaki yollar route dosyasına göre göreli yollardır; mount önekleri server.js dosyasında tanımlıdır.

### routes/accounts.js

- `GET /:platform/callback`
- `GET /`
- `GET /:id`
- `POST /connect`
- `PUT /:id`
- `DELETE /:id`
- `POST /:id/refresh`

### routes/ai.js

- `GET /chats`
- `POST /chats`
- `GET /chats/:id/messages`
- `POST /chats/:id/messages`
- `PUT /chats/:id`
- `DELETE /chats/:id`
- `PATCH /chats/:id/archive`
- `PATCH /chats/:id/unarchive`
- `POST /hashtags`
- `POST /caption`
- `POST /content-ideas`
- `POST /chats/:id/restore`
- `PATCH /chats/:id/pin`
- `POST /chats/:id/duplicate`

### routes/auth.js

- `POST /register`
- `POST /login`
- `POST /refresh`
- `POST /logout`
- `POST /forgot-password`
- `POST /reset-password`
- `PUT /password`

### routes/dashboard.js

- `GET /`

### routes/media.js

- `GET /`
- `GET /:id`
- `POST /`
- `PUT /:id`
- `DELETE /:id`
- `POST /:id/restore`

### routes/news.js

- `GET /`
- `GET /trending`
- `POST /newsletter`

### routes/notifications.js

- `GET /push/public-key`
- `POST /push/subscribe`
- `DELETE /push/subscribe`
- `GET /`
- `PATCH /read-all`
- `PATCH /:id/read`
- `DELETE /`
- `DELETE /:id`
- `POST /:id/restore`

### routes/oauthLogin.js

- `GET /google`
- `GET /apple`
- `GET /google/callback`
- `POST /apple/callback`
- `POST /oauth/exchange`

### routes/platforms.js

- `GET /:accountId/stats`
- `GET /:accountId/posts`
- `GET /:accountId/analytics`

### routes/posts.js

- `GET /`
- `GET /:id`
- `POST /`
- `PUT /:id`
- `PATCH /:id/schedule`
- `POST /:id/retry`
- `DELETE /:id`
- `POST /:id/restore`

### routes/profile.js

- `GET /`
- `PUT /`
- `POST /avatar`
- `DELETE /avatar`
- `DELETE /`

### routes/search.js

- `GET /`

### routes/security.js

- `GET /sessions`
- `DELETE /sessions/:id`
- `POST /sessions/revoke-others`
- `POST /sessions/revoke-all`
- `POST /2fa/setup`
- `POST /2fa/verify`
- `DELETE /2fa`

### routes/settings.js

- `GET /`
- `PUT /`

## Kaynak dosyaları

- `.env.example`
- `.gitignore`
- `README.md`
- `TEST_RAPORU.md`
- `config/database.js`
- `db/migrations/001_init.js`
- `db/migrations/002_publication_tracking.js`
- `db/migrations/003_oauth_security.js`
- `db/migrations/004_async_publications.js`
- `db/migrations/005_post_media.js`
- `db/migrations/006_metrics.js`
- `db/migrations/007_messaging.js`
- `db/migrations/008_refresh_reuse_detection.js`
- `db/migrations/009_oauth_login.js`
- `db/migrations/010_notifications_soft_delete.js`
- `db/migrations/011_composite_indexes.js`
- `db/migrations/012_application_persistence.js`
- `middleware/auth.js`
- `middleware/cookies.js`
- `middleware/errorHandler.js`
- `middleware/rateLimit.js`
- `middleware/upload.js`
- `middleware/validation.js`
- `package-lock.json`
- `package.json`
- `public/css/app.css`
- `public/favicon.svg`
- `public/index.html`
- `public/js/ai.js`
- `public/js/api.js`
- `public/js/app.js`
- `public/js/calendar.js`
- `public/js/i18n.js`
- `public/js/media.js`
- `public/js/news.js`
- `public/js/notifications.js`
- `public/js/platforms.js`
- `public/js/posts.js`
- `public/js/router.js`
- `public/js/settings.js`
- `public/js/shell-ui.js`
- `public/js/state.js`
- `public/js/view-init.js`
- `public/sw.js`
- `routes/accounts.js`
- `routes/ai.js`
- `routes/auth.js`
- `routes/dashboard.js`
- `routes/media.js`
- `routes/news.js`
- `routes/notifications.js`
- `routes/oauthLogin.js`
- `routes/platforms.js`
- `routes/posts.js`
- `routes/profile.js`
- `routes/search.js`
- `routes/security.js`
- `routes/settings.js`
- `scripts/setup-local.js`
- `server.js`
- `services/ai/index.js`
- `services/mail.js`
- `services/mediaValidation.js`
- `services/metrics.js`
- `services/news/index.js`
- `services/notify.js`
- `services/oauthLogin/apple.js`
- `services/oauthLogin/google.js`
- `services/oauthLogin/index.js`
- `services/push.js`
- `services/scheduler.js`
- `services/social/base.js`
- `services/social/facebook.js`
- `services/social/index.js`
- `services/social/instagram.js`
- `services/social/linkedin.js`
- `services/social/threads.js`
- `services/social/tiktok.js`
- `services/social/x.js`
- `services/social/youtube.js`
- `services/storageService.js`
- `services/tokenVault.js`
- `services/totp.js`
- `tests/ai-service.test.js`
- `tests/application-persistence.test.js`
- `tests/auth.test.js`
- `tests/cookie-auth.test.js`
- `tests/csp-hardening.test.js`
- `tests/forgot-password-enumeration.test.js`
- `tests/isolation.test.js`
- `tests/mail-service.test.js`
- `tests/media-validation.test.js`
- `tests/migration-safety.test.js`
- `tests/news-service.test.js`
- `tests/notification-undo.test.js`
- `tests/oauth-login.test.js`
- `tests/pagination.test.js`
- `tests/posts.test.js`
- `tests/security.test.js`
- `tests/setup.js`
- `tests/social.test.js`
- `tests/storage-service.test.js`
