// /api/office/config — AI Office NPC 설정 API
// GET  → 현재 provider 인증 상태 + 각 NPC 의 (agent, model, persona) 반환
// POST → { action } 기반 dispatch:
//   - "saveProviderKey" { provider, apiKey }
//   - "setNpcModel"     { agentId, model }
//   - "setNpcPersona"   { agentId, identity?, soul? }

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/internal-rpc";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db, npcs } from "@/db";
import { parseDbObject } from "@/lib/db-json";
import fs from "node:fs";
import path from "node:path";

const exec = promisify(execFile);

const PROVIDERS = ["anthropic", "google", "openai"] as const;
type Provider = (typeof PROVIDERS)[number];

const EXEC_OPTS = { timeout: 90000, maxBuffer: 8 * 1024 * 1024 };

async function ocStatus() {
  try {
    const { stdout } = await exec("openclaw", ["capability", "model", "auth", "status"], EXEC_OPTS);
    return JSON.parse(stdout);
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function listProviders() {
  try {
    const { stdout } = await exec("openclaw", ["capability", "model", "providers"], EXEC_OPTS);
    const out: Array<{ provider: string; configured: boolean; selected: boolean }> = [];
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("{")) continue;
      try { out.push(JSON.parse(trimmed)); } catch { /* skip non-json lines */ }
    }
    console.log("[office/config] listProviders parsed:", out.length, "items");
    return out;
  } catch (e) {
    console.warn("[office/config] listProviders failed:", e instanceof Error ? e.message : e);
    return [];
  }
}

