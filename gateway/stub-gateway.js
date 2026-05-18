#!/usr/bin/env node
/**
 * stub-gateway.js
 *
 * OpenClaw Gateway 와이어 프로토콜을 흉내내는 최소 구현.
 * - DeskRPG 서버가 connect.challenge → 서명 connect → agents.* RPC 를 부를 수 있게 한다.
 * - Ed25519 서명은 형식만 받고 실제 검증은 생략한다(개발/디지털 트윈 데모용).
 * - 채팅(chat.send) 같은 LLM 호출은 stub 응답만 한다.
 *
 * 실행:
 *   node gateway/stub-gateway.js
 * 환경변수:
 *   STUB_GATEWAY_PORT (기본 18789)
 *   STUB_GATEWAY_TOKEN (선택, 어떤 토큰이든 허용. 설정 시 일치하지 않으면 거절)
 */

const path = require("path");
const Module = require("module");

// desk_rpg_model의 node_modules에서 ws 모듈을 빌려쓴다.
const deskRpgNodeModules = path.resolve(__dirname, "..", "desk_rpg_model", "node_modules");
Module.globalPaths.push(deskRpgNodeModules);

const { WebSocketServer } = require(path.join(deskRpgNodeModules, "ws"));
const crypto = require("crypto");

const PORT = Number(process.env.STUB_GATEWAY_PORT || 18789);
const TOKEN = process.env.STUB_GATEWAY_TOKEN || null;

// 메모리 내 agent 저장소
const agents = new Map(); // agentId -> { id, name, workspace, emoji, files: Map<name, content> }

function logTime() {
  return new Date().toISOString().slice(11, 19);
}

function log(...args) {
  console.log(`[${logTime()}][stub-gateway]`, ...args);
}

function send(ws, obj) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function respond(ws, id, payload) {
  send(ws, { type: "res", id, ok: true, payload });
}

function respondError(ws, id, errorCode, error) {
  send(ws, { type: "res", id, ok: false, errorCode, error });
}

function handleConnect(ws, msg, state) {
  const hasDevice = msg.params && msg.params.device;

  if (!hasDevice) {
    // 1단계: challenge 발행
    const nonce = crypto.randomBytes(16).toString("hex");
    const ts = Date.now();
    state.challenge = { nonce, ts };
    state.connectId = msg.id;
    send(ws, { type: "event", event: "connect.challenge", payload: { nonce, ts } });
    log("→ connect.challenge issued", { nonce: nonce.slice(0, 8) });
    return;
  }

  // 2단계: signed connect. 토큰 옵션 확인 (서명은 검증 생략)
  const incomingToken = msg.params?.auth?.token;
  if (TOKEN && incomingToken !== TOKEN) {
    respondError(ws, msg.id, "auth_failed", "Token mismatch");
    log("✗ connect auth failed");
    return;
  }

  state.connected = true;
  respond(ws, msg.id, {
    protocol: 3,
    policy: { tickIntervalMs: 30000 },
    server: { id: "stub-gateway", version: "0.1.0" },
  });
  log("✓ client connected", { device: msg.params?.device?.id?.slice(0, 8) });

  // tick keepalive
  if (state.tickTimer) clearInterval(state.tickTimer);
  state.tickTimer = setInterval(() => {
    send(ws, { type: "event", event: "tick", payload: { ts: Date.now() } });
  }, 25000);
}

function handleAgentsList(ws, msg) {
  const list = Array.from(agents.values()).map((a) => ({
    id: a.id,
    name: a.name,
    workspace: a.workspace,
    emoji: a.emoji,
  }));
  respond(ws, msg.id, { agents: list });
}

function handleAgentsCreate(ws, msg) {
  const { name, workspace, emoji } = msg.params || {};
  if (!name) {
    respondError(ws, msg.id, "invalid_params", "name required");
    return;
  }
  const id = name;
  agents.set(id, { id, name, workspace: workspace || `~/.openclaw/workspace-${name}`, emoji, files: new Map() });
  log("agents.create", { id });
  respond(ws, msg.id, { id, name, workspace: agents.get(id).workspace });
}

