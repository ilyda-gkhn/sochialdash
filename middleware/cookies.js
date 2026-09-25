// A single HttpOnly cookie carries the refresh token so it's invisible to
// page JavaScript (and therefore to XSS), instead of relying solely on
// localStorage. Scoped to /api/auth so it's never sent on unrelated
// requests. Kept deliberately minimal - only one cookie is ever needed, so
// a full cookie-parser dependency isn't worth adding.

const REFRESH_COOKIE_NAME = "sd_refresh";

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  for (const pair of String(header).split(";")) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    if (key) { try { cookies[key] = decodeURIComponent(value); } catch (_) { cookies[key] = value; } }
  }
  return cookies;
}

function appendSetCookie(res, cookieString) {
  const existing = res.getHeader("Set-Cookie");
  if (!existing) return res.setHeader("Set-Cookie", cookieString);
  res.setHeader("Set-Cookie", [...(Array.isArray(existing) ? existing : [existing]), cookieString]);
}

function baseAttributes() {
  const attrs = ["Path=/api/auth", "HttpOnly", "SameSite=Strict"];
  if (process.env.NODE_ENV === "production") attrs.push("Secure");
  return attrs;
}

function setRefreshCookie(res, token, { remember } = {}) {
  const parts = [`${REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}`, ...baseAttributes()];
  if (remember) {
    const days = Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 30);
    parts.push(`Max-Age=${days * 24 * 60 * 60}`);
  }
  // No Max-Age when !remember: browser-session-only cookie, matching the
  // "remember me" checkbox semantics already used for localStorage.
  appendSetCookie(res, parts.join("; "));
}

function clearRefreshCookie(res) {
  appendSetCookie(res, [`${REFRESH_COOKIE_NAME}=`, ...baseAttributes(), "Max-Age=0"].join("; "));
}

function getRefreshCookie(req) {
  return parseCookies(req)[REFRESH_COOKIE_NAME] || "";
}

module.exports = { parseCookies, setRefreshCookie, clearRefreshCookie, getRefreshCookie, REFRESH_COOKIE_NAME };
