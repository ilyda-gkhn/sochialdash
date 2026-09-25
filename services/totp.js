const crypto = require("crypto");

function base32Encode(buffer) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function totpAt(secretBuffer, counter) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secretBuffer).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

function verifyTotp(secretHex, token, now = Date.now()) {
  if (!/^[a-f0-9]{40}$/i.test(String(secretHex || "")) || !/^\d{6}$/.test(String(token || ""))) {
    return false;
  }

  const secretBuffer = Buffer.from(secretHex, "hex");
  const counter = Math.floor(now / 30000);
  for (let drift = -1; drift <= 1; drift += 1) {
    if (totpAt(secretBuffer, counter + drift) === String(token)) return true;
  }
  return false;
}

module.exports = { base32Encode, verifyTotp };
