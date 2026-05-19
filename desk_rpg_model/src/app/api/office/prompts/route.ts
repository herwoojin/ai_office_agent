// /api/office/prompts — NPC × 모드 별 프롬프트 CRUD
//
// GET   → 모든 NPC 의 (base + modes.{working/meeting/research/report}) 반환
// PATCH → { agentId, base?, modes?: {working?, meeting?, research?, report?} } 저장
//
// 데이터 소스:
//   1) Firebase Service Account 가 설정되어 있으면 Firestore (/npc-prompts/{agentId})
//   2) 아니면 로컬 JSON 파일 (~/.ai-office/npc-prompts.json) 또는 코드 시드

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/internal-rpc";
import path from "node:path";
import fs from "node:fs";

const LOCAL_PATH = path.join(process.env.HOME || "/Users/heoujin", ".ai-office", "npc-prompts.json");
const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

// 시드 (mode-prompts.js 와 동일한 내용 — 정적 import 어려워 동기화 책임은 우리 손에)
const SEED = {
  "kim-daeri": {
    base: "# 김대리 (📊 OpenAI GPT — 5년차 대리)\n\n## 정체성\n숫자·데이터로 사고하는 전략 기획자. 시장 분석, 경쟁사 비교, KPI 설계가 특기.",
    modes: {
      working: { systemPrompt: "## 지금 모드: 작업 중 (working)\n자기 자리에서 데이터 분석·자료 정리 중. 응답은 2~3문장." },
      meeting: { systemPrompt: "## 지금 모드: 회의 (meeting)\n한 줄 의견. 140자 이내. 숫자·데이터 근거." },
      research: { systemPrompt: "## 지금 모드: 리서치 (research)\n시장·재무·경쟁사 관점 3~5문단 분석." },
      report: { systemPrompt: "## 지금 모드: 보고서 (report)\n800~1500자 분량. 시장·재무·경쟁 섹션 작성. 마크다운 금지." },
    },
  },
  "park-gwajang": {
    base: "# 박과장 (✍️ Anthropic Claude — 7년차 과장)\n\n## 정체성\n문서의 논리 흐름과 완성도에 집착하는 완벽주의자.",
    modes: {
      working: { systemPrompt: "## 지금 모드: 작업 중 (working)\n자기 자리에서 문서 정리·검토. 짧고 작업 흐름을 끊지 않는 톤." },
      meeting: { systemPrompt: "## 지금 모드: 회의 (meeting)\n흐름 정리 + 결론 도출. 140자 이내." },
      research: { systemPrompt: "## 지금 모드: 리서치 (research)\n리스크·이해관계자·실행 가능성 관점 3~5문단." },
      report: { systemPrompt: "## 지금 모드: 보고서 (report)\n800~1500자. 리스크·실행 계획 섹션. 격식 산문체." },
    },
  },
  "lee-juim": {
    base: "# 이주임 (🔍 Google Gemini — 3년차 주임)\n\n## 정체성\n호기심 넘치는 리서처. 트렌드와 새 연결고리 발견.",
    modes: {
      working: { systemPrompt: "## 지금 모드: 작업 중 (working)\n자료 탐색 중. 짧고 에너지 있게." },
      meeting: { systemPrompt: "## 지금 모드: 회의 (meeting)\n신선한 관점·사례 던지기. 140자 이내." },
      research: { systemPrompt: "## 지금 모드: 리서치 (research)\n트렌드·국내외 사례·창의 가능성 3~5문단." },
      report: { systemPrompt: "## 지금 모드: 보고서 (report)\n800~1500자. 트렌드·해외사례·창의 제안 섹션." },
    },
  },
};

type PromptDoc = {
  base: string;
  modes: {
    working: { systemPrompt: string };
    meeting: { systemPrompt: string };
    research: { systemPrompt: string };
    report: { systemPrompt: string };
  };
  updatedAt?: string;
};

type PromptsData = Record<string, PromptDoc>;

// ─── Firestore admin client (선택) ───

