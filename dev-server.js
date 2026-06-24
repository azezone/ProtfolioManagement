const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = process.cwd();
const watchFiles = ["server.js", "app.js", "index.html", "styles.css", ".env"];
let child = null;
let restartTimer = null;

function log(message) {
  console.log(`[dev] ${message}`);
}

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separator = trimmed.indexOf("=");
    if (separator === -1) return;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (key) {
      process.env[key] = value;
    }
  });
}

function proxySummary() {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.ALL_PROXY;
  return proxy ? `proxy=${proxy}` : "proxy=not set";
}

function startServer() {
  loadEnvFile();
  log(`starting server (${proxySummary()})`);

  child = spawn(process.execPath, ["--use-env-proxy", "server.js"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (child) {
      log(`server exited (${signal || code})`);
    }
  });
}

function stopServer() {
  if (!child) return;

  const current = child;
  child = null;
  current.kill();
}

function restartServer(reason) {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    log(`restart: ${reason}`);
    stopServer();
    startServer();
  }, 150);
}

function watchFile(file) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) return;

  fs.watch(filePath, { persistent: true }, (eventType) => {
    restartServer(`${file} ${eventType}`);
  });
}

process.on("SIGINT", () => {
  stopServer();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopServer();
  process.exit(0);
});

watchFiles.forEach(watchFile);
log(`watching ${watchFiles.filter((file) => fs.existsSync(path.join(root, file))).join(", ")}`);
startServer();
