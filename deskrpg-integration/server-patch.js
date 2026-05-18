/**
 * server-patch.js
 * 
 * DeskRPG server.js에 AI Office Agents 기능을 추가하는 패치.
 * 
 * 적용 방법:
 *   1. desk_rpg_model/server.js 파일을 열고
 *   2. 아래 코드 블록들을 지정된 위치에 삽입
 *   3. 서버 재시작
 * 
 * 또는 이 파일을 직접 require()하여 setupAIOfficeAgents(io, db, schema) 호출.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

const { execSync } = require("child_process");

/**
 * AI Office Agents 초기화.
 * server.js의 main 함수 내에서 호출.
 * 
 * @param {import('socket.io').Server} io
 * @param {object} db - Drizzle ORM DB instance
 * @param {object} schema - Drizzle schema
 * @param {object} taskManager - DeskRPG TaskManager instance
 * @param {Map} channelGateways - OpenClaw gateway map
 */
function setupAIOfficeAgents(io, db, schema, taskManager, channelGateways) {
  console.log("[AI-Office] 🏢 AI Office Agents 초기화...");

  // ─── 텔레그램 웹훅 (간이 HTTP 서버) ───
  // Hermes Agent Gateway가 처리하지만, 직접 연동도 가능

  const AI_AGENTS = {
    "ai-gpt-kim":    { name: "김대리", role: "전략 기획",  model: "gpt-4o" },
    "ai-claude-park": { name: "박과장", role: "보고서 작성", model: "claude-sonnet-4-20250514" },
    "ai-gemini-lee":  { name: "이주임", role: "리서치",     model: "gemini-2.0-flash" },
  };

  // ─── 디지털 트윈: NPC 자율 산책 루프 ───
  // 주기적으로 DB 의 npc 목록을 읽어, 사무실 내 walkable 영역에서
  // 한 칸씩 무작위 이동하면서 npc:position-sync 를 채널 룸에 브로드캐스트한다.
  // 클라이언트(Phaser)는 새 좌표로 부드럽게 보간 이동.
  const wanderCtx = { io, paused: false, freezeTiles: new Map() };
  startWanderLoop(wanderCtx).catch((err) => {
    console.warn("[AI-Office] wander loop failed to start:", err && err.message);
  });

  // ─── HTTP 트리거 (텔레그램 없이 바로 테스트 가능) ───
  // POST http://localhost:13000/office/task     { task: "..." }
  // POST http://localhost:13000/office/meeting  { topic: "..." }
  // POST http://localhost:13000/office/status
  startOfficeTriggerServer(wanderCtx);

  // ─── 텔레그램 봇 폴러 (TELEGRAM_BOT_TOKEN 가 채워지면 자동 가동) ───
  startTelegramPoller(wanderCtx);

  // ─── Socket.IO 이벤트: 텔레그램 → 태스크 ───

  io.on("connection", (socket) => {
    // 텔레그램에서 온 업무 지시 처리
    socket.on("telegram:task", async (data) => {
      const { content, assigner, channelId } = data;
      console.log(`[AI-Office] 텔레그램 업무: ${content}`);

      // 3인에게 역할별 분배
      const subtasks = {
        "ai-gemini-lee": {
          title: "관련 자료 조사",
          summary: `다음 주제 리서치: ${content}`,
        },
        "ai-gpt-kim": {
          title: "데이터 분석",
          summary: `다음 주제 분석: ${content}`,
        },
        "ai-claude-park": {
          title: "보고서 초안",
          summary: `다음 주제 보고서: ${content}`,
        },
      };

      for (const [npcId, subtask] of Object.entries(subtasks)) {
        try {
          if (taskManager && typeof taskManager.handleTaskAction === "function") {
            await taskManager.handleTaskAction(
              {
                action: "create",
                id: `tg-${Date.now()}-${npcId}`,
                title: subtask.title,
                summary: subtask.summary,
                status: "in-progress",
              },
              channelId || "ai-office-main",
              npcId,
              assigner || "telegram",
            );
          } else {
            console.warn(`[AI-Office] taskManager unavailable, broadcasting only: ${npcId}`);
          }

          // NPC 작업 시작 애니메이션
          io.emit("npc:start-working", { npcId, taskTitle: subtask.title });

        } catch (err) {
          console.error(`[AI-Office] Task create error for ${npcId}:`, err);
        }
      }

      // 응답
      socket.emit("telegram:task-created", {
        agents: Object.entries(AI_AGENTS).map(([id, a]) => ({
          id,
          name: a.name,
          task: subtasks[id]?.title,
        })),
      });
    });

    // 회의 소집 요청
    socket.on("telegram:meeting", async (data) => {
      const { topic, channelId } = data;
      console.log(`[AI-Office] 회의 소집: ${topic}`);

      // NPC를 회의실로 이동
      for (const npcId of Object.keys(AI_AGENTS)) {
        io.emit("npc:move-to", {
          npcId,
          targetX: 12,
          targetY: 12,
          reason: "meeting",
        });
      }

      // MeetingBroker는 meeting-discussion.ts에서 처리
      io.to(channelId || "ai-office-main").emit("meeting:request", {
        topic,
        participants: Object.entries(AI_AGENTS).map(([id, a]) => ({
          agentId: id,
          displayName: a.name,
          role: a.role,
        })),
      });
    });

    // 상태 조회
    socket.on("telegram:status", () => {
      socket.emit("telegram:status-response", {
        agents: Object.entries(AI_AGENTS).map(([id, a]) => ({
          id,
          ...a,
          status: "online",
        })),
      });
    });
  });

  // ─── 회의 종료 → 보고서 파이프라인 ───

  io.on("connection", (socket) => {
    socket.on("meeting:ended", async (payload) => {
      console.log(`[AI-Office] 회의 종료: ${payload.topic}`);
      
      // 보고서 생성
      const report = generateMeetingReport(payload);
      
      // 멀티 플랫폼 전송
      await deliverReport(report);
      
      // DeskRPG UI 알림
      io.emit("report:ready", { report, timestamp: Date.now() });
    });
  });

  console.log("[AI-Office] ✅ AI Office Agents 초기화 완료");
  console.log("[AI-Office]    직원: 김대리(GPT), 박과장(Claude), 이주임(Gemini)");
}

