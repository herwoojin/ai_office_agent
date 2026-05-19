"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface NpcConfig {
  npcId: string;
  name: string;
  agentId: string | null;
  model: string | null;
  workspaceDir: string | null;
  identity: string;
  soul: string;
}

interface ConfigResponse {
  providers: Record<string, { configured: boolean; selected: boolean }>;
  defaultModel: string | null;
  npcs: NpcConfig[];
  rawStatusError: string | null;
}

// 사용자 친화적 모델 목록
const MODELS = {
  openai: [
    { id: "openai/gpt-4o", label: "GPT-4o (가장 균형)" },
    { id: "openai/gpt-4o-mini", label: "GPT-4o mini (빠름/저렴)" },
    { id: "openai/gpt-4.1", label: "GPT-4.1" },
    { id: "openai/gpt-5.5", label: "GPT-5.5 (Codex OAuth 필요)" },
  ],
  anthropic: [
    { id: "anthropic/claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5 (균형)" },
    { id: "anthropic/claude-opus-4-5-20250929", label: "Claude Opus 4.5 (강력)" },
    { id: "anthropic/claude-3-5-haiku-latest", label: "Claude 3.5 Haiku (빠름)" },
  ],
  google: [
    { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (빠름)" },
    { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "google/gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  ],
};

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI (GPT)",
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
};

const PROVIDER_LINKS: Record<string, string> = {
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  google: "https://aistudio.google.com/apikey",
};

export default function LlmSettingsPage() {
  const [data, setData] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null); // "anthropic-save" | "kim-daeri-model" ...
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/office/config");
      const d = await res.json();
      setData(d);
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "load failed" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveKey(provider: string) {
    const key = keyInputs[provider];
    if (!key || key.length < 6) {
      setMessage({ kind: "err", text: "키를 정확히 입력하세요." });
      return;
    }
    setBusy(`${provider}-save`);
    setMessage(null);
    try {
      const res = await fetch("/api/office/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "saveProviderKey", provider, apiKey: key }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "저장 실패");
      setMessage({ kind: "ok", text: d.message });
      setKeyInputs((s) => ({ ...s, [provider]: "" }));
      await load();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "save error" });
    } finally {
      setBusy(null);
    }
  }

  async function setModel(agentId: string, model: string) {
    setBusy(`${agentId}-model`);
    setMessage(null);
    try {
      const res = await fetch("/api/office/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setNpcModel", agentId, model }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "저장 실패");
      setMessage({ kind: "ok", text: d.message });
      await load();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "save error" });
    } finally {
      setBusy(null);
    }
  }

  async function savePersona(agentId: string, identity: string, soul: string) {
    setBusy(`${agentId}-persona`);
    setMessage(null);
    try {
      const res = await fetch("/api/office/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setNpcPersona", agentId, identity, soul }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "저장 실패");
      setMessage({ kind: "ok", text: d.message });
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "save error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-700 bg-gray-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">⚙️ LLM 설정</h1>
            <p className="text-sm text-gray-400">3개 모델 (Claude / OpenAI / Gemini) 키 입력 + NPC별 모델·페르소나 설정</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/characters" className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">← 내 캐릭터</Link>
            <Link href="/demo" className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 rounded text-sm">📺 데모</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {message && (
          <div className={`px-4 py-3 rounded ${message.kind === "ok" ? "bg-emerald-900/40 border border-emerald-700 text-emerald-200" : "bg-red-900/40 border border-red-700 text-red-200"}`}>
            {message.text}
          </div>
        )}

        {loading && <p className="text-gray-400">불러오는 중...</p>}

        {!loading && data && (
          <>
            {/* ── 1. Provider API 키 ── */}
            <section className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-1">🔑 1단계 — LLM Provider API 키</h2>
              <p className="text-sm text-gray-400 mb-4">
                각 제공자에서 키를 발급받아 입력하세요. 저장하면 OpenClaw 게이트웨이에 즉시 등록됩니다.
              </p>

              <div className="grid md:grid-cols-3 gap-4">
                {(["anthropic", "openai", "google"] as const).map((provider) => {
                  const status = data.providers[provider];
                  const configured = status?.configured;
                  return (
                    <div key={provider} className={`p-4 rounded-lg border ${configured ? "border-emerald-700 bg-emerald-900/20" : "border-gray-600 bg-gray-900/40"}`}>
                      <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold">{PROVIDER_LABELS[provider]}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${configured ? "bg-emerald-700" : "bg-gray-700"}`}>
                          {configured ? "✓ 등록됨" : "미등록"}
                        </span>
                      </div>
                      <a href={PROVIDER_LINKS[provider]} target="_blank" rel="noopener" className="text-xs text-blue-400 hover:underline mb-3 inline-block">
                        키 발급 페이지 ↗
                      </a>
                      <input
                        type="password"
                        placeholder={`${provider} API 키 (sk-... / AIza...)`}
                        value={keyInputs[provider] || ""}
                        onChange={(e) => setKeyInputs((s) => ({ ...s, [provider]: e.target.value }))}
                        className="w-full px-3 py-2 rounded bg-black/50 border border-gray-700 text-sm"
                      />
                      <button
                        onClick={() => saveKey(provider)}
                        disabled={busy === `${provider}-save`}
                        className="mt-2 w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded text-sm font-semibold"
                      >
                        {busy === `${provider}-save` ? "저장 중..." : configured ? "키 재등록" : "키 저장 + 등록"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ── 2. NPC별 모델 + 페르소나 ── */}
            <section className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-1">🎭 2단계 — NPC별 모델 + 페르소나</h2>
              <p className="text-sm text-gray-400 mb-4">
                각 NPC가 어떤 LLM 으로 응답할지, 그리고 어떤 인격(페르소나)을 가질지 설정합니다.
              </p>

              {data.npcs.length === 0 && (
                <p className="text-gray-500">등록된 NPC 가 없습니다. 채널을 먼저 만드세요.</p>
              )}

              <div className="space-y-4">
                {data.npcs.map((npc) => (
                  <NpcConfigCard
                    key={npc.npcId}
                    npc={npc}
                    busy={busy}
                    onSetModel={setModel}
                    onSavePersona={savePersona}
                  />
                ))}
              </div>
            </section>

            {/* ── 3. 모드별 프롬프트 ── */}
            <ModePromptsSection />

            {/* ── 4. 디버그 정보 ── */}
            {data.rawStatusError && (
              <section className="bg-red-900/30 border border-red-700 rounded p-4 text-sm">
                ⚠ OpenClaw status 호출 실패: {data.rawStatusError}
              </section>
            )}
            <section className="text-xs text-gray-500">
              현재 기본 모델: <code>{data.defaultModel || "(unset)"}</code>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function NpcConfigCard({
  npc, busy, onSetModel, onSavePersona,
}: {
  npc: NpcConfig;
  busy: string | null;
  onSetModel: (agentId: string, model: string) => void;
  onSavePersona: (agentId: string, identity: string, soul: string) => void;
}) {
  const [identity, setIdentity] = useState(npc.identity);
  const [soul, setSoul] = useState(npc.soul);
  const [open, setOpen] = useState(false);

  useEffect(() => { setIdentity(npc.identity); setSoul(npc.soul); }, [npc.identity, npc.soul]);

  if (!npc.agentId) {
    return (
      <div className="p-4 bg-gray-900/40 border border-gray-700 rounded">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">{npc.name}</h3>
          <span className="text-xs text-yellow-400">⚠ OpenClaw 에이전트 미연결</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">이 NPC 는 게이트웨이 에이전트가 없어 LLM 채팅이 불가합니다.</p>
      </div>
    );
  }

  const allModels = [...MODELS.openai, ...MODELS.anthropic, ...MODELS.google];

  return (
    <div className="p-4 bg-gray-900/40 border border-gray-700 rounded">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <h3 className="font-bold flex items-center gap-2">
          {npc.name}
          <code className="text-xs bg-black/40 px-1.5 py-0.5 rounded text-gray-400">{npc.agentId}</code>
        </h3>
        <span className="text-xs text-gray-400">
          현재 모델: <code className="text-emerald-400">{npc.model || "기본값"}</code>
        </span>
      </div>

      {/* 모델 셀렉터 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <label className="text-sm text-gray-400">모델 선택:</label>
        <select
          value={npc.model || ""}
          onChange={(e) => onSetModel(npc.agentId!, e.target.value)}
          disabled={busy === `${npc.agentId}-model`}
          className="flex-1 min-w-[200px] px-3 py-1.5 bg-black/50 border border-gray-700 rounded text-sm"
        >
          <option value="">— 모델 선택 —</option>
          <optgroup label="OpenAI">
            {MODELS.openai.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </optgroup>
          <optgroup label="Anthropic Claude">
            {MODELS.anthropic.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </optgroup>
          <optgroup label="Google Gemini">
            {MODELS.google.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </optgroup>
        </select>
        {busy === `${npc.agentId}-model` && <span className="text-xs text-gray-400">저장 중...</span>}
      </div>

      {/* 페르소나 토글 */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-blue-400 hover:underline"
      >
        {open ? "▼ 페르소나 편집 닫기" : "▶ 페르소나(프롬프트) 편집"}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              IDENTITY.md — 정체성/역할/말투 (모든 응답에 시스템 프롬프트로 주입됨)
            </label>
            <textarea
              value={identity}
              onChange={(e) => setIdentity(e.target.value)}
              rows={10}
              className="w-full p-3 bg-black/50 border border-gray-700 rounded text-xs font-mono"
              placeholder="# IDENTITY.md&#10;..."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              SOUL.md — 내면/동기/감정 (선택, 더 풍부한 페르소나)
            </label>
            <textarea
              value={soul}
              onChange={(e) => setSoul(e.target.value)}
              rows={6}
              className="w-full p-3 bg-black/50 border border-gray-700 rounded text-xs font-mono"
              placeholder="# SOUL.md&#10;..."
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => onSavePersona(npc.agentId!, identity, soul)}
              disabled={busy === `${npc.agentId}-persona`}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded text-sm font-semibold"
            >
              {busy === `${npc.agentId}-persona` ? "저장 중..." : "💾 페르소나 저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 모드별 프롬프트 편집 (Firestore 또는 로컬 저장)
// ─────────────────────────────────────────────────────────────

type Mode = "working" | "meeting" | "research" | "report";

const MODE_INFO: Record<Mode, { label: string; emoji: string; desc: string }> = {
  working: { label: "작업 중", emoji: "💼", desc: "자기 자리에서 묵묵히 일하는 모드. 응답 2~3문장 짧게." },
  meeting: { label: "회의", emoji: "🪑", desc: "회의실에서 한 줄 의견. 140자 이내." },
  research: { label: "리서치", emoji: "🔍", desc: "주제 깊이 분석. 3~5문단." },
  report: { label: "보고서", emoji: "📄", desc: "보고서 섹션 작성. 800~1500자." },
};

const AGENT_LABELS: Record<string, string> = {
  "kim-daeri": "김대리 (📊 OpenAI GPT)",
  "park-gwajang": "박과장 (✍️ Anthropic Claude)",
  "lee-juim": "이주임 (🔍 Google Gemini)",
};

interface PromptDoc {
  base: string;
  modes: Record<Mode, { systemPrompt: string }>;
  updatedAt?: string;
}

function ModePromptsSection() {
  const [prompts, setPrompts] = useState<Record<string, PromptDoc> | null>(null);
  const [source, setSource] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeAgent, setActiveAgent] = useState<string>("kim-daeri");
  const [activeMode, setActiveMode] = useState<Mode>("working");
  const [draft, setDraft] = useState<{ base: string; mode: string }>({ base: "", mode: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/office/prompts");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "load failed");
      setPrompts(d.prompts);
      setSource(d.source);
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "load error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!prompts) return;
    const doc = prompts[activeAgent];
    if (!doc) return;
    setDraft({
      base: doc.base || "",
      mode: doc.modes?.[activeMode]?.systemPrompt || "",
    });
  }, [prompts, activeAgent, activeMode]);

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/office/prompts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: activeAgent,
          base: draft.base,
          modes: { [activeMode]: { systemPrompt: draft.mode } },
        }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) throw new Error(d.error || "save failed");
      setMsg({ kind: "ok", text: `${AGENT_LABELS[activeAgent]} / ${MODE_INFO[activeMode].label} 저장됨 (→ ${d.source})` });
      await load();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "save error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold mb-1">🧠 3단계 — 모드별 시스템 프롬프트</h2>
          <p className="text-sm text-gray-400">
            각 NPC가 4가지 작업 모드(작업/회의/리서치/보고서)에서 어떻게 동작할지 시스템 프롬프트를 편집합니다.
            {source === "firestore" && <span className="ml-2 text-emerald-400">☁ Firestore</span>}
            {source === "local" && <span className="ml-2 text-yellow-400">💾 로컬 저장 (Firestore 미연결)</span>}
          </p>
        </div>
      </div>

      {loading && <p className="text-gray-400">불러오는 중...</p>}

      {!loading && prompts && (
        <>
          {msg && (
            <div className={`mb-3 px-3 py-2 rounded text-sm ${msg.kind === "ok" ? "bg-emerald-900/40 text-emerald-200 border border-emerald-700" : "bg-red-900/40 text-red-200 border border-red-700"}`}>
              {msg.text}
            </div>
          )}

          {/* NPC 탭 */}
          <div className="flex gap-2 mb-3 flex-wrap">
            {Object.keys(AGENT_LABELS).map((aid) => (
              <button
                key={aid}
                onClick={() => setActiveAgent(aid)}
                className={`px-3 py-1.5 rounded text-sm font-medium ${activeAgent === aid ? "bg-amber-600" : "bg-gray-700 hover:bg-gray-600"}`}
              >
                {AGENT_LABELS[aid]}
              </button>
            ))}
          </div>

          {/* 모드 탭 */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {(Object.keys(MODE_INFO) as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => setActiveMode(m)}
                className={`px-3 py-1.5 rounded text-sm font-medium ${activeMode === m ? "bg-blue-600" : "bg-gray-700 hover:bg-gray-600"}`}
                title={MODE_INFO[m].desc}
              >
                {MODE_INFO[m].emoji} {MODE_INFO[m].label}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-500 mb-3">
            <strong>{MODE_INFO[activeMode].emoji} {MODE_INFO[activeMode].label} 모드</strong>: {MODE_INFO[activeMode].desc}
          </p>

          {/* 베이스 페르소나 */}
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-1">
              베이스 페르소나 (모든 모드에 항상 포함됨)
            </label>
            <textarea
              value={draft.base}
              onChange={(e) => setDraft((s) => ({ ...s, base: e.target.value }))}
              rows={6}
              className="w-full p-3 bg-black/50 border border-gray-700 rounded text-xs font-mono"
              placeholder="# 김대리 (📊 OpenAI GPT)..."
            />
          </div>

          {/* 모드별 시스템 프롬프트 */}
          <div className="mb-4">
            <label className="block text-xs text-gray-400 mb-1">
              {MODE_INFO[activeMode].emoji} <strong>{MODE_INFO[activeMode].label}</strong> 모드 전용 지시 (이 모드 진행 시 베이스 뒤에 붙음)
            </label>
            <textarea
              value={draft.mode}
              onChange={(e) => setDraft((s) => ({ ...s, mode: e.target.value }))}
              rows={10}
              className="w-full p-3 bg-black/50 border border-gray-700 rounded text-xs font-mono"
              placeholder="## 지금 모드: ..."
            />
          </div>

          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              💡 <strong>{MODE_INFO[activeMode].label}</strong> 모드는 <code className="bg-black/30 px-1 rounded">/{activeMode === "meeting" ? "meeting" : activeMode === "research" ? "research" : activeMode === "report" ? "report" : "task"}</code> 명령이 트리거 함.
            </p>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded font-semibold"
            >
              {saving ? "저장 중..." : "💾 저장"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
