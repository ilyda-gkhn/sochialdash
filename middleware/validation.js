const { z } = require("zod");

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.errors[0]?.message || "Geçersiz veri.";
      return res.status(400).json({ success: false, message, error: { code: "VALIDATION_ERROR", message } });
    }
    req.body = result.data;
    next();
  };
}

function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const message = result.error.errors[0]?.message || "Geçersiz sorgu parametreleri.";
      return res.status(400).json({ success: false, message, error: { code: "VALIDATION_ERROR", message } });
    }
    // Express 5 makes req.query getter-only (no setter), so reassigning it
    // silently no-ops. Store the parsed/coerced result separately instead.
    req.validatedQuery = result.data;
    next();
  };
}

const passwordSchema = z.string()
  .min(8, "Şifre en az 8 karakter olmalı.")
  .regex(/[a-z]/, "Şifre en az 1 küçük harf içermeli.")
  .regex(/[A-Z]/, "Şifre en az 1 büyük harf içermeli.")
  .regex(/[0-9]/, "Şifre en az 1 rakam içermeli.");

const schemas = {
  register: z.object({
    name: z.string().trim().min(3, "Ad soyad en az 3 karakter olmalı."),
    email: z.string().trim().email("Geçerli bir e-posta adresi girin."),
    password: passwordSchema
  }),
  login: z.object({
    email: z.string().trim().email("Geçerli bir e-posta adresi girin."),
    password: z.string().min(1, "Şifre zorunludur."),
    remember: z.boolean().optional(),
    twoFactorToken: z.string().regex(/^\d{6}$/, "6 haneli doğrulama kodunu girin.").optional()
  }),
  refresh: z.object({
    // Optional: the browser flow relies on the HttpOnly cookie instead;
    // this stays available for non-browser API clients / tests.
    refreshToken: z.string().min(10, "Geçersiz refresh token.").optional()
  }),
  forgotPassword: z.object({
    email: z.string().trim().email("Geçerli bir e-posta adresi girin.")
  }),
  resetPassword: z.object({
    token: z.string().min(10),
    password: passwordSchema
  }),
  changePassword: z.object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema
  }),
  deleteAccount: z.object({
    currentPassword: z.string().min(1, "Hesabı silmek için mevcut şifrenizi girin.")
  }),
  profile: z.object({
    name: z.string().trim().min(3, "Ad soyad en az 3 karakter olmalı."),
    email: z.string().trim().email("Geçerli bir e-posta adresi girin."),
    phone: z.string().trim().optional().default(""),
    username: z.string().trim().max(60).optional().default(""),
    title: z.string().trim().max(120).optional().default(""),
    country: z.string().trim().max(10).optional().default("+90")
  }),
  settings: z.object({
    theme: z.enum(["light", "dark", "system"]).optional(),
    language: z.enum(["tr", "en"]).optional(),
    timezone: z.enum(["UTC", "Europe/Istanbul"]).optional(),
    dateFormat: z.enum(["DD.MM.YYYY", "MM/DD/YYYY"]).optional(),
    emailNotifications: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    weeklySummary: z.boolean().optional(),
    connectionAlerts: z.boolean().optional(),
    autoDraft: z.boolean().optional(),
    sidebarOpen: z.boolean().optional(),
    selectedAccounts: z.record(z.string(), z.coerce.number().int().positive()).optional(),
    customTitles: z.record(z.string().max(120), z.array(z.string().max(300)).max(20)).optional()
  }),
  post: z.object({
    title: z.string().trim().max(200).optional().default(""),
    content: z.string().trim().max(5000).optional().default(""),
    platforms: z.array(z.enum(["Instagram", "Facebook", "X", "LinkedIn", "TikTok", "YouTube", "Threads"])).max(7).optional().default([]),
    accountIds: z.record(z.string(), z.coerce.number().int().positive()).optional().default({}),
    advancedSettings: z.object({hideLikes:z.boolean().optional(),disableComments:z.boolean().optional(),crossPostFacebook:z.boolean().optional(),madeForKids:z.boolean().optional(),followersOnlyReplies:z.boolean().optional()}).optional().default({}),
    status: z.enum(["draft", "scheduled"]).optional().default("draft"),
    scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
      mediaId: z.number().int().positive().nullable().optional()
      ,mediaIds: z.array(z.coerce.number().int().positive()).max(10).optional()
  }).superRefine((value, ctx) => {
    if (new Set(value.platforms).size !== value.platforms.length) ctx.addIssue({code:z.ZodIssueCode.custom,message:"Aynı platform birden fazla seçilemez."});
    if (value.status === "scheduled" && (!value.content || !value.platforms.length)) ctx.addIssue({code:z.ZodIssueCode.custom,message:"Planlama için içerik ve platform zorunludur."});
    if (value.status === "scheduled" && !value.scheduledAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scheduledAt"], message: "Planlanan gönderi için tarih ve saat zorunludur." });
    }
  }),
  postSchedule: z.object({
    scheduledAt: z.string().datetime({ offset: true, message: "Tarih saat dilimi içeren ISO biçiminde olmalı." })
  }),
  postsQuery: z.object({
    status: z.string().optional(),
    platform: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(50)
  }),
  aiChatCreate: z.object({
    title: z.string().trim().max(160).optional().default("Yeni Sohbet")
  }),
  aiChatUpdate: z.object({
    title: z.string().trim().min(1).max(160)
  }),
  aiMessage: z.object({
    text: z.string().trim().min(1, "Mesaj boş olamaz.").max(8000)
  }),
  aiHashtags: z.object({
    text: z.string().trim().min(1).max(2000)
  }),
  aiCaption: z.object({
    topic: z.string().trim().min(1).max(2000),
    tone: z.string().trim().max(60).optional()
  }),
  aiIdeas: z.object({
    topic: z.string().trim().min(1).max(2000)
  }),
  newsQuery: z.object({
    platform: z.string().optional(),
    category: z.string().optional(),
    date: z.string().optional(),
    search: z.string().optional()
  }),
  newsletter: z.object({ email: z.string().trim().email().max(254) }),
  notificationsQuery: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(50)
  }),
  mediaQuery: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(30),
    search: z.string().trim().max(180).optional(),
    type: z.enum(["FOTOĞRAF", "VIDEO", "GIF"]).optional(),
    sort: z.enum(["newest", "oldest", "name", "size"]).optional().default("newest")
  }),
  pushSubscription: z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({ p256dh: z.string().min(20).max(512), auth: z.string().min(8).max(256) })
  }),
  searchQuery: z.object({
    q: z.string().trim().min(1, "Arama terimi zorunlu.")
  }),
  accountConnect: z.object({
    platform: z.enum(["instagram", "facebook", "x", "linkedin", "tiktok", "youtube", "threads"]),
    authCode: z.string().optional()
  })
};

module.exports = { validateBody, validateQuery, schemas };