// ─── 보고서 생성 ───

function generateMeetingReport(payload) {
  const date = new Date().toLocaleDateString("ko-KR");
  const participants = payload.participants
    ?.map((p) => `${p.displayName}(${p.role})`)
    .join(", ") || "";

  const turnTexts = (payload.turns || [])
    .map((t) => `[${t.displayName}] ${t.content}`)
    .join("\n\n");

  return `━━━ 회의 보고서 ━━━
📅 ${date}
🏷️ ${payload.topic}
👥 ${participants}

📝 주요 논의:
${turnTexts}

━━━━━━━━━━━━━━━━━━`;
}

// ─── 멀티 플랫폼 전송 ───

async function deliverReport(report) {
  // 텔레그램
  const tgToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgChat = process.env.TELEGRAM_ALLOWED_USERS;
  if (tgToken && tgChat) {
    try {
      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: tgChat,
          text: report,
        }),
      });
      console.log("[AI-Office] 📱 텔레그램 전송 완료");
    } catch (e) {
      console.error("[AI-Office] 텔레그램 전송 실패:", e.message);
    }
  }

  // 슬랙
  const slackToken = process.env.SLACK_BOT_TOKEN;
  const slackChannel = process.env.SLACK_REPORT_CHANNEL;
  if (slackToken && slackChannel) {
    try {
      await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${slackToken}`,
        },
        body: JSON.stringify({ channel: slackChannel, text: report }),
      });
      console.log("[AI-Office] 💬 슬랙 전송 완료");
    } catch (e) {
      console.error("[AI-Office] 슬랙 전송 실패:", e.message);
    }
  }

  // 카카오톡
  if (process.env.KAKAO_ENABLED === "true" && process.env.KAKAO_CHAT_ROOM) {
    try {
      execSync(
        `kmsg send "${process.env.KAKAO_CHAT_ROOM}" "${report.replace(/"/g, '\\"')}"`,
        { timeout: 30000 },
      );
      console.log("[AI-Office] 💛 카카오톡 전송 완료");
    } catch (e) {
      console.error("[AI-Office] 카카오톡 전송 실패:", e.message);
    }
  }
}

