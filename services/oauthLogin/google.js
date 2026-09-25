// Real Google OAuth2 login flow (authorization code + PKCE). This is
// distinct from services/social/youtube.js: that one connects a YouTube
// channel for publishing after the user is already authenticated; this one
// authenticates the user in the first place, on the login/register screen.

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.OAUTH_REDIRECT_BASE
  );
}

function redirectUri() {
  return `${String(process.env.OAUTH_REDIRECT_BASE || "").replace(/\/$/, "")}/api/auth/google/callback`;
}

function getAuthorizationUrl({ state, codeChallenge }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });
  return `${AUTHORIZE_URL}?${params}`;
}

async function apiFetch(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch (_) { payload = { message: text.slice(0, 500) }; }
  if (!response.ok) {
    const detail = payload.error_description || payload.error || payload.message || JSON.stringify(payload);
    throw Object.assign(new Error(`Google OAuth hatası: ${detail}`), { status: 502, code: "GOOGLE_OAUTH_ERROR" });
  }
  return payload;
}

async function exchangeCode(code, codeVerifier) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
    code_verifier: codeVerifier
  });
  return apiFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
}

async function fetchProfile(accessToken) {
  const payload = await apiFetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!payload.sub) throw new Error("Google kullanıcı kimliği alınamadı.");
  return {
    providerUserId: String(payload.sub),
    email: String(payload.email || "").trim().toLowerCase(),
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: payload.name || payload.given_name || ""
  };
}

module.exports = { isConfigured, getAuthorizationUrl, exchangeCode, fetchProfile };
