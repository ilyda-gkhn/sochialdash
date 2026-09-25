const multer = require("multer");
const { createStorage } = require("../services/storageService");

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ALLOWED_MEDIA_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "video/mp4", "video/quicktime"]);

const avatarStorage = createStorage("avatars");
const mediaStorage = createStorage("media");

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME.has(file.mimetype)) {
      return cb(new Error("Yalnızca JPG, JPEG, PNG veya WEBP dosyalarına izin verilir."));
    }
    cb(null, true);
  }
});

const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MEDIA_MIME.has(file.mimetype)) {
      return cb(new Error("Desteklenmeyen dosya türü."));
    }
    cb(null, true);
  }
});

module.exports = { avatarUpload, mediaUpload, avatarStorage, mediaStorage };