// ─── 디지털 트윈 산책 루프 ───
// Small Office 20x15 맵 안에서 NPC들이 자유롭게 돌아다니는 효과를 만든다.
// 진짜 LLM 호출 없이도 "에이전트들이 일하는 사무실" 분위기를 시각화한다.

const fs = require("fs");
const path = require("path");

async function startWanderLoop(ctx) {
  const io = ctx.io;
  // sqlite 경로 (DeskRPG SQLite 모드 가정)
  const dbPath = path.resolve(__dirname, "..", "desk_rpg_model", "data", "deskrpg.db");
  if (!fs.existsSync(dbPath)) {
    console.warn("[AI-Office] wander: deskrpg.db not found, skipping");
    return;
  }

  let Database;
  try {
    Database = require(path.join(
      __dirname, "..", "desk_rpg_model", "node_modules", "better-sqlite3",
    ));
  } catch (e) {
    console.warn("[AI-Office] wander: better-sqlite3 unavailable:", e.message);
    return;
  }

  const db = new Database(dbPath, { readonly: true });

  // 클라이언트는 픽셀 좌표를 기대한다 (TILE_SIZE=32, 중심은 +16).
  const TILE_SIZE = 32;
  const tileToPixel = (t) => t * TILE_SIZE + TILE_SIZE / 2;

  // Small Office walkable bounds (타일 좌표, 0-indexed)
  const MAP_BOUNDS = { minX: 2, maxX: 17, minY: 2, maxY: 12 };

  // NPC별 현재 좌표 (메모리 캐시)
  const state = new Map(); // npcId -> { channelId, x, y, dir, mode }
  const MODES = ["working", "wander", "rest"];

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function refreshNpcs() {
    const rows = db.prepare(
      "SELECT id, channel_id, name, position_x, position_y, direction FROM npcs"
    ).all();
    for (const r of rows) {
      if (!state.has(r.id)) {
        state.set(r.id, {
          channelId: r.channel_id,
          name: r.name,
          x: r.position_x,
          y: r.position_y,
          dir: r.direction || "down",
          mode: "working",
          modeUntil: Date.now() + 5000 + Math.random() * 10000,
        });
      }
    }
  }

  function pickStep(s) {
    // mode 가 working/rest 면 가만히, wander 면 한 칸 이동
    if (s.mode !== "wander") return null;
    const moves = [
      { dx: 1, dy: 0, dir: "right" },
      { dx: -1, dy: 0, dir: "left" },
      { dx: 0, dy: 1, dir: "down" },
      { dx: 0, dy: -1, dir: "up" },
    ];
    const pick = moves[Math.floor(Math.random() * moves.length)];
    const nx = clamp(s.x + pick.dx, MAP_BOUNDS.minX, MAP_BOUNDS.maxX);
    const ny = clamp(s.y + pick.dy, MAP_BOUNDS.minY, MAP_BOUNDS.maxY);
    if (nx === s.x && ny === s.y) return { x: s.x, y: s.y, dir: pick.dir };
    return { x: nx, y: ny, dir: pick.dir };
  }

  function tickMode(s) {
    if (Date.now() < s.modeUntil) return;
    s.mode = MODES[Math.floor(Math.random() * MODES.length)];
    s.modeUntil = Date.now() + 4000 + Math.random() * 8000;
  }

  refreshNpcs();
  console.log(`[AI-Office] wander loop started for ${state.size} NPC(s)`);

  // 다른 모듈(회의 오케스트레이터 등)에서 접근할 수 있게 노출
  ctx.state = state;
  ctx.tileToPixel = tileToPixel;
  ctx.refreshNpcs = refreshNpcs;
  ctx.findNpcByName = (name) => {
    for (const [id, s] of state) if (s.name === name) return { id, s };
    return null;
  };

  // NPC 목록 주기적 갱신 (새로 만들어지는 NPC 픽업)
  setInterval(refreshNpcs, 15000);

  // 메인 틱: 1.2초마다 각 NPC 상태/위치 업데이트
  setInterval(() => {
    if (ctx.paused) return;
    for (const [npcId, s] of state) {
      if (ctx.freezeTiles.has(npcId)) continue;
      tickMode(s);
      const step = pickStep(s);
      if (step) {
        s.x = step.x; s.y = step.y; s.dir = step.dir;
        // 클라이언트는 픽셀 좌표를 기대한다.
        io.to(s.channelId).emit("npc:position-sync", {
          npcId, x: tileToPixel(s.x), y: tileToPixel(s.y), direction: s.dir,
        });
      } else {
        // 정지 상태에서도 가끔 방향만 바꿔 살아있는 느낌
        if (Math.random() < 0.15) {
          const dirs = ["up", "down", "left", "right"];
          s.dir = dirs[Math.floor(Math.random() * dirs.length)];
          io.to(s.channelId).emit("npc:position-sync", {
            npcId, x: tileToPixel(s.x), y: tileToPixel(s.y), direction: s.dir,
          });
        }
      }

      // 가끔 채팅 풍선 (작업 중 메시지) 띄우기
      if (s.mode === "working" && Math.random() < 0.04) {
        const lines = {
          "김대리": ["분석 중...", "수치 다시 확인", "이 데이터로는 명확함"],
          "박과장": ["보고서 다듬는 중", "이 부분 논리 약함", "초안 정리 중"],
          "이주임": ["재밌는 사례 발견!", "트렌드 조사 중", "이 방향 어떨까요"],
        };
        const ls = lines[s.name] || ["작업 중..."];
        const text = ls[Math.floor(Math.random() * ls.length)];
        io.to(s.channelId).emit("npc:speech", { npcId, text, ttl: 3000 });
      }
    }
  }, 1200);
}