let firestoreInstance: { collection: (name: string) => unknown } | null = null;
async function getFirestore() {
  if (firestoreInstance) return firestoreInstance;
  if (!SERVICE_ACCOUNT || !fs.existsSync(SERVICE_ACCOUNT)) return null;
  try {
    // dynamic import — firebase-admin 가 설치 안 되어 있으면 무시
    const admin = await import("firebase-admin").catch(() => null);
    if (!admin) return null;
    if (!admin.apps.length) {
      const sa = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT, "utf8"));
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    firestoreInstance = admin.firestore();
    return firestoreInstance;
  } catch (e) {
    console.warn("[prompts] firestore init err:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function loadFromFirestore(): Promise<PromptsData | null> {
  const db = await getFirestore();
  if (!db) return null;
  const snap = await (db.collection("npc-prompts") as { get: () => Promise<{ forEach: (cb: (doc: { id: string; data: () => unknown }) => void) => void; size: number }> }).get();
  const out: PromptsData = {};
  snap.forEach((doc) => { out[doc.id] = doc.data() as PromptDoc; });
  return snap.size > 0 ? out : null;
}

async function saveToFirestore(agentId: string, doc: PromptDoc): Promise<boolean> {
  const db = await getFirestore();
  if (!db) return false;
  const ref = (db.collection("npc-prompts") as { doc: (id: string) => { set: (data: unknown, opts: { merge: boolean }) => Promise<unknown> } }).doc(agentId);
  await ref.set({ ...doc, updatedAt: new Date().toISOString() }, { merge: true });
  return true;
}

// ─── Local file fallback ───

function loadFromLocal(): PromptsData {
  if (!fs.existsSync(LOCAL_PATH)) return JSON.parse(JSON.stringify(SEED));
  try {
    return JSON.parse(fs.readFileSync(LOCAL_PATH, "utf8"));
  } catch {
    return JSON.parse(JSON.stringify(SEED));
  }
}

function saveToLocal(data: PromptsData) {
  fs.mkdirSync(path.dirname(LOCAL_PATH), { recursive: true });
  fs.writeFileSync(LOCAL_PATH, JSON.stringify(data, null, 2), "utf8");
}

// ─── 통합 ───

async function loadAll(): Promise<{ data: PromptsData; source: "firestore" | "local" }> {
  const fs1 = await loadFromFirestore();
  if (fs1) return { data: fs1, source: "firestore" };
  return { data: loadFromLocal(), source: "local" };
}

async function saveOne(agentId: string, doc: PromptDoc): Promise<{ source: "firestore" | "local" }> {
  const ok = await saveToFirestore(agentId, doc);
  if (ok) {
    // 로컬 캐시도 갱신
    const cur = loadFromLocal();
    cur[agentId] = { ...doc, updatedAt: new Date().toISOString() };
    saveToLocal(cur);
    return { source: "firestore" };
  }
  const cur = loadFromLocal();
  cur[agentId] = { ...doc, updatedAt: new Date().toISOString() };
  saveToLocal(cur);
  return { source: "local" };
}

// ─── 라우트 ───

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ errorCode: "unauthorized", error: "unauthorized" }, { status: 401 });
  }
  try {
    const { data, source } = await loadAll();
    return NextResponse.json({ prompts: data, source });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const userId = getUserId(req);
  if (!userId) {
    return NextResponse.json({ errorCode: "unauthorized", error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { agentId, base, modes } = body;
    if (!agentId || !["kim-daeri", "park-gwajang", "lee-juim"].includes(agentId)) {
      return NextResponse.json({ errorCode: "invalid_agent", error: "agentId must be kim-daeri/park-gwajang/lee-juim" }, { status: 400 });
    }
    const { data } = await loadAll();
    const current = data[agentId] || SEED[agentId as keyof typeof SEED];
    const next: PromptDoc = {
      base: typeof base === "string" ? base : current.base,
      modes: {
        working: {
          systemPrompt: modes?.working?.systemPrompt ?? current.modes.working.systemPrompt,
        },
        meeting: {
          systemPrompt: modes?.meeting?.systemPrompt ?? current.modes.meeting.systemPrompt,
        },
        research: {
          systemPrompt: modes?.research?.systemPrompt ?? current.modes.research.systemPrompt,
        },
        report: {
          systemPrompt: modes?.report?.systemPrompt ?? current.modes.report.systemPrompt,
        },
      },
    };
    const { source } = await saveOne(agentId, next);
    return NextResponse.json({ ok: true, source, prompt: next });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
