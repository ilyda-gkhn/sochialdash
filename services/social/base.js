// Shared scaffold for a real OAuth/API integration. Each platform file below
// fills in its own env var names and authorize URL. None of these fake a
// successful connection or return synthetic stats - they report clearly
// when credentials are missing so the caller (routes/accounts.js,
// routes/platforms.js) can be honest with the user.

function apiError(name, status, payload) {
  const detail = payload?.error_description || payload?.error?.message || payload?.message || JSON.stringify(payload || {});
  return Object.assign(new Error(`${name} API hatası (${status}): ${detail}`), { status: status >= 400 && status < 500 ? 400 : 502, providerStatus: status, retryable: status === 429 || status >= 500 });
}

async function fetchJson(name, url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch (_) { payload = { message: text.slice(0, 500) }; }
  if (!response.ok) throw apiError(name, response.status, payload);
  return { payload, headers: response.headers, status: response.status };
}

function makeService(config) {
  const { name, clientIdEnv, clientSecretEnv, authorizeUrl, scope } = config;
  const requiredEnv = [clientIdEnv, clientSecretEnv, "SOCIAL_TOKEN_ENCRYPTION_KEY", ...(config.requiredEnv || [])];
  function isConfigured() {
    return requiredEnv.every(env => Boolean(process.env[env])) && Boolean(process.env.OAUTH_REDIRECT_BASE);
  }

  const redirectUri = () => `${String(process.env.OAUTH_REDIRECT_BASE || "").replace(/\/$/, "")}/api/accounts/${name}/callback`;
  function getAuthorizationUrl({ state, codeChallenge }) {
    if (!isConfigured()) {
      return { configured: false, requiredEnv: [...requiredEnv, "OAUTH_REDIRECT_BASE"] };
    }
    const params = new URLSearchParams({ response_type: "code", redirect_uri: redirectUri(), scope, state });
    params.set(config.authorizationClientParam || "client_id", process.env[clientIdEnv]);
    if (config.pkce) { params.set("code_challenge", codeChallenge); params.set("code_challenge_method", "S256"); }
    for (const [key, value] of Object.entries(config.authorizationParams || {})) params.set(key, value);
    return { configured: true, url: `${authorizeUrl}?${params}` };
  }

  async function tokenRequest(params, codeVerifier) {
    const body = new URLSearchParams(params);
    body.set(config.clientIdParam || "client_id", process.env[clientIdEnv]);
    if (!config.basicTokenAuth) body.set(config.clientSecretParam || "client_secret", process.env[clientSecretEnv]);
    if (codeVerifier && config.pkce) body.set("code_verifier", codeVerifier);
    const headers = { "Content-Type": "application/x-www-form-urlencoded" };
    if (config.basicTokenAuth) headers.Authorization = `Basic ${Buffer.from(`${process.env[clientIdEnv]}:${process.env[clientSecretEnv]}`).toString("base64")}`;
    const { payload } = await fetchJson(name, config.tokenUrl, { method: "POST", headers, body });
    return payload;
  }
  const exchangeCode = (code, verifier) => tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() }, verifier);
  const refreshToken = refresh => tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });
  async function fetchProfile(accessToken) {
    const { payload } = await fetchJson(name, config.profileUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    return config.normalizeProfile(payload);
  }
  async function fetchProfiles(accessToken) {
    if (config.fetchProfiles) return config.fetchProfiles({ accessToken, fetchJson });
    return [await fetchProfile(accessToken)];
  }
  async function publish(account, post) {
    if (!config.publish) throw Object.assign(new Error(`${name} için yayınlama adaptörü bu sürümde desteklenmiyor.`), { status: 501 });
    const enabled=Object.entries(post.advancedSettings||{}).filter(([,value])=>value).map(([key])=>key);
    if(enabled.some(key=>!(config.supportedSettings||[]).includes(key)))throw Object.assign(new Error("Seçili gelişmiş ayarlar bu platform adaptöründe desteklenmiyor. Ayarları kapatıp yeniden deneyin."),{status:422});
    return config.publish({ account, post, fetchJson });
  }
  async function checkStatus(account, remoteId) {
    if (!config.checkStatus) return { status: "published", id: remoteId };
    return config.checkStatus({ account, remoteId, fetchJson });
  }
  async function fetchStats(account) {
    if (!config.fetchStats) throw Object.assign(new Error(`${name}: bu platformun istatistik API'si yapılandırılmamış.`), { status: 501 });
    return config.fetchStats({ account, fetchJson });
  }

  async function fetchPostStats(account, remoteId) {
    if (!config.fetchPostStats) return null;
    return config.fetchPostStats({ account, remoteId, fetchJson });
  }

  return { name, isConfigured, getAuthorizationUrl, exchangeCode, refreshToken, fetchProfile, fetchProfiles, publish, checkStatus, fetchStats, fetchPostStats };
}

module.exports = { makeService };