// ─────────────────────────────────────────────────────────────
// 회의 / 태스크 오케스트레이터
// ─────────────────────────────────────────────────────────────

// 회의실 좌석 (타일 좌표) — 회의 테이블 주변
const MEETING_SEATS = {
  "김대리": { x: 9, y: 8, dir: "right" },
  "박과장": { x: 10, y: 7, dir: "down" },
  "이주임": { x: 11, y: 8, dir: "left" },
};

// 워크스테이션 좌석 — 평소 자기 자리
const WORK_SEATS = {
  "김대리": { x: 5, y: 5, dir: "down" },
  "박과장": { x: 9, y: 5, dir: "down" },
  "이주임": { x: 13, y: 5, dir: "down" },
};

function nextChannelId(ctx) {
  // wander state 의 첫 NPC 가 가진 channelId 를 사용 (단일 채널 가정)
  if (!ctx.state) return null;
  for (const [, s] of ctx.state) return s.channelId;
  return null;
}

function moveNpcTo(ctx, npcName, target) {
  const found = ctx.findNpcByName && ctx.findNpcByName(npcName);
  if (!found) return null;
  const { id, s } = found;
  ctx.freezeTiles.set(id, true);
  s.x = target.x; s.y = target.y; s.dir = target.dir || s.dir;
  ctx.io.to(s.channelId).emit("npc:position-sync", {
    npcId: id,
    x: ctx.tileToPixel(s.x),
    y: ctx.tileToPixel(s.y),
    direction: s.dir,
  });
  return { id, s };
}

function unfreezeAll(ctx) {
  ctx.freezeTiles.clear();
}

function speech(ctx, npcId, channelId, text, ttl = 4000) {
  ctx.io.to(channelId).emit("npc:speech", { npcId, text, ttl });
}

async function runOpenClawChat(agentId, prompt, ms = 45000) {
  // OpenClaw CLI 로 한 턴 채팅. agent 명으로 라우팅.
  const { execFile } = require("child_process");
  return await new Promise((resolve) => {
    const child = execFile(
      "openclaw",
      ["agent", "--agent", agentId, "--message", prompt, "--json"],
      { timeout: ms, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          resolve(`(응답 없음)`);
          return;
        }
        const raw = String(stdout || "").trim();
        // JSON 응답 시도. openclaw agent --json 의 구조: {payloads:[{text,...}], meta:{...}}
        try {
          const parsed = JSON.parse(raw);
          let text = "";
          if (Array.isArray(parsed.payloads) && parsed.payloads.length) {
            text = parsed.payloads.map((p) => p.text).filter(Boolean).join("  ");
          }
          if (!text) {
            text = parsed.finalAssistantRawText
              || parsed.reply || parsed.message || parsed.text
              || parsed.content || parsed.result?.text
              || parsed.result?.finalAssistantRawText || "";
          }
          if (text) { resolve(String(text).slice(0, 400)); return; }
        } catch {}
        // fallback: stdout 의 마지막 의미있는 줄
        const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
        const text = lines.slice(-6).join("  ");
        resolve(text.slice(0, 400) || "(빈 응답)");
      },
    );
    child.on("error", () => resolve(`(${agentId} 실행 실패)`));
  });
}

