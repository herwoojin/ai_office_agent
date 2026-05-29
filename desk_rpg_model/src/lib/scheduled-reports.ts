// Scheduled aggregate reports — per-channel daily summary that each NPC contributes to.
//
// Storage (no DB migration):
//   data/reports/{channelId}/config.json
//     { enabled, time: "HH:MM", timezone, lastRunAt, lastRunStatus }
//   data/reports/{channelId}/files/{ISO}.md
//
// Scheduler: a single setInterval(60s) on boot scans every channel config and
// runs aggregator if `time` matches "now" in the channel's timezone and last
// run is older than 23h.
//
// Aggregator: for each NPC in the channel, ask the OpenClaw gateway to produce
// a short markdown summary, then combine sections into one report.

import fs from "node:fs";
import path from "node:path";
import { db, channels, npcs } from "@/db";
import { eq } from "drizzle-orm";
import { parseDbObject } from "@/lib/db-json";
import { getOrConnectGateway } from "@/server/socket-handlers";

export interface ReportConfig {
  enabled: boolean;
  time: string; // "HH:MM" in 24h
  timezone: string; // IANA tz, e.g. "Asia/Seoul"
  lastRunAt?: string | null;
  lastRunStatus?: "ok" | "partial" | "failed" | null;
  lastError?: string | null;
}

export interface ReportFileMeta {
  name: string;
  createdAt: string;
  sizeBytes: number;
}

const DEFAULT_CONFIG: ReportConfig = {
  enabled: false,
  time: "18:00",
  timezone: "Asia/Seoul",
  lastRunAt: null,
  lastRunStatus: null,
  lastError: null,
};

function reportsRoot(): string {
  return path.join(process.cwd(), "data", "reports");
}

function channelDir(channelId: string): string {
  return path.join(reportsRoot(), channelId);
}

function configPath(channelId: string): string {
  return path.join(channelDir(channelId), "config.json");
}

function filesDir(channelId: string): string {
  return path.join(channelDir(channelId), "files");
}

