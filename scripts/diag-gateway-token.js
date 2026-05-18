#!/usr/bin/env node
/**
 * diag-gateway-token.js
 *
 * gateway_resources 의 token_encrypted 를 복호화해서
 * OpenClaw 원본 토큰과 일치하는지 확인한다.
 *
 * 일치하지 않거나 깨졌으면, OPENCLAW_TOKEN 값으로 새로 암호화해서 갱신한다.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Database = require(path.join(
  "/Users/heoujin/ai-office-agents/desk_rpg_model/node_modules/better-sqlite3",
));

const ROOT = "/Users/heoujin/ai-office-agents";
const DESK_RPG = path.join(ROOT, "desk_rpg_model");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const l of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(l);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv(path.join(DESK_RPG, ".env.local"));
loadEnv(path.join(ROOT, ".env.local"));

const DEV_FALLBACK = "deskrpg-dev-jwt-secret-do-not-use-in-production";
const source = process.env.INTERNAL_RPC_SECRET || process.env.JWT_SECRET || DEV_FALLBACK;
console.log("[diag] using key source:", source.slice(0, 12) + "...");

const key = crypto.createHash("sha256").update(source).digest();

function decryptToken(payload) {
  const [v, ivB, tagB, encB] = payload.split(":");
  if (v !== "v1") throw new Error("unknown payload format");
  const dec = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB, "base64url"));
  dec.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([dec.update(Buffer.from(encB, "base64url")), dec.final()]).toString("utf8");
}
function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

const db = new Database(path.join(DESK_RPG, "data", "deskrpg.db"));
const rows = db.prepare("SELECT id, base_url, token_encrypted FROM gateway_resources").all();
console.log(`[diag] ${rows.length} gateway resource(s):`);
const EXPECTED = (process.env.OPENCLAW_TOKEN || "").trim();
console.log(`[diag] expected token (from env): ${EXPECTED.slice(0, 8)}...${EXPECTED.slice(-4)}  (len=${EXPECTED.length})`);

let updates = 0;
for (const r of rows) {
  console.log(`\n[res] id=${r.id.slice(0, 8)}  base_url=${r.base_url}`);
  console.log(`  encrypted prefix: ${r.token_encrypted.slice(0, 30)}...`);
  let dec;
  try {
    dec = decryptToken(r.token_encrypted);
    console.log(`  decrypted: ${dec.slice(0, 8)}...${dec.slice(-4)}  (len=${dec.length})`);
  } catch (e) {
    console.log(`  ✗ decrypt failed: ${e.message}`);
  }
  if (EXPECTED && dec !== EXPECTED) {
    const fresh = encryptToken(EXPECTED);
    db.prepare("UPDATE gateway_resources SET token_encrypted=?, last_validation_status=NULL, last_validation_error=NULL WHERE id=?")
      .run(fresh, r.id);
    console.log(`  ↻ updated with expected token`);
    updates++;
  } else if (EXPECTED && dec === EXPECTED) {
    console.log(`  ✓ matches expected`);
  }
}
console.log(`\n[diag] ${updates} row(s) re-encrypted with expected token.`);
db.close();