async function triggerTask(ctx, taskText) {
  const channelId = nextChannelId(ctx);
  if (!channelId) return { ok: false, error: "no NPCs loaded yet" };
  console.log(`[AI-Office] /task: ${taskText}`);

  ctx.paused = true;
  const subtasks = [
    { name: "이주임", agent: "lee-juim",     line: `자료 조사 시작: ${taskText.slice(0, 30)}` },
    { name: "김대리", agent: "kim-daeri",    line: `데이터 분석 들어갑니다`,                 },
    { name: "박과장", agent: "park-gwajang", line: `보고서 골격 잡을게요`,                     },
  ];

  for (const t of subtasks) {
    const seat = WORK_SEATS[t.name];
    const moved = moveNpcTo(ctx, t.name, seat);
    if (moved) speech(ctx, moved.id, channelId, t.line, 5000);
  }
  // 5초 후 자유 산책 복귀
  setTimeout(() => {
    unfreezeAll(ctx);
    ctx.paused = false;
  }, 5500);
  return { ok: true, distributed: subtasks.length };
}

async function triggerMeeting(ctx, topic) {
  const channelId = nextChannelId(ctx);
  if (!channelId) return { ok: false, error: "no NPCs loaded yet" };
  console.log(`[AI-Office] /meeting: ${topic}`);

  ctx.paused = true;

  // 1) 모두 회의실 좌석으로 이동
  const participants = [];
  for (const [name, seat] of Object.entries(MEETING_SEATS)) {
    const moved = moveNpcTo(ctx, name, seat);
    if (moved) participants.push({ name, npcId: moved.id });
  }
  ctx.io.to(channelId).emit("meeting:start", { topic, participants });

  // 2) 짧은 인트로 풍선
  for (const p of participants) {
    speech(ctx, p.npcId, channelId, `회의 시작: ${topic.slice(0, 40)}`, 3500);
    await sleep(700);
  }

  // 3) 각자 OpenClaw 에 한 턴씩 의견 요청 — 결과를 풍선으로 표시
  const agentMap = { "김대리": "kim-daeri", "박과장": "park-gwajang", "이주임": "lee-juim" };
  for (const p of participants) {
    const agentId = agentMap[p.name];
    if (!agentId) continue;
    speech(ctx, p.npcId, channelId, `${p.name}: 생각해보는 중...`, 2000);
    const reply = await runOpenClawChat(
      agentId,
      `회의 주제: "${topic}". 당신의 관점에서 핵심 한 줄 의견만 짧게 말해주세요.`,
      45000,
    );
    speech(ctx, p.npcId, channelId, `${p.name}: ${reply.slice(0, 140)}`, 8000);
    await sleep(2500);
  }

  ctx.io.to(channelId).emit("meeting:end", { topic, participants });

  // 4) 자기 자리로 복귀
  await sleep(1000);
  for (const [name, seat] of Object.entries(WORK_SEATS)) {
    moveNpcTo(ctx, name, seat);
  }
  setTimeout(() => {
    unfreezeAll(ctx);
    ctx.paused = false;
  }, 2000);

  return { ok: true, topic, participants: participants.map((p) => p.name) };
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ─────────────────────────────────────────────────────────────
// HTTP 트리거 (텔레그램 없이 바로 호출)
// ─────────────────────────────────────────────────────────────

const http = require("http");
function startOfficeTriggerServer(ctx) {
  const PORT = Number(process.env.OFFICE_TRIGGER_PORT || 13000);
  const server = http.createServer(async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.writeHead(405); res.end("POST only"); return;
      }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");

      let result;
      if (req.url === "/office/task") {
        result = await triggerTask(ctx, String(body.task || body.content || "업무 지시").trim());
      } else if (req.url === "/office/meeting") {
        result = await triggerMeeting(ctx, String(body.topic || body.subject || "정기 회의").trim());
      } else if (req.url === "/office/status") {
        const npcs = [];
        for (const [id, s] of (ctx.state || new Map())) {
          npcs.push({ id, name: s.name, x: s.x, y: s.y, dir: s.dir, mode: s.mode });
        }
        result = { ok: true, paused: ctx.paused, npcs };
      } else {
        res.writeHead(404); res.end("not found"); return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`[AI-Office] office trigger server: http://127.0.0.1:${PORT}/office/{task,meeting,status}`);
  });
  server.on("error", (err) => console.warn("[AI-Office] trigger server error:", err.message));
}