async function readOpenClawConfig() {
  const p = path.join(process.env.HOME || "/Users/heoujin", ".openclaw", "openclaw.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

async function setAgentModel(agentId: string, model: string) {
  // openclaw 의 config set 은 JSONPath 필터를 지원하지 않고 숫자 인덱스만 받음.
  // 따라서 id 로 인덱스를 먼저 찾아서 agents.list[N] 경로를 구성한다.
  const cfg = await readOpenClawConfig();
  const list = (cfg?.agents?.list || []) as Array<{ id?: string }>;
  const idx = list.findIndex((entry) => entry?.id === agentId);
  if (idx < 0) {
    throw new Error(`agent ${agentId} not found in agents.list — openclaw.json 에 항목을 먼저 만들어 두세요`);
  }
  await exec("openclaw", ["config", "set", `agents.list[${idx}].model.primary`, model], { timeout: 15000 });
  // 'allowed' 리스트에도 추가해서 fallback 으로 동작하게 한다
  try {
    await exec(
      "openclaw",
      ["config", "set", `agents.list[${idx}].model.allowed`, JSON.stringify([model])],
      { timeout: 15000 },
    );
  } catch {/* allowed 필드는 옵션 */}
}

async function loginProvider(provider: Provider, apiKey: string) {
  try {
    const homeDir = process.env.HOME || "/Users/heoujin";
    const agents = ["main", "kim-daeri", "park-gwajang", "lee-juim"];
    
    for (const agent of agents) {
      const authPath = path.join(homeDir, ".openclaw", "agents", agent, "agent", "auth-profiles.json");
      const parentDir = path.dirname(authPath);
      
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      let data: any = { version: 1, profiles: {} };
      if (fs.existsSync(authPath)) {
        try {
          data = JSON.parse(fs.readFileSync(authPath, "utf8"));
        } catch (e) {
          console.warn(`Failed to parse auth-profiles for ${agent}, resetting:`, e);
        }
      }

      if (!data.profiles) data.profiles = {};

      const profileKey = `${provider}:manual`;
      data.profiles[profileKey] = {
        type: "api_key",
        provider: provider,
        key: apiKey
      };

      fs.writeFileSync(authPath, JSON.stringify(data, null, 2), "utf8");
    }

    // openclaw.json 에도 등록하는 것이 안전함
    const openclawJsonPath = path.join(homeDir, ".openclaw", "openclaw.json");
    if (fs.existsSync(openclawJsonPath)) {
      try {
        const configData = JSON.parse(fs.readFileSync(openclawJsonPath, "utf8"));
        if (!configData.auth) configData.auth = {};
        if (!configData.auth.profiles) configData.auth.profiles = {};
        
        configData.auth.profiles[`${provider}:manual`] = {
          provider: provider,
          mode: "api_key"
        };
        
        fs.writeFileSync(openclawJsonPath, JSON.stringify(configData, null, 2), "utf8");
      } catch (e) {
        console.warn("Failed to update openclaw.json auth profiles:", e);
      }
    }

    return { ok: true, output: `${provider} API 키 저장 완료` };
  } catch (e) {
    return { ok: false, output: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ errorCode: "unauthorized", error: "unauthorized" }, { status: 401 });
  }

  const [status, providers, ocConfig] = await Promise.all([
    ocStatus(), listProviders(), readOpenClawConfig(),
  ]);

  // Provider 별 인증 상태 추출
  const providerStatus: Record<string, { configured: boolean; selected: boolean }> = {};
  for (const p of providers) {
    if (PROVIDERS.includes(p.provider)) {
      providerStatus[p.provider] = { configured: !!p.configured, selected: !!p.selected };
    }
  }

  // NPC 목록 + 매핑된 OpenClaw agent + 모델 + 페르소나
  const npcRows = await db.select().from(npcs);
  const agents = (ocConfig?.agents?.list || []) as Array<{
    id: string; name?: string; model?: { primary?: string }; identity?: { name?: string };
  }>;

  type EnrichedNpc = {
    npcId: string;
    name: string;
    agentId: string | null;
    model: string | null;
    workspaceDir: string | null;
    identity: string;
    soul: string;
  };

  const result: EnrichedNpc[] = [];
  for (const npc of npcRows) {
    const cfg = parseDbObject(npc.openclawConfig) as { agentId?: string; personaConfig?: { identity?: string; soul?: string } } | null;
    const agentId = cfg?.agentId || null;
    const ocAgent = agentId ? agents.find((a) => a.id === agentId) : null;

    // 페르소나는 (a) DB 저장본 우선, (b) 없으면 OpenClaw agent dir 에서 읽음
    let identityText = cfg?.personaConfig?.identity || "";
    let soulText = cfg?.personaConfig?.soul || "";
    if (agentId && !identityText) {
      try {
        const idPath = path.join(process.env.HOME || "", ".openclaw", "agents", agentId, "agent", "IDENTITY.md");
        if (fs.existsSync(idPath)) identityText = fs.readFileSync(idPath, "utf8");
      } catch {}
    }
    if (agentId && !soulText) {
      try {
        const soulPath = path.join(process.env.HOME || "", ".openclaw", "agents", agentId, "agent", "SOUL.md");
        if (fs.existsSync(soulPath)) soulText = fs.readFileSync(soulPath, "utf8");
      } catch {}
    }

    result.push({
      npcId: npc.id,
      name: npc.name,
      agentId,
      model: ocAgent?.model?.primary || null,
      workspaceDir: agentId ? `~/.openclaw/agents/${agentId}/agent` : null,
      identity: identityText,
      soul: soulText,
    });
  }

  return NextResponse.json({
    providers: providerStatus,
    defaultModel: status?.resolvedDefault || ocConfig?.agents?.defaults?.model?.primary || null,
    npcs: result,
    rawStatusError: status?.error || null,
  });
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ errorCode: "unauthorized", error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.action) {
    return NextResponse.json({ errorCode: "action_required", error: "action required" }, { status: 400 });
  }

  try {
    if (body.action === "saveProviderKey") {
      const { provider, apiKey } = body;
      if (!PROVIDERS.includes(provider)) {
        return NextResponse.json({ errorCode: "invalid_provider", error: `provider must be one of ${PROVIDERS.join(",")}` }, { status: 400 });
      }
      if (typeof apiKey !== "string" || apiKey.length < 6) {
        return NextResponse.json({ errorCode: "invalid_key", error: "apiKey too short" }, { status: 400 });
      }
      const r = await loginProvider(provider as Provider, apiKey);
      if (!r.ok) {
        return NextResponse.json({ ok: false, error: r.output.slice(-400) }, { status: 500 });
      }
      return NextResponse.json({ ok: true, message: `${provider} 인증 완료`, output: r.output.slice(-400) });
    }

    if (body.action === "setNpcModel") {
      const { agentId, model } = body;
      if (!agentId || !model) {
        return NextResponse.json({ errorCode: "missing_params", error: "agentId, model required" }, { status: 400 });
      }
      await setAgentModel(agentId, model);
      return NextResponse.json({
        ok: true,
        message: `${agentId} → ${model} 설정 완료. 변경을 적용하려면 OpenClaw 게이트웨이를 재시작해야 할 수 있어요 (\`openclaw gateway --port 18789\` 재실행).`,
      });
    }

    if (body.action === "setNpcPersona") {
      const { agentId, identity, soul } = body;
      if (!agentId) {
        return NextResponse.json({ errorCode: "missing_agent", error: "agentId required" }, { status: 400 });
      }
      const agentDir = path.join(process.env.HOME || "", ".openclaw", "agents", agentId, "agent");
      if (!fs.existsSync(agentDir)) {
        return NextResponse.json({ errorCode: "agent_dir_not_found", error: `agent ${agentId} 없음` }, { status: 404 });
      }
      if (typeof identity === "string") {
        fs.writeFileSync(path.join(agentDir, "IDENTITY.md"), identity, "utf8");
      }
      if (typeof soul === "string") {
        fs.writeFileSync(path.join(agentDir, "SOUL.md"), soul, "utf8");
      }
      return NextResponse.json({ ok: true, message: `${agentId} 페르소나 저장` });
    }

    return NextResponse.json({ errorCode: "unknown_action", error: `unknown action: ${body.action}` }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
