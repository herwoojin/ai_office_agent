#!/usr/bin/env node
/**
 * record-demo.js — Playwright 로 AI Office Agents 데모 영상 + 스크린샷 자동 생성.
 *
 * 출력:
 *   demo/screenshots/01-login.png ... 06-bubble.png
 *   demo/video/ai-office-demo.webm
 *
 * 흐름:
 *   1) JWT 쿠키 주입 → /channels 로 이동
 *   2) 채널 진입 → Phaser 맵 + 3명 NPC 시각화
 *   3) /office/task 트리거 → NPC 자리 이동
 *   4) /office/meeting 트리거 → 회의실 모임 + 풍선
 *   5) 각 단계마다 PNG 캡쳐
 *
 * 실행: node demo/record-demo.js
 */

const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const DESK_RPG = path.join(ROOT, "desk_rpg_model");

// .env.local 로드
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const l of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv(path.join(DESK_RPG, ".env.local"));
loadEnv(path.join(ROOT, ".env.local"));

const { SignJWT } = require(path.join(DESK_RPG, "node_modules", "jose"));
const Database = require(path.join(DESK_RPG, "node_modules", "better-sqlite3"));

const JWT_SECRET = process.env.JWT_SECRET || "deskrpg-dev-jwt-secret-do-not-use-in-production";
const BASE = "http://localhost:3000";
const TRIGGER = "http://127.0.0.1:13000";

async function mintJWT(userId, nickname) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return await new SignJWT({ userId, nickname })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").setIssuedAt().sign(secret);
}

async function pause(ms) { await new Promise((r) => setTimeout(r, ms)); }

async function trigger(p) {
  try {
    await fetch(TRIGGER + p.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p.body || {}),
    });
  } catch (e) { console.warn("trigger error:", e.message); }
}

(async () => {
  const SCREENS = path.join(__dirname, "screenshots");
  const VIDEO_DIR = path.join(__dirname, "video");
  fs.mkdirSync(SCREENS, { recursive: true });
  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  // 사용자 + 채널 + 캐릭터 정보
  const db = new Database(path.join(DESK_RPG, "data", "deskrpg.db"));
  const user = db.prepare("SELECT id, nickname FROM users LIMIT 1").get();
  const channel = db.prepare("SELECT id FROM channels LIMIT 1").get();
  const character = db.prepare("SELECT id FROM characters WHERE user_id=? LIMIT 1").get(user?.id);
  db.close();
  if (!user || !channel || !character) {
    console.error("✗ user/channel/character 누락:", { user, channel, character });
    process.exit(1);
  }
  console.log(`✓ user=${user.nickname}, channel=${channel.id.slice(0, 8)}..., character=${character.id.slice(0, 8)}...`);
  const GAME_URL = `${BASE}/game?channelId=${channel.id}&characterId=${character.id}`;

  const token = await mintJWT(user.id, user.nickname);

  // Launch headed browser with video recording
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: VIDEO_DIR, size: { width: 1440, height: 900 } },
  });
  // JWT 쿠키 주입
  await context.addCookies([{
    name: "token", value: token, domain: "localhost", path: "/",
    httpOnly: true, secure: false, sameSite: "Lax",
    expires: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  }]);
  const page = await context.newPage();

  async function shot(filename, label) {
    const target = path.join(SCREENS, filename);
    await page.screenshot({ path: target, fullPage: false });
    console.log(`  📸 ${filename}  (${label})`);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("씬 1: 채널 리스트 (홈)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  await page.goto(`${BASE}/channels`, { waitUntil: "domcontentloaded" });
  await pause(2500);
  await shot("01-channels-list.png", "채널 목록");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("씬 2: 채널 진입 (Phaser 맵 + 3명 NPC)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  await page.goto(GAME_URL, { waitUntil: "domcontentloaded" });
  // Phaser 씬이 로드되는 데 시간 필요
  await pause(8000);
  await shot("02-office-scene.png", "오피스 진입 — 3명 NPC 가시화");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("씬 3: 산책 모드 (10초 관찰)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  await pause(8000);
  await shot("03-wandering.png", "NPC 자율 산책");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("씬 4: /task 트리거 — 자기 자리로 이동");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  await trigger({ url: "/office/task", body: { task: "여름 시즌 신선식품 전략 검토" } });
  await pause(3500);
  await shot("04-task-dispatched.png", "/task — 자기 자리 이동 + 풍선");
  await pause(3500);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("씬 5: /meeting 트리거 — 회의실 소집");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  trigger({ url: "/office/meeting", body: { topic: "여름 한정 음료 카테고리 확대 (한 줄 의견만)" } });
  // 회의 시작 → 좌석 이동 직후 캡쳐
  await pause(2500);
  await shot("05-meeting-start.png", "회의 시작 — 3명 좌석 모임");

  // 회의 진행 (LLM 응답 풍선) — 70초 정도 진행 중
  await pause(20000);
  await shot("06-meeting-llm-bubble.png", "LLM 의견 풍선 — 회의 중반");

  await pause(30000);
  await shot("07-meeting-late.png", "회의 후반");

  // 회의 종료 후 자기 자리로 복귀까지 대기
  await pause(20000);
  await shot("08-meeting-end.png", "회의 종료 — 자기 자리 복귀");

  console.log("\n✅ 녹화 종료");
  await context.close();
  await browser.close();

  // 녹화된 webm 을 mp4 로 변환 + 파일명 정리
  const webmFiles = fs.readdirSync(VIDEO_DIR).filter((f) => f.endsWith(".webm"));
  if (webmFiles.length) {
    const src = path.join(VIDEO_DIR, webmFiles[0]);
    const dstWebm = path.join(VIDEO_DIR, "ai-office-demo.webm");
    fs.renameSync(src, dstWebm);
    console.log(`📹 ${dstWebm}`);
    // ffmpeg 변환 시도
    const { spawnSync } = require("child_process");
    const r = spawnSync("ffmpeg", [
      "-y", "-i", dstWebm,
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-r", "30",
      path.join(VIDEO_DIR, "ai-office-demo.mp4"),
    ], { stdio: "ignore" });
    if (r.status === 0) {
      console.log(`📹 ${path.join(VIDEO_DIR, "ai-office-demo.mp4")}`);
    }
  }
  console.log(`📁 스크린샷: ${SCREENS}`);
})();
