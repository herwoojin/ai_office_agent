#!/usr/bin/env node
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const DESK_RPG = path.join(ROOT, "desk_rpg_model");
for (const f of [path.join(DESK_RPG, ".env.local"), path.join(ROOT, ".env.local")]) {
  if (!fs.existsSync(f)) continue;
  for (const l of fs.readFileSync(f, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const { SignJWT } = require(path.join(DESK_RPG, "node_modules", "jose"));
const Database = require(path.join(DESK_RPG, "node_modules", "better-sqlite3"));
const JWT_SECRET = process.env.JWT_SECRET || "deskrpg-dev-jwt-secret-do-not-use-in-production";

(async () => {
  const db = new Database(path.join(DESK_RPG, "data", "deskrpg.db"));
  const user = db.prepare("SELECT id, nickname FROM users LIMIT 1").get();
  db.close();
  const secret = new TextEncoder().encode(JWT_SECRET);
  const token = await new SignJWT({ userId: user.id, nickname: user.nickname })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").setIssuedAt().sign(secret);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "token", value: token, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" }]);
  const page = await ctx.newPage();

  const OUT = path.join(__dirname, "screenshots");
  fs.mkdirSync(OUT, { recursive: true });

  const targets = [
    ["nav-07-setup.png", "http://localhost:3000/setup"],
    ["nav-05-settings-llm.png", "http://localhost:3000/settings/llm"],
    ["nav-01-characters.png", "http://localhost:3000/characters"],
  ];
  for (const [name, url, anon] of targets) {
    if (anon) {
      await ctx.clearCookies();
    } else {
      await ctx.addCookies([{ name: "token", value: token, domain: "localhost", path: "/", httpOnly: true, secure: false, sameSite: "Lax" }]);
    }
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    // settings/llm 페이지는 API 호출(50s)이 끝날 때까지 기다림
    if (name.includes("settings-llm")) {
      await page.waitForTimeout(60000);
    } else {
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: path.join(OUT, name), fullPage: true });
    console.log(`✓ ${name}`);
  }
  await browser.close();
})();