// ─────────────────────────────────────────────────────────────
// 텔레그램 봇 폴러 (TELEGRAM_BOT_TOKEN 가 채워지면 자동 가동)
// ─────────────────────────────────────────────────────────────

function startTelegramPoller(ctx) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token.startsWith("123456:")) {
    console.log("[AI-Office] telegram: TOKEN 미설정 — 폴러를 시작하지 않습니다.");
    return;
  }
  const allowed = new Set(
    String(process.env.TELEGRAM_ALLOWED_USERS || "")
      .split(",").map((s) => s.trim()).filter(Boolean),
  );
  if (allowed.size === 0) {
    console.warn("[AI-Office] telegram: TELEGRAM_ALLOWED_USERS 가 비어있음 — 모든 사용자에게 응답합니다.");
  }
  console.log("[AI-Office] telegram poller 가동:", token.slice(0, 8) + "...");

  let offset = 0;
  async function pollOnce() {
    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?timeout=25&offset=${offset}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.ok) {
        console.warn("[AI-Office] tg getUpdates failed:", data.description);
        return;
      }
      for (const upd of data.result) {
        offset = upd.update_id + 1;
        const msg = upd.message;
        if (!msg || !msg.text) continue;
        if (allowed.size > 0 && !allowed.has(String(msg.from.id))) continue;
        await handleTelegramMessage(ctx, token, msg.chat.id, msg.text.trim());
      }
    } catch (e) {
      console.warn("[AI-Office] tg poll error:", e.message);
    }
  }
  // long-poll 루프
  (async function loop() {
    while (true) {
      await pollOnce();
      await sleep(500);
    }
  })();
}

async function sendTelegram(token, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {}
}

async function handleTelegramMessage(ctx, token, chatId, text) {
  if (text.startsWith("/task")) {
    const task = text.slice(5).trim() || "업무 지시";
    await sendTelegram(token, chatId, `📋 업무 분배: ${task}`);
    const r = await triggerTask(ctx, task);
    await sendTelegram(token, chatId, `✓ ${r.distributed}명에게 분배됨`);
  } else if (text.startsWith("/meeting")) {
    const topic = text.slice(8).trim() || "정기 회의";
    await sendTelegram(token, chatId, `🪑 회의 소집: ${topic}\n3명이 회의실로 이동합니다...`);
    const r = await triggerMeeting(ctx, topic);
    if (r.ok) {
      await sendTelegram(token, chatId, `✓ 회의 종료 — 참석: ${r.participants.join(", ")}`);
    } else {
      await sendTelegram(token, chatId, `✗ 회의 실패: ${r.error}`);
    }
  } else if (text.startsWith("/status")) {
    const npcs = [];
    for (const [, s] of (ctx.state || new Map())) {
      npcs.push(`${s.name} @ (${s.x},${s.y}) ${s.mode}`);
    }
    await sendTelegram(token, chatId, `📊 상태:\n${npcs.join("\n") || "(NPC 없음)"}`);
  } else if (text.startsWith("/help") || text === "/start") {
    await sendTelegram(token, chatId,
      "🏢 AI Office Bot\n" +
      "/task <내용> — 3명에게 업무 분배\n" +
      "/meeting <주제> — 회의실 소집 + LLM 토론\n" +
      "/status — NPC 상태 조회",
    );
  } else {
    // 자유 메시지는 task 로 간주
    const r = await triggerTask(ctx, text);
    await sendTelegram(token, chatId, `📋 받은 메시지를 업무로 처리합니다 (분배: ${r.distributed}명)`);
  }
}

module.exports = { setupAIOfficeAgents };