function handleAgentsDelete(ws, msg) {
  const { agentId } = msg.params || {};
  agents.delete(agentId);
  log("agents.delete", { agentId });
  respond(ws, msg.id, { ok: true });
}

function handleFilesSet(ws, msg) {
  const { agentId, name, content } = msg.params || {};
  const a = agents.get(agentId);
  if (!a) {
    // 자동 생성으로 관대하게 처리 (main 등의 default agent)
    agents.set(agentId, { id: agentId, name: agentId, workspace: `~/.openclaw/workspace-${agentId}`, files: new Map() });
  }
  agents.get(agentId).files.set(name, content || "");
  log("agents.files.set", { agentId, name, len: (content || "").length });
  respond(ws, msg.id, { ok: true });
}

function handleFilesGet(ws, msg) {
  const { agentId, name } = msg.params || {};
  const a = agents.get(agentId);
  const content = a?.files.get(name) || "";
  respond(ws, msg.id, { content });
}

function handleFilesList(ws, msg) {
  const { agentId } = msg.params || {};
  const a = agents.get(agentId);
  const files = a ? Array.from(a.files.keys()).map((name) => ({ name, size: a.files.get(name).length })) : [];
  respond(ws, msg.id, { files });
}

function handleChatSend(ws, msg) {
  // LLM 호출은 생략하고 즉시 final 응답을 stub으로 돌려준다.
  const { sessionKey, agentId, message } = msg.params || {};
  const text = `(stub) ${agentId || "agent"}: 메시지 받았습니다 — "${(message?.content?.[0]?.text || "").slice(0, 60)}"`;
  // streaming delta + final
  setTimeout(() => {
    send(ws, {
      type: "event",
      event: "agent",
      payload: { sessionKey, stream: "assistant", data: { delta: text } },
    });
    send(ws, {
      type: "event",
      event: "chat",
      payload: {
        sessionKey,
        state: "final",
        message: { role: "assistant", content: [{ type: "text", text }] },
      },
    });
  }, 50);
  respond(ws, msg.id, { ok: true });
}

const HANDLERS = {
  "connect": handleConnect, // 별도 처리 (state)
  "agents.list": handleAgentsList,
  "agents.create": handleAgentsCreate,
  "agents.delete": handleAgentsDelete,
  "agents.files.set": handleFilesSet,
  "agents.files.get": handleFilesGet,
  "agents.files.list": handleFilesList,
  "chat.send": handleChatSend,
  "chat.abort": (ws, msg) => respond(ws, msg.id, { ok: true }),
};

function start() {
  const wss = new WebSocketServer({ host: "127.0.0.1", port: PORT });
  wss.on("listening", () => {
    log(`listening on ws://127.0.0.1:${PORT}  (token=${TOKEN ? "REQUIRED" : "any"})`);
  });

  wss.on("connection", (ws, req) => {
    const state = { connected: false, challenge: null, tickTimer: null, connectId: null };
    log("client connected from", req.socket.remoteAddress);

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type !== "req") return;

      if (msg.method === "connect") {
        handleConnect(ws, msg, state);
        return;
      }

      if (!state.connected) {
        respondError(ws, msg.id, "not_connected", "Send connect first");
        return;
      }

      const handler = HANDLERS[msg.method];
      if (!handler) {
        log("? unknown method:", msg.method);
        respondError(ws, msg.id, "unknown_method", `Unknown method: ${msg.method}`);
        return;
      }
      handler(ws, msg);
    });

    ws.on("close", () => {
      if (state.tickTimer) clearInterval(state.tickTimer);
      log("client disconnected");
    });

    ws.on("error", (err) => {
      log("ws error:", err.message);
    });
  });

  wss.on("error", (err) => {
    log("server error:", err.message);
    process.exit(1);
  });

  process.on("SIGINT", () => { log("shutting down"); wss.close(); process.exit(0); });
}

start();
