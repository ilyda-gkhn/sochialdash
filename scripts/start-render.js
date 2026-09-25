const { spawn } = require("node:child_process");
const origin = process.env.RENDER_EXTERNAL_URL;
if (!origin || !origin.startsWith("https://")) {
  console.error("Render HTTPS adresi bulunamadı.");
  process.exit(1);
}
const child = spawn(process.execPath, ["server.js"], {
  cwd: require("node:path").resolve(__dirname, ".."),
  stdio: "inherit",
  env: { ...process.env, FRONTEND_ORIGIN: origin, APP_BASE_URL: origin,
    OAUTH_REDIRECT_BASE: origin, MEDIA_PUBLIC_BASE_URL: origin, TRUST_PROXY: "1" }
});
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error(error.message); process.exit(1); });
child.on("exit", code => process.exit(code ?? 1));
