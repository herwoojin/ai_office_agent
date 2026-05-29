// Electron main process — single-binary wrapper around the Next.js dev-server.
//
// 부팅 순서:
//   1) (옵션) OpenClaw 게이트웨이가 죽어 있으면 spawn
//   2) tsx 로 dev-server.ts 를 자식 프로세스로 띄움
//   3) 포트 3000 LISTEN 또는 "Dev server ready" 로그 감지될 때까지 대기
//   4) BrowserWindow 에 http://localhost:3000 로드
//   5) 앱 종료 시 자식 프로세스 모두 정리
//
// 빌드: cd desk_rpg_model && npm run electron:build:mac (또는 :win)
// 개발 실행: npm run electron:dev

const { app, BrowserWindow, dialog, shell, Menu, Tray, nativeImage } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const net = require("node:net");
const fs = require("node:fs");

const PORT = Number(process.env.AI_OFFICE_PORT || 3000);
const GATEWAY_PORT = Number(process.env.AI_OFFICE_GATEWAY_PORT || 18789);
const ROOT = path.resolve(__dirname, "..");
const LOG_PATH = path.join(ROOT, "logs", "electron.log");
const READY_TIMEOUT_MS = 90_000;
const isDev = !app.isPackaged;

let mainWindow = null;
let splashWindow = null;
let devServerProc = null;
let gatewayProc = null;
let shuttingDown = false;
let tray = null;

function ensureDirs() {
  fs.mkdirSync(path.join(ROOT, "logs"), { recursive: true });
  fs.mkdirSync(path.join(ROOT, ".pids"), { recursive: true });
}

function log(line) {
  try {
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${line}\n`);
  } catch {}
  if (isDev) console.log(line);
}

function probePort(port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve(ok);
    };
    sock.setTimeout(800);
    sock.once("connect", () => finish(true));
    sock.once("timeout", () => finish(false));
    sock.once("error", () => finish(false));
    sock.connect(port, "127.0.0.1");
  });
}

function findBinary(names) {
  const PATH = (process.env.PATH || "").split(path.delimiter);
  const extras =
    process.platform === "darwin"
      ? ["/opt/homebrew/bin", "/usr/local/bin"]
      : process.platform === "win32"
      ? [path.join(process.env.APPDATA || "", "npm")]
      : [];
  for (const name of names) {
    const candidates = [...PATH, ...extras];
    for (const dir of candidates) {
      if (!dir) continue;
      const suffixes = process.platform === "win32" ? [".cmd", ".exe", ""] : [""];
      for (const sfx of suffixes) {
        const full = path.join(dir, name + sfx);
        try {
          if (fs.existsSync(full)) return full;
        } catch {}
      }
    }
  }
  return null;
}

// ─── Splash window (boot-time UX) ──────────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 320,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0f0f15;color:#e5e5ee;font-family:-apple-system,Segoe UI,sans-serif;
         display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;
         border-radius:14px;border:1px solid #2a2a35;overflow:hidden;}
    .badge{font-size:11px;color:#7c8cff;letter-spacing:.12em;text-transform:uppercase;margin-bottom:10px;}
    h1{margin:0 0 4px;font-size:22px;font-weight:600;}
    p{margin:18px 0 0;font-size:12px;color:#9090a0;}
    .spin{width:36px;height:36px;border:3px solid #22222e;border-top-color:#7c8cff;border-radius:50%;
          animation:r 1s linear infinite;margin-top:24px;}
    @keyframes r{to{transform:rotate(360deg)}}
    #status{margin-top:14px;font-size:11px;color:#7c8cff;min-height:14px;}
  </style></head><body>
    <div class="badge">AI Office Agents</div>
    <h1>가상 사무실 부팅 중</h1>
    <div class="spin"></div>
    <div id="status">초기화 …</div>
    <p>처음 실행 시 의존성 설치로 1~2분 걸릴 수 있어요.</p>
    <script>
      const el = document.getElementById("status");
      window.addEventListener("message", (e) => { if (typeof e.data === "string") el.textContent = e.data; });
    </script>
  </body></html>`;
  splashWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  splashWindow.once("ready-to-show", () => splashWindow && splashWindow.show());
}

function setSplashStatus(msg) {
  log(`[splash] ${msg}`);
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(
      `document.getElementById("status").textContent = ${JSON.stringify(msg)};`,
    ).catch(() => {});
  }
}

