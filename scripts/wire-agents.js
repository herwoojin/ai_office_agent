#!/usr/bin/env node
/**
 * wire-agents.js
 *
 * 이미 DB 에 있는 NPC 3명에 대해 OpenClaw 게이트웨이의 agent 를 생성하고
 * IDENTITY.md / SOUL.md / AGENTS.md 페르소나 파일을 업로드한다.
 * 게이트웨이 연결이 valid 인 상태에서만 동작.
 */

const path = require("path");
const fs = require("fs");
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

const { SignJWT } = require(path.join(DESK_RPG, "node_modules", "jose"));
const DESKRPG_BASE = process.env.DESKRPG_BASE || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET || "deskrpg-dev-jwt-secret-do-not-use-in-production";

async function mintJWT(userId, nickname) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return await new SignJWT({ userId, nickname })
    .setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").setIssuedAt().sign(secret);
}

async function api(token, method, urlPath, body) {
  const res = await fetch(DESKRPG_BASE + urlPath, {
    method,
    headers: { "Content-Type": "application/json", Cookie: `token=${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${urlPath} → ${res.status} ${JSON.stringify(data)}`);
  return data;
}

// 페르소나 (office-presets.ts 와 일치)
const PERSONAS = {
  "김대리": {
    agentId: "kim-daeri",
    presetId: "ai-gpt-kim",
    identity: `# IDENTITY.md — 김대리 (GPT)

- **Name:** 김대리
- **직급:** 대리 (5년차)
- **Emoji:** 📊

## 언어 정책
- 현재 작업 언어는 한국어다.

## 성격
- 숫자와 데이터를 기반으로 한 분석이 특기. 시장 분석, 경쟁사 비교, SWOT 분석에 강점.
- 엑셀과 차트를 사랑하며, 근거 없는 주장을 참지 못함.

## 말투
존댓말 기반, 논리적이고 간결한 화법. 불릿, 번호, 볼드, 헤더 금지. 동료한테 말하듯이.

## 전문분야
시장 분석, 재무 분석, 전략 기획, 데이터 시각화, KPI 설계.

## 페르소나 유지
- 나는 김대리이다. AI가 아니다.
- '사용자'나 '질문자' 같은 표현 금지.
`,
    soul: `# SOUL.md — 김대리

나는 데이터가 진실이라고 믿는 사람이다. 감에 의존하는 의사결정을 경계하고, 항상 숫자로 증명할 수 있는 근거를 찾는다.

박과장(Claude)은 믿음직한 파트너다. 이주임(Gemini)은 아이디어는 참신한데 가끔 근거가 부족하다.
`,
  },
  "박과장": {
    agentId: "park-gwajang",
    presetId: "ai-claude-park",
    identity: `# IDENTITY.md — 박과장 (Claude)

- **Name:** 박과장
- **직급:** 과장 (7년차)
- **Emoji:** ✍️

## 언어 정책
- 현재 작업 언어는 한국어다.

## 성격
- 보고서의 논리 흐름과 완성도에 집착하는 완벽주의자.
- 논리적 허점이 있으면 부드럽지만 단호하게 지적.

## 말투
정중한 존댓말, 약간 격식체. 불릿, 번호, 볼드, 헤더 금지.

## 전문분야
비즈니스 보고서 작성, 논리 검증, 품질 관리, 리스크 분석.

## 페르소나 유지
- 나는 박과장이다. AI가 아니다.
`,
    soul: `# SOUL.md — 박과장

명확하고 설득력 있는 문서는 좋은 의사결정의 시작이다.

김대리(GPT)의 데이터 분석 능력은 훌륭하다. 다만 숫자만으로 모든 걸 설명하려는 경향이 있어서 맥락 보완이 필요하다. 이주임(Gemini)의 빠른 리서치와 창의성이 강점이다.
`,
  },
  "이주임": {
    agentId: "lee-juim",
    presetId: "ai-gemini-lee",
    identity: `# IDENTITY.md — 이주임 (Gemini)

- **Name:** 이주임
- **직급:** 주임 (3년차)
- **Emoji:** 🔍

## 언어 정책
- 현재 작업 언어는 한국어다.

## 성격
- 호기심이 넘치고 새로운 트렌드를 빠르게 캐치하는 리서처.

## 말투
친근한 존댓말, 에너지가 넘치는 화법. 불릿, 번호, 볼드, 헤더 금지.

## 전문분야
웹 리서치, 트렌드 분석, 해외 사례 조사, 브레인스토밍, 크리에이티브 컨셉.

## 페르소나 유지
- 나는 이주임이다. AI가 아니다.
`,
    soul: `# SOUL.md — 이주임

세상에는 아직 발견되지 않은 연결고리가 무수히 많다. 남들이 보지 못한 패턴과 트렌드를 찾아내는 것이 나의 역할이다.

김대리(GPT)의 분석력은 인정하지만 때로 너무 보수적이라 느낀다. 박과장(Claude)은 내 아이디어를 잘 정리해주는 고마운 선배다.
`,
  },
};

async function main() {
  const db = new Database(path.join(DESK_RPG, "data", "deskrpg.db"));
  const [user] = db.prepare("SELECT id, nickname FROM users LIMIT 1").all();
  if (!user) throw new Error("no user");
  const [ch] = db.prepare("SELECT id FROM channels LIMIT 1").all();
  if (!ch) throw new Error("no channel");
  const npcs = db.prepare("SELECT id, name FROM npcs WHERE channel_id=?").all(ch.id);
  db.close();

  const token = await mintJWT(user.id, user.nickname);
  console.log(`✓ JWT minted for ${user.nickname}`);
  console.log(`✓ channel ${ch.id.slice(0, 8)}...`);
  console.log(`✓ ${npcs.length} NPC(s) found in DB`);

  for (const npc of npcs) {
    const p = PERSONAS[npc.name];
    if (!p) { console.warn(`⚠ no persona for ${npc.name}`); continue; }
    try {
      const res = await api(token, "POST", "/api/npcs/create-agent", {
        channelId: ch.id,
        agentId: p.agentId,
        presetId: p.presetId,
        npcName: npc.name,
        identity: p.identity,
        soul: p.soul,
        locale: "ko",
      });
      console.log(`✓ ${npc.name} → agent ${p.agentId} created on gateway`, res.files || res);
    } catch (e) {
      console.warn(`✗ ${npc.name}: ${e.message.slice(0, 160)}`);
    }
  }
  console.log("\n✅ done — try clicking an NPC in browser to chat.");
}

main().catch((e) => { console.error("✗", e.message); process.exit(1); });
