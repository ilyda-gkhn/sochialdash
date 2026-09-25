// Standard status -> error code map, used whenever a route doesn't set its own code.
const STATUS_CODES = {
  400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND",
  409: "CONFLICT", 422: "UNPROCESSABLE_ENTITY", 429: "RATE_LIMITED",
  500: "INTERNAL_ERROR", 501: "NOT_IMPLEMENTED", 502: "UPSTREAM_ERROR",
  503: "SERVICE_UNAVAILABLE", 504: "UPSTREAM_TIMEOUT"
};

class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || STATUS_CODES[status] || "ERROR";
    this.isAppError = true;
  }
}

// Standard API error envelope: { success:false, error:{code,message}, message }.
// `message` is kept at the top level too for backward compatibility with
// existing frontend code that reads `data.message` directly.
function sendError(res, status, code, message, extra = {}) {
  return res.status(status).json({ success: false, message, error: { code, message }, ...extra });
}

function notFoundHandler(req, res) {
  sendError(res, 404, "NOT_FOUND", "Kaynak bulunamadı.");
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err && err.isAppError) {
    return sendError(res, err.status, err.code, err.message);
  }

  if (err && err.name === "ZodError") {
    const message = err.errors?.[0]?.message || "Geçersiz veri.";
    return sendError(res, 400, "VALIDATION_ERROR", message);
  }

  if (err && err.type === "entity.parse.failed") {
    return sendError(res, 400, "INVALID_JSON", "Geçersiz JSON gövdesi.");
  }

  if (err && err.code === "LIMIT_FILE_SIZE") {
    return sendError(res, 400, "FILE_TOO_LARGE", "Dosya boyutu izin verilen sınırı aşıyor.");
  }

  console.error(err);
  const isProd = process.env.NODE_ENV === "production";
  return sendError(res, 500, "INTERNAL_ERROR", "Sunucu hatası oluştu.",
    isProd ? {} : { detail: String(err && err.message || err) });
}

module.exports = { AppError, notFoundHandler, errorHandler, sendError, STATUS_CODES };
