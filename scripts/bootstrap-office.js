#!/usr/bin/env node
/**
 * bootstrap-office.js
 *
 * 디지털 트윈 오피스 부트스트랩:
 *   1) 첫 번째 user 의 JWT 발급
 *   2) gateway resource 등록 (ws://127.0.0.1:18789, 토큰 암호화 저장)
 *   3) 채널 생성 (Small Office, gateway 바인딩, defaultNpc=김대리)
 *   4) 박과장 / 이주임 NPC 추가
 *
 * 실행: node scripts/bootstrap-office.js
 *
 * 사전 조건:
 *   - DeskRPG dev-server (localhost:3000) 가 실행 중
 *   - 사용자가 회원가입 + 캐릭터 생성 완료
 *   - OpenClaw gateway (ws://127.0.0.1:18789) 가 실행 중
 *   - DeskRPG 디바이스가 페어링 완료 (operator.admin/read/write)
 */

const path = require("path");
const fs = require("fs");
const Module = require("module");

const ROOT = path.resolve(__dirname, "..");
const DESK_RPG = path.join(ROOT, "desk_rpg_model");

// desk_rpg_model 의 node_modules 사용
Module.globalPaths.push(path.join(DESK_RPG, "node_modules"));

// .env.local 로드 (DESK_RPG/.env.local 우선)
function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadEnv(path.join(DESK_RPG, ".env.local"));
loadEnv(path.join(ROOT, ".env.local"));

const { SignJWT } = require(path.join(DESK_RPG, "node_modules", "jose"));
const Database = require(path.join(DESK_RPG, "node_modules", "better-sqlite3"));

const DESKRPG_BASE = process.env.DESKRPG_BASE || "http://localhost:3000";
const OPENCLAW_URL = process.env.OPENCLAW_URL || "ws://127.0.0.1:18789";
const OPENCLAW_TOKEN = process.env.OPENCLAW_TOKEN || "";
if (!OPENCLAW_TOKEN) {
  console.error("✗ OPENCLAW_TOKEN 환경변수가 비었습니다. .env.local 을 확인하세요.");
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET || "deskrpg-dev-jwt-secret-do-not-use-in-production";

async function mintJWT(userId, nickname) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return await new SignJWT({ userId, nickname })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(secret);
}

