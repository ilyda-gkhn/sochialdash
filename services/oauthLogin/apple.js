// Real "Sign in with Apple" flow. Apple has no userinfo endpoint - the
// identity comes from the signed id_token in the token response, so unlike
// Google we must verify that JWT's signature ourselves against Apple's
// published JWKS rather than trusting the decoded claims blindly.

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
const TOKEN_URL = "https://appleid.apple.com/auth/token";
const JWKS_URL = "https://appleid.apple.com/auth/keys";
const ISSUER = "https://appleid.apple.com";

function isConfigured() {
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    process.env.APPLE_PRIVATE_KEY &&
    process.env.OAUTH_REDIRECT_BASE
  );
}

function redirectUri() {
  return `${String(process.env.OAUTH_REDIRECT_BASE || "").replace(/\/$/, "")}/api/auth/apple/callback`;
}

// .env stores the PEM with literal "\n" sequences (like other multi-line
// secrets); restore real newlines before using it as a signing key.
function privateKey() {
  return String(process.env.APPLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

// Apple requires the client secret to be a short-lived JWT signed with the
// app's private key, not a static string. Regenerated on every request
// (cheap) rather than cached, to avoid any risk of using an expired one.
function buildClientSecret() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: process.env.APPLE_TEAM_ID,
      iat: now,
      exp: now + 300,
      aud: ISSUER,
      sub: process.env.APPLE_CLIENT_ID
    },
    privateKey(),
    { algorithm: "ES256", keyid: process.env.APPLE_KEY_ID }
  );
}

function getAuthorizationUrl({ state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: process.env.APPLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    response_mode: "form_post",
    scope: "name email",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });
  return `${AUTHORIZE_URL}?${params}`;
}

async function exchangeCode(code, codeVerifier) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.APPLE_CLIENT_ID,
    client_secret: buildClientSecret(),
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
    code_verifier: codeVerifier
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch (_) { payload = { message: text.slice(0, 500) }; }
  if (!response.ok) {
    const detail = payload.error_description || payload.error || payload.message || JSON.stringify(payload);
    throw Object.assign(new Error(`Apple OAuth hatası: ${detail}`), { status: 502, code: "APPLE_OAUTH_ERROR" });
  }
  return payload;
}

let jwksCache = { keys: [], fetchedAt: 0 };
async function getSigningKey(kid) {
  const ONE_HOUR = 60 * 60 * 1000;
  if (!jwksCache.keys.length || Date.now() - jwksCache.fetchedAt > ONE_HOUR) {
    const response = await fetch(JWKS_URL);
    if (!response.ok) throw Object.assign(new Error("Apple JWKS alınamadı."), { status: 502 });
    const payload = await response.json();
    jwksCache = { keys: payload.keys || [], fetchedAt: Date.now() };
  }
  const jwk = jwksCache.keys.find(k => k.kid === kid);
  if (!jwk) throw Object.assign(new Error("Apple id_token imza anahtarı bulunamadı."), { status: 401 });
  return crypto.createPublicKey({ key: jwk, format: "jwk" });
}

async function verifyIdToken(idToken) {
  const decodedHeader = jwt.decode(idToken, { complete: true })?.header;
  if (!decodedHeader?.kid) throw Object.assign(new Error("Apple id_token başlığı geçersiz."), { status: 401 });
  const publicKey = await getSigningKey(decodedHeader.kid);
  const claims = jwt.verify(idToken, publicKey, {
    algorithms: ["RS256"],
    audience: process.env.APPLE_CLIENT_ID,
    issuer: ISSUER
  });
  if (!claims.sub) throw Object.assign(new Error("Apple kullanıcı kimliği alınamadı."), { status: 401 });
  return {
    providerUserId: String(claims.sub),
    email: String(claims.email || "").trim().toLowerCase(),
    emailVerified: claims.email_verified === true || claims.email_verified === "true"
  };
}

module.exports = { isConfigured, getAuthorizationUrl, exchangeCode, verifyIdToken };
