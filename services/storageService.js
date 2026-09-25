// Storage abstraction for uploaded files (avatars, media library).
//
// Today only local disk storage is implemented. The point of this module
// is that routes and upload middleware never touch the filesystem
// directly - they go through a storage object that exposes the same
// small interface (a multer-compatible engine + publicUrl/delete), so a
// future S3Storage or CloudinaryStorage class can be dropped in behind
// MEDIA_STORAGE_PROVIDER without changing any route code.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function safeExt(mime, originalname) {
  const map = {
    "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
    "image/webp": ".webp", "image/gif": ".gif", "video/mp4": ".mp4", "video/quicktime": ".mov"
  };
  if (map[mime]) return map[mime];
  const ext = path.extname(originalname || "").toLowerCase();
  return /^\.[a-z0-9]{2,5}$/.test(ext) ? ext : "";
}

class LocalDiskStorage {
  constructor(subdir) {
    this.subdir = subdir;
    this.dir = path.join(__dirname, "..", "uploads", subdir);
    fs.mkdirSync(this.dir, { recursive: true });
  }

  // multer custom storage engine interface: https://github.com/expressjs/multer#custom-storage-engine
  _handleFile(req, file, cb) {
    const filename = `${Date.now()}-${crypto.randomBytes(16).toString("hex")}${safeExt(file.mimetype, file.originalname)}`;
    const destPath = path.join(this.dir, filename);
    const outStream = fs.createWriteStream(destPath);
    file.stream.pipe(outStream);
    outStream.on("error", cb);
    outStream.on("finish", () => cb(null, { filename, path: destPath, size: outStream.bytesWritten }));
  }

  _removeFile(req, file, cb) {
    fs.unlink(file.path, () => cb(null));
  }

  // Non-multer helpers used by route handlers.
  publicUrl(filename) {
    return `/uploads/${this.subdir}/${filename}`;
  }

  delete(filePath) {
    return new Promise(resolve => fs.unlink(filePath, () => resolve()));
  }
}

const SUPPORTED_PROVIDERS = { local: LocalDiskStorage };

function createStorage(subdir) {
  const provider = String(process.env.MEDIA_STORAGE_PROVIDER || "local").toLowerCase();
  const StorageClass = SUPPORTED_PROVIDERS[provider];
  if (!StorageClass) {
    throw new Error(
      `MEDIA_STORAGE_PROVIDER=${provider} is not implemented. Supported: ${Object.keys(SUPPORTED_PROVIDERS).join(", ")}.`
    );
  }
  return new StorageClass(subdir);
}

module.exports = { createStorage, LocalDiskStorage };