async function api(token, method, urlPath, body) {
  const res = await fetch(DESKRPG_BASE + urlPath, {
    method,
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} → ${res.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function pickAppearance(preset) {
  return {
    bodyType: preset.bodyType,
    layers: preset.layers,
  };
}

async function main() {
  // ── 1) user / character / map_template DB 직접 조회 ──
  const db = new Database(path.join(DESK_RPG, "data", "deskrpg.db"));
  const users = db.prepare("SELECT id, nickname FROM users LIMIT 1").all();
  if (!users.length) throw new Error("no users in DB — register first via /auth");
  const { id: userId, nickname } = users[0];
  console.log(`✓ user = ${nickname} (${userId.slice(0, 8)}...)`);

  const characters = db.prepare("SELECT id, name FROM characters WHERE user_id=?").all(userId);
  if (!characters.length) throw new Error(`no characters for ${nickname} — create one first via /characters/create`);
  console.log(`✓ character = ${characters[0].name}`);

  const [tpl] = db.prepare("SELECT id, name, spawn_col, spawn_row FROM map_templates WHERE name='Small Office'").all();
  if (!tpl) throw new Error("Small Office template missing");
  console.log(`✓ map_template = ${tpl.name} @ (${tpl.spawn_col},${tpl.spawn_row})`);

  const groupRow = db.prepare(
    "SELECT g.id, g.name FROM groups g JOIN group_members m ON m.group_id=g.id WHERE m.user_id=? LIMIT 1"
  ).get(userId);
  if (!groupRow) throw new Error("user has no group membership");
  console.log(`✓ group = ${groupRow.name} (${groupRow.id.slice(0, 8)}...)`);

  const existingChannels = db.prepare("SELECT id, name FROM channels WHERE owner_id=?").all(userId);
  db.close();

  const token = await mintJWT(userId, nickname);
  console.log(`✓ minted JWT (len=${token.length})`);

  // ── 2) 기존 채널 재사용 또는 새 채널 생성 ──
  let channelId;
  const aiOffice = existingChannels.find((c) => c.name === "AI Office");
  if (aiOffice) {
    channelId = aiOffice.id;
    console.log(`↻ reuse channel "AI Office" (${channelId.slice(0, 8)}...)`);
  } else {
    // 김대리 프리셋 가져오기
    const presets = await api(token, "GET", "/api/npcs/presets");
    const officePresets = presets.officePresets || presets.presets || [];
    const kim = officePresets.find((p) => p.id === "ai-gpt-kim");
    if (!kim) {
      console.warn("⚠ ai-gpt-kim preset not exposed via API; falling back to no defaultNpc");
    }

    // gateway resource (저장된 게이트웨이) 먼저 등록
    let gatewayId = null;
    try {
      const gw = await api(token, "POST", "/api/gateways", {
        displayName: "Local OpenClaw",
        url: OPENCLAW_URL,
        token: OPENCLAW_TOKEN,
      });
      gatewayId = gw.gateway?.id || gw.id;
      console.log(`✓ gateway resource saved id=${(gatewayId || "?").slice(0, 8)}...`);
    } catch (e) {
      console.warn("⚠ gateway resource API not used:", e.message.slice(0, 100));
    }

    const channelBody = {
      name: "AI Office",
      groupId: groupRow.id,
      mapTemplateId: tpl.id,
      isPublic: true,
      gatewayConfig: gatewayId
        ? { gatewayId }
        : { url: OPENCLAW_URL, token: OPENCLAW_TOKEN },
      defaultNpc: kim ? {
        agentId: "kim-daeri",
        name: kim.nameKo || "김대리",
        appearance: pickAppearance(kim),
        identity: kim.identity,
        soul: kim.soul,
        locale: "ko",
      } : undefined,
    };
    const channelResp = await api(token, "POST", "/api/channels", channelBody);
    channelId = channelResp.channel?.id || channelResp.id;
    console.log(`✓ channel created = ${channelId.slice(0, 8)}...`);
  }

  // ── 3) 박과장 + 이주임 NPC 추가 ──
  const presets = await api(token, "GET", "/api/npcs/presets");
  const officePresets = presets.officePresets || presets.presets || [];

  const targets = [
    { presetId: "ai-claude-park", name: "박과장", agentId: "park-gwajang", offset: [4, 0] },
    { presetId: "ai-gemini-lee", name: "이주임", agentId: "lee-juim", offset: [6, 0] },
  ];

  for (const t of targets) {
    const preset = officePresets.find((p) => p.id === t.presetId);
    if (!preset) {
      console.warn(`⚠ preset ${t.presetId} not found`);
      continue;
    }
    // agent 생성 (gateway 에)
    try {
      await api(token, "POST", "/api/npcs/create-agent", {
        channelId,
        agentId: t.agentId,
        presetId: t.presetId,
        npcName: t.name,
        identity: preset.identity,
        soul: preset.soul,
        locale: "ko",
      });
      console.log(`✓ gateway agent created: ${t.agentId}`);
    } catch (e) {
      console.warn(`⚠ create-agent ${t.agentId}: ${e.message.slice(0, 120)}`);
    }

    // NPC row 생성
    try {
      await api(token, "POST", "/api/npcs", {
        channelId,
        name: t.name,
        appearance: pickAppearance(preset),
        positionX: tpl.spawn_col + t.offset[0],
        positionY: tpl.spawn_row + t.offset[1],
        direction: "down",
        agentId: t.agentId,
        agentAction: "create",
        presetId: t.presetId,
        identity: preset.identity,
        soul: preset.soul,
        locale: "ko",
      });
      console.log(`✓ NPC row inserted: ${t.name}`);
    } catch (e) {
      console.warn(`⚠ NPC insert ${t.name}: ${e.message.slice(0, 120)}`);
    }
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`✅ Office bootstrap done — channelId=${channelId}`);
  console.log(`   브라우저: ${DESKRPG_BASE}/channels/${channelId}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch((err) => { console.error("✗", err.message); process.exit(1); });
