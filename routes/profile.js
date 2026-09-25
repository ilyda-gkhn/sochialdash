const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const db = require("../config/database");
const { authenticateToken } = require("../middleware/auth");
const { validateBody, schemas } = require("../middleware/validation");
const { avatarUpload, avatarStorage, mediaStorage } = require("../middleware/upload");
const { AppError } = require("../middleware/errorHandler");

const router = express.Router();
router.use(authenticateToken);

const PROFILE_FIELDS = "id, name, email, phone, username, title, country, profile_image, plan, two_factor_enabled, created_at";

router.get("/", (req, res, next) => {
  try {
    const user = db.prepare(`SELECT ${PROFILE_FIELDS} FROM users WHERE id = ?`).get(req.user.id);
    if (!user) throw new AppError(404, "Kullanıcı bulunamadı.");
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

router.put("/", validateBody(schemas.profile), (req, res, next) => {
  try {
    const { name, email, phone, username, title, country } = req.body;
    const cleanEmail = email.toLowerCase();

    if (phone && (!/^[\d\s()-]{7,18}$/.test(phone) || phone.replace(/\D/g, "").length < 7)) {
      throw new AppError(400, "Geçerli bir telefon numarası girin.");
    }

    const existingEmail = db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(cleanEmail, req.user.id);
    if (existingEmail) throw new AppError(409, "Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor.");

    if (username) {
      const existingUsername = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(username, req.user.id);
      if (existingUsername) throw new AppError(409, "Bu kullanıcı adı zaten alınmış.");
    }

    const result = db.prepare(`
      UPDATE users SET name = ?, email = ?, phone = ?, username = ?, title = ?, country = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, cleanEmail, phone, username, title, country, req.user.id);

    if (result.changes === 0) throw new AppError(404, "Kullanıcı bulunamadı.");

    const user = db.prepare(`SELECT ${PROFILE_FIELDS} FROM users WHERE id = ?`).get(req.user.id);
    res.json({ success: true, message: "Profil başarıyla güncellendi.", user });
  } catch (err) {
    next(err);
  }
});

router.post("/avatar", (req, res, next) => {
  avatarUpload.single("avatar")(req, res, (err) => {
    if (err) return next(new AppError(400, err.message || "Dosya yüklenemedi."));
    try {
      if (!req.file) throw new AppError(400, "Dosya bulunamadı.");

      const old = db.prepare("SELECT profile_image FROM users WHERE id = ?").get(req.user.id);
      const publicPath = avatarStorage.publicUrl(req.file.filename);
      db.prepare("UPDATE users SET profile_image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(publicPath, req.user.id);

      if (old?.profile_image) {
        avatarStorage.delete(path.join(avatarStorage.dir, path.basename(old.profile_image)));
      }

      res.json({ success: true, message: "Profil fotoğrafı güncellendi.", profile_image: publicPath });
    } catch (e) {
      next(e);
    }
  });
});

router.delete("/avatar", (req, res, next) => {
  try {
    const old = db.prepare("SELECT profile_image FROM users WHERE id = ?").get(req.user.id);
    db.prepare("UPDATE users SET profile_image = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.user.id);
    if (old?.profile_image) {
      avatarStorage.delete(path.join(avatarStorage.dir, path.basename(old.profile_image)));
    }
    res.json({ success: true, message: "Profil fotoğrafı kaldırıldı." });
  } catch (err) {
    next(err);
  }
});

router.delete("/", validateBody(schemas.deleteAccount), async (req, res, next) => {
  try {
    const user = db.prepare("SELECT password, profile_image FROM users WHERE id = ?").get(req.user.id);
    if (!user) throw new AppError(404, "Kullanıcı bulunamadı.");
    const passwordCorrect = await bcrypt.compare(req.body.currentPassword, user.password);
    if (!passwordCorrect) throw new AppError(401, "Mevcut şifre hatalı.");

    const mediaFiles = db.prepare("SELECT path FROM media WHERE user_id = ?").all(req.user.id).map(row => row.path);
    const avatarFile = user.profile_image
      ? path.join(avatarStorage.dir, path.basename(user.profile_image))
      : null;

    const deleted = db.prepare("DELETE FROM users WHERE id = ?").run(req.user.id);
    if (deleted.changes === 0) throw new AppError(404, "Kullanıcı bulunamadı.");

    for (const file of mediaFiles.filter(Boolean)) mediaStorage.delete(file);
    if (avatarFile) avatarStorage.delete(avatarFile);
    res.json({ success: true, message: "Hesabınız ve verileriniz kalıcı olarak silindi." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
