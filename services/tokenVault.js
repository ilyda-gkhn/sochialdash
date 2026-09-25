const crypto = require("crypto");

function key() {
  const secret = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!secret) throw Object.assign(new Error("SOCIAL_TOKEN_ENCRYPTION_KEY tanımlı değil."), { status: 503 });
  return crypto.createHash("sha256").update(secret).digest();
}
function encrypt(value) {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return `enc:v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${ciphertext.toString("base64url")}`;
}
function decrypt(value) {
  if (!value) return "";
  if (!String(value).startsWith("enc:v1:")) return String(value);
  const [, , iv, tag, ciphertext] = String(value).split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
module.exports = { encrypt, decrypt };