// ─── Child process spawn helpers ──────────────────────────────────────────────
function spawnGatewayIfNeeded() {
  return probePort(GATEWAY_PORT).then((up) => {
    if (up) return false;
    const oc = findBinary(["openclaw"]);
    if (!oc) {
      log("[gateway] openclaw binary not found — skipping");
      return false;
    }
    log(`[gateway] spawning: ${oc} gateway --port ${GATEWAY_PORT}`);
    const out = fs.openSync(path.join(ROOT, "logs", "openclaw.log"), "a");
    gatewayProc = spawn(oc, ["gateway", "--port", String(GATEWAY_PORT)], {
      cwd: ROOT,
      stdio: ["ignore", out, out],
      detached: false,
      env: process.env,
    });
    gatewayProc.on("exit", (code) => log(`[gateway] exited code=${code}`));
    return true;
  });
}

function spawnDevServer() {
  const npm = findBinary(["npm"]) || "npm";
  log(`[dev] spawning: ${npm} run dev (cwd=${ROOT})`);

  // Use npm so the user's existing scripts and node_modules/.bin take over.
  // shell:true on win32 so .cmd extension resolves properly.
  devServerProc = spawn(npm, ["run", "dev"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(PORT) },
    shell: process.platform === "win32",
  });
  const logFile = fs.openSync(path.join(ROOT, "logs", "deskrpg.log"), "a");
  devServerProc.stdout.on("data", (b) => fs.appendFileSync(logFile, b));
  devServerProc.stderr.on("data", (b) => fs.appendFileSync(logFile, b));
  devServerProc.on("exit", (code) => {
    log(`[dev] exited code=${code}`);
    if (!shuttingDown) {
      // Crash → tell user
      dialog
        .showMessageBox(mainWindow ?? splashWindow ?? null, {
          type: "error",
          title: "AI Office Agents",
          message: "DeskRPG 개발 서버가 종료되었습니다.",
          detail: `logs/deskrpg.log 을 확인하세요.\n종료 코드: ${code}`,
          buttons: ["로그 열기", "닫기"],
          defaultId: 0,
        })
        .then(({ response }) => {
          if (response === 0) shell.openPath(path.join(ROOT, "logs", "deskrpg.log"));
          app.quit();
        });
    }
  });
}

async function waitForReady() {
  const start = Date.now();
  setSplashStatus("Next.js 서버 시작 중 …");
  while (Date.now() - start < READY_TIMEOUT_MS) {
    if (await probePort(PORT)) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

// ─── Main window ───────────────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0f0f15",
    title: "AI Office Agents",
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      // localhost dev TLS isn't an issue since we always serve http
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}/`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // External http(s) links open in the OS browser
    if (/^https?:\/\//.test(url) && !url.startsWith(`http://localhost:${PORT}`)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

function createTray() {
  try {
    const icon = nativeImage.createEmpty(); // 시스템 기본 아이콘
    tray = new Tray(icon);
    tray.setToolTip("AI Office Agents");
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: "창 보이기", click: () => mainWindow && mainWindow.show() },
        {
          label: "브라우저에서 열기",
          click: () => shell.openExternal(`http://localhost:${PORT}/`),
        },
        { type: "separator" },
        { label: "종료", click: () => app.quit() },
      ]),
    );
  } catch (e) {
    log(`[tray] failed: ${e.message}`);
  }
}

// ─── Lifecycle ─────────────────────────────────────────────────────────────────
async function boot() {
  ensureDirs();
  createSplash();

  // 1) Gateway
  try {
    setSplashStatus("OpenClaw 게이트웨이 확인 중 …");
    await spawnGatewayIfNeeded();
  } catch (e) {
    log(`[boot] gateway error: ${e && e.message}`);
  }

  // 2) Dev server
  const alreadyUp = await probePort(PORT);
  if (!alreadyUp) {
    setSplashStatus("DeskRPG 개발 서버 시작 중 …");
    spawnDevServer();
  } else {
    log(`[boot] port ${PORT} already in use — reusing existing dev server`);
  }

  // 3) Wait ready
  const ok = await waitForReady();
  if (!ok) {
    await dialog.showMessageBox(splashWindow ?? null, {
      type: "warning",
      title: "AI Office Agents",
      message: "서버가 90초 안에 준비되지 않았어요.",
      detail: `logs/deskrpg.log 을 확인해주세요.\n잠시 후 창이 열리면 정상적으로 동작할 수 있습니다.`,
      buttons: ["계속"],
    });
  }

  // 4) Open main window
  createMainWindow();
  createTray();
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
    splashWindow = null;
  }
}

app.whenReady().then(boot);

app.on("window-all-closed", () => {
  // On macOS keep app alive even when window closes (use tray to relaunch).
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (!mainWindow) createMainWindow();
});

app.on("before-quit", () => {
  shuttingDown = true;
  for (const proc of [devServerProc, gatewayProc]) {
    if (!proc || proc.killed) continue;
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(proc.pid), "/f", "/t"]);
      } else {
        proc.kill("SIGTERM");
      }
    } catch (e) {
      log(`[shutdown] kill error: ${e.message}`);
    }
  }
});
