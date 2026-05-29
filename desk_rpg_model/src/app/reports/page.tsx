"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Clock,
  PlayCircle,
  Download,
  Loader2,
  Building2,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface Channel {
  id: string;
  name: string;
  isMember?: boolean;
}

interface ReportConfig {
  enabled: boolean;
  time: string;
  timezone: string;
  lastRunAt?: string | null;
  lastRunStatus?: "ok" | "partial" | "failed" | null;
  lastError?: string | null;
}

interface ReportFileMeta {
  name: string;
  createdAt: string;
  sizeBytes: number;
}

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch {
    return iso;
  }
}

export default function ReportsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [config, setConfig] = useState<ReportConfig | null>(null);
  const [files, setFiles] = useState<ReportFileMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Load channels on mount
  useEffect(() => {
    fetch("/api/channels")
      .then((r) => r.json())
      .then((data) => {
        const list: Channel[] = Array.isArray(data) ? data : data.channels || [];
        // Prefer channels the user is a member of
        const members = list.filter((c) => c.isMember !== false);
        const ordered = members.length > 0 ? members : list;
        setChannels(ordered);
        if (ordered.length > 0) setSelectedChannelId(ordered[0].id);
      })
      .catch((err) => setError(err.message || String(err)));
  }, []);

  const loadFor = useCallback(async (channelId: string) => {
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, filesRes] = await Promise.all([
        fetch(`/api/reports/config?channelId=${channelId}`).then((r) => r.json()),
        fetch(`/api/reports/files?channelId=${channelId}`).then((r) => r.json()),
      ]);
      setConfig(cfgRes);
      setFiles(filesRes.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedChannelId) return;
    void loadFor(selectedChannelId);
  }, [selectedChannelId, loadFor]);

  async function saveConfig(partial: Partial<ReportConfig>) {
    if (!selectedChannelId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/config?channelId=${selectedChannelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      const updated = await res.json();
      setConfig(updated);
      setInfo("저장됨");
      setTimeout(() => setInfo(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function runNow() {
    if (!selectedChannelId) return;
    setRunning(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/reports/run-now", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selectedChannelId }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "실패");
      } else {
        setInfo(
          `보고서 생성 완료 (NPC ${data.successCount}/${data.npcCount}명 응답)`,
        );
        await loadFor(selectedChannelId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg,#0f0f15)] text-[var(--text,#e5e5ee)] p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-2 text-[var(--color-primary,#7c8cff)] text-sm mb-2">
            <FileText size={16} />
            <span>정기 보고서</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">AI 팀의 일일 종합 보고</h1>
          <p className="mt-2 text-[var(--text-muted,#9090a0)] max-w-2xl text-sm leading-relaxed">
            지정한 시간에 사무실의 모든 NPC에게 “오늘 진행 상황을 정리해 달라”고 요청하고, 각 답변을 하나의 마크다운 보고서로 묶어 저장합니다. 언제든 다운로드하거나 “지금 받기”로 즉시 만들 수 있어요.
          </p>
        </header>

        {/* Channel selector */}
        <section className="mb-6 rounded-xl border border-[var(--border-subtle,#2a2a35)] bg-[var(--surface,#181820)] p-5">
          <label className="flex items-center gap-2 text-sm font-medium mb-2">
            <Building2 size={16} className="text-[var(--text-muted,#9090a0)]" />
            대상 사무실
          </label>
          {channels.length === 0 ? (
            <p className="text-sm text-[var(--text-muted,#9090a0)]">
              먼저 <Link className="text-[var(--color-primary,#7c8cff)] hover:underline" href="/channels/create">사무실을 만들고</Link> 입장하세요.
            </p>
          ) : (
            <select
              value={selectedChannelId ?? ""}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="w-full max-w-md rounded-md border border-[var(--border-subtle,#2a2a35)] bg-[var(--surface-raised,#22222e)] px-3 py-2 text-sm"
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </section>

        {error && (
          <div className="mb-4 rounded-md border border-red-900/40 bg-red-950/30 p-3 text-sm text-red-200 flex gap-2">
            <AlertTriangle size={16} className="shrink-0 text-red-400 mt-0.5" />
            {error}
          </div>
        )}
        {info && (
          <div className="mb-4 rounded-md border border-emerald-900/40 bg-emerald-950/30 p-3 text-sm text-emerald-200 flex gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-400 mt-0.5" />
            {info}
          </div>
        )}

        {selectedChannelId && config && (
          <>
            {/* Schedule config */}
            <section className="mb-6 rounded-xl border border-[var(--border-subtle,#2a2a35)] bg-[var(--surface,#181820)] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold mb-4">
                <Clock size={16} className="text-[var(--color-primary,#7c8cff)]" />
                스케줄 설정
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--text-muted,#9090a0)]">자동 실행</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={config.enabled}
                    onClick={() => saveConfig({ enabled: !config.enabled })}
                    disabled={saving}
                    className={`h-9 px-3 rounded-md text-sm font-medium border transition-colors ${config.enabled
                      ? "bg-[var(--color-primary,#7c8cff)] border-[var(--color-primary,#7c8cff)] text-white"
                      : "bg-[var(--surface-raised,#22222e)] border-[var(--border-subtle,#2a2a35)] text-[var(--text-muted,#9090a0)]"}`}
                  >
                    {config.enabled ? "켜짐" : "꺼짐"}
                  </button>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--text-muted,#9090a0)]">매일 실행 시간 (24h)</span>
                  <input
                    type="time"
                    value={config.time}
                    onChange={(e) => saveConfig({ time: e.target.value })}
                    disabled={saving}
                    className="h-9 rounded-md border border-[var(--border-subtle,#2a2a35)] bg-[var(--surface-raised,#22222e)] px-2 text-sm"
                  />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--text-muted,#9090a0)]">시간대</span>
                  <select
                    value={config.timezone}
                    onChange={(e) => saveConfig({ timezone: e.target.value })}
                    disabled={saving}
                    className="h-9 rounded-md border border-[var(--border-subtle,#2a2a35)] bg-[var(--surface-raised,#22222e)] px-2 text-sm"
                  >
                    <option value="Asia/Seoul">Asia/Seoul (KST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="UTC">UTC</option>
                  </select>
                </label>
              </div>

              <div className="mt-5 flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={runNow}
                  disabled={running}
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary,#7c8cff)] text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {running ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
                  지금 보고서 받기
                </button>
                <div className="text-xs text-[var(--text-muted,#9090a0)]">
                  마지막 실행: {fmtDate(config.lastRunAt)}
                  {config.lastRunStatus && (
                    <span className="ml-2">
                      {config.lastRunStatus === "ok" && <span className="text-emerald-400">성공</span>}
                      {config.lastRunStatus === "partial" && <span className="text-amber-400">일부 실패</span>}
                      {config.lastRunStatus === "failed" && <span className="text-red-400">실패</span>}
                    </span>
                  )}
                </div>
              </div>
              {config.lastError && (
                <div className="mt-2 text-xs text-red-300">에러: {config.lastError}</div>
              )}
            </section>

            {/* Files history */}
            <section className="rounded-xl border border-[var(--border-subtle,#2a2a35)] bg-[var(--surface,#181820)] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold mb-4">
                <FileText size={16} className="text-[var(--color-primary,#7c8cff)]" />
                지난 보고서
              </div>
              {loading ? (
                <p className="text-sm text-[var(--text-muted,#9090a0)] flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> 로딩 중
                </p>
              ) : files.length === 0 ? (
                <p className="text-sm text-[var(--text-muted,#9090a0)]">
                  아직 생성된 보고서가 없습니다. 위의 “지금 보고서 받기”로 첫 보고서를 만들어 보세요.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border-subtle,#2a2a35)]">
                  {files.map((f) => (
                    <li key={f.name} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm truncate">{f.name}</div>
                        <div className="text-[11px] text-[var(--text-muted,#9090a0)]">
                          {fmtDate(f.createdAt)} · {fmtSize(f.sizeBytes)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          className="text-xs px-2.5 py-1 rounded-md border border-[var(--border-subtle,#2a2a35)] hover:bg-[var(--surface-raised,#22222e)]"
                          href={`/api/reports/files/${encodeURIComponent(f.name)}?channelId=${selectedChannelId}&inline=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          미리보기
                        </a>
                        <a
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-[var(--color-primary-muted,rgba(124,140,255,0.18))] text-[var(--color-primary,#7c8cff)] hover:opacity-90"
                          href={`/api/reports/files/${encodeURIComponent(f.name)}?channelId=${selectedChannelId}`}
                          download={f.name}
                        >
                          <Download size={12} /> 다운로드
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