export function readConfig(channelId: string): ReportConfig {
  try {
    const raw = fs.readFileSync(configPath(channelId), "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeConfig(channelId: string, partial: Partial<ReportConfig>) {
  fs.mkdirSync(channelDir(channelId), { recursive: true });
  const merged = { ...readConfig(channelId), ...partial };
  fs.writeFileSync(configPath(channelId), JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

export function listReportFiles(channelId: string): ReportFileMeta[] {
  const dir = filesDir(channelId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name));
      return { name, createdAt: stat.mtime.toISOString(), sizeBytes: stat.size };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function readReportFile(channelId: string, name: string): string | null {
  // Hard guard against path traversal.
  if (!/^[\w.\-:]+\.md$/.test(name)) return null;
  const full = path.join(filesDir(channelId), name);
  if (!full.startsWith(filesDir(channelId))) return null;
  try {
    return fs.readFileSync(full, "utf8");
  } catch {
    return null;
  }
}

// ─── Aggregator ──────────────────────────────────────────────────────────────

const NPC_PROMPT = (npcName: string, period: string) => `당신은 ${npcName} 입니다.

지금까지 ${period} 동안 진행한 업무에 대해 다음 형식의 마크다운으로 간결하게 보고하세요.
- 각 섹션은 2~3 bullet, 한 줄당 80자 이내
- 한국어로 작성
- 추측이 아니라 실제 한 일/발견한 것만

## 진행 상황
## 주요 발견 및 인사이트
## 내일 계획

위 헤딩 그대로 사용하세요. 다른 인삿말이나 부가 설명은 넣지 마세요.`;

interface NpcPiece {
  npcId: string;
  agentId: string | null;
  name: string;
  content: string;
  ok: boolean;
  durationMs: number;
}

async function generateNpcPiece(
  channelId: string,
  npc: { id: string; name: string; agentId: string | null; sessionKeyPrefix: string },
  period: string,
): Promise<NpcPiece> {
  const started = Date.now();
  if (!npc.agentId) {
    return {
      npcId: npc.id,
      agentId: null,
      name: npc.name,
      content: "_(에이전트가 연결되지 않아 보고를 건너뜁니다.)_",
      ok: false,
      durationMs: Date.now() - started,
    };
  }
  const gateway = await getOrConnectGateway(channelId);
  if (!gateway) {
    return {
      npcId: npc.id,
      agentId: npc.agentId,
      name: npc.name,
      content: "_(OpenClaw 게이트웨이 연결 실패.)_",
      ok: false,
      durationMs: Date.now() - started,
    };
  }
  const sessionKey = `${npc.sessionKeyPrefix || npc.id}-report-${Date.now()}`;
  try {
    const reply = await Promise.race([
      gateway.chatSend(npc.agentId, sessionKey, NPC_PROMPT(npc.name, period), () => {}),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("npc_report_timeout")), 90_000),
      ),
    ]);
    return {
      npcId: npc.id,
      agentId: npc.agentId,
      name: npc.name,
      content: String(reply || "").trim() || "_(빈 응답)_",
      ok: true,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      npcId: npc.id,
      agentId: npc.agentId,
      name: npc.name,
      content: `_(보고 생성 실패: ${err instanceof Error ? err.message : String(err)})_`,
      ok: false,
      durationMs: Date.now() - started,
    };
  }
}

function buildReportMarkdown(
  channelName: string,
  period: string,
  pieces: NpcPiece[],
  generatedAt: Date,
): string {
  const okCount = pieces.filter((p) => p.ok).length;
  const lines: string[] = [];
  lines.push(`# ${channelName} 정기 보고서`);
  lines.push("");
  lines.push(`- 생성 시각: ${generatedAt.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`);
  lines.push(`- 기간: ${period}`);
  lines.push(`- 참여 NPC: ${pieces.length}명 (응답 성공 ${okCount}/${pieces.length})`);
  lines.push("");
  lines.push("---");
  lines.push("");
  for (const piece of pieces) {
    lines.push(`## 🧑‍💼 ${piece.name}`);
    lines.push("");
    lines.push(piece.content);
    lines.push("");
    lines.push(`_생성 시간: ${(piece.durationMs / 1000).toFixed(1)}s · ${piece.ok ? "✅" : "⚠️"}_`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }
  // Cross-NPC executive summary placeholder (could be a second LLM pass).
  lines.push("## 📌 종합 요약");
  lines.push("");
  if (okCount === 0) {
    lines.push("모든 NPC의 응답 생성에 실패했습니다. 게이트웨이 / 모델 / LLM 키를 확인하세요.");
  } else {
    lines.push(`${okCount}명의 NPC가 보고를 제출했습니다. 각 섹션을 확인하여 후속 의사결정에 활용하세요.`);
  }
  lines.push("");
  return lines.join("\n");
}

export interface RunReportResult {
  ok: boolean;
  fileName?: string;
  filePath?: string;
  npcCount: number;
  successCount: number;
  error?: string;
}

export async function runScheduledReport(channelId: string, period = "최근 24시간"): Promise<RunReportResult> {
  let channelName = channelId;
  try {
    const rows = await db.select({ name: channels.name }).from(channels).where(eq(channels.id, channelId)).limit(1);
    if (rows[0]?.name) channelName = rows[0].name;
  } catch {}

  let npcRows: Array<{ id: string; name: string; openclawConfig: unknown }> = [];
  try {
    npcRows = await db
      .select({ id: npcs.id, name: npcs.name, openclawConfig: npcs.openclawConfig })
      .from(npcs)
      .where(eq(npcs.channelId, channelId));
  } catch (err) {
    return {
      ok: false,
      npcCount: 0,
      successCount: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
  if (npcRows.length === 0) {
    return { ok: false, npcCount: 0, successCount: 0, error: "no_npcs_in_channel" };
  }

  const pieces: NpcPiece[] = [];
  for (const row of npcRows) {
    const cfg = parseDbObject(row.openclawConfig) || {};
    const piece = await generateNpcPiece(
      channelId,
      {
        id: row.id,
        name: row.name,
        agentId: (cfg.agentId as string) || null,
        sessionKeyPrefix: (cfg.sessionKeyPrefix as string) || row.id,
      },
      period,
    );
    pieces.push(piece);
  }

  const generatedAt = new Date();
  const md = buildReportMarkdown(channelName, period, pieces, generatedAt);

  fs.mkdirSync(filesDir(channelId), { recursive: true });
  const stamp = generatedAt.toISOString().replace(/[:.]/g, "-");
  const fileName = `${stamp}.md`;
  const filePath = path.join(filesDir(channelId), fileName);
  fs.writeFileSync(filePath, md, "utf8");

  const successCount = pieces.filter((p) => p.ok).length;
  writeConfig(channelId, {
    lastRunAt: generatedAt.toISOString(),
    lastRunStatus: successCount === pieces.length ? "ok" : successCount > 0 ? "partial" : "failed",
    lastError: null,
  });

  return {
    ok: true,
    fileName,
    filePath,
    npcCount: pieces.length,
    successCount,
  };
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

let schedulerTimer: NodeJS.Timeout | null = null;
const runningChannels = new Set<string>();

function nowInTz(tz: string): { hh: number; mm: number } {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const hh = Number(parts.find((p) => p.type === "hour")?.value || "0");
    const mm = Number(parts.find((p) => p.type === "minute")?.value || "0");
    return { hh, mm };
  } catch {
    const d = new Date();
    return { hh: d.getHours(), mm: d.getMinutes() };
  }
}

async function tick() {
  let allChannelIds: string[];
  try {
    const rows = await db.select({ id: channels.id }).from(channels);
    allChannelIds = rows.map((r) => r.id);
  } catch {
    return;
  }

  for (const channelId of allChannelIds) {
    const cfg = readConfig(channelId);
    if (!cfg.enabled) continue;
    if (runningChannels.has(channelId)) continue;
    const [hhStr, mmStr] = (cfg.time || "18:00").split(":");
    const hh = Number(hhStr);
    const mm = Number(mmStr);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    const now = nowInTz(cfg.timezone || "Asia/Seoul");
    if (now.hh !== hh || now.mm !== mm) continue;

    // Debounce: skip if last run within 23 hours.
    if (cfg.lastRunAt) {
      const elapsed = Date.now() - new Date(cfg.lastRunAt).getTime();
      if (elapsed < 23 * 60 * 60 * 1000) continue;
    }

    runningChannels.add(channelId);
    runScheduledReport(channelId)
      .catch((err) => {
        console.error(`[reports] scheduled run failed for ${channelId}:`, err);
        writeConfig(channelId, {
          lastRunStatus: "failed",
          lastError: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        runningChannels.delete(channelId);
      });
  }
}

export function startReportScheduler() {
  if (schedulerTimer) return;
  // Run on minute boundaries: align first tick to top of minute.
  const msToNextMinute = 60_000 - (Date.now() % 60_000);
  setTimeout(() => {
    void tick();
    schedulerTimer = setInterval(() => void tick(), 60_000);
  }, msToNextMinute);
  console.log("[reports] scheduler started");
}

export function stopReportScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}
