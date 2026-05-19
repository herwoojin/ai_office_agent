"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ServiceStatus {
  deskrpg: boolean;
  trigger: boolean;
  openclaw: boolean;
  telegram: boolean;
  slack: boolean;
  discord: boolean;
  firestore: boolean;
}

const PLATFORMS = [
  {
    id: "macos",
    icon: "🖥️",
    name: "맥북 24시간 운영",
    desc: "Sleep 모드에서도 동작 + 자동 시작 설정",
    bullets: [
      "System Settings → Battery → 'Prevent automatic sleeping...'",
      "launchd 자동 시작 (scripts/install-launchd.sh)",
      "caffeinate 로 idle sleep 방지 (전력 5W ~)",
    ],
    setupHref: "https://github.com/herwoojin/ai_office_agent/blob/main/docs/platform-setup/macos-always-on.md",
  },
  {
    id: "telegram",
    icon: "📱",
    name: "텔레그램 봇",
    desc: "스마트폰에서 명령으로 AI Office 조작 (5분)",
    bullets: [
      "@BotFather 에서 봇 생성 + 토큰 받기",
      "@userinfobot 으로 내 user ID 확인",
      ".env.local 에 TELEGRAM_BOT_TOKEN + TELEGRAM_ALLOWED_USERS 입력",
    ],
    setupHref: "https://github.com/herwoojin/ai_office_agent/blob/main/docs/platform-setup/telegram-setup.md",
  },
  {
    id: "slack",
    icon: "💬",
    name: "슬랙 봇",
    desc: "팀 워크스페이스에서 명령 → AI Office (10분)",
    bullets: [
      "api.slack.com/apps 에서 새 App 만들기",
      "Bot Token Scopes: chat:write, channels:history, ...",
      ".env.local 에 SLACK_BOT_TOKEN + SLACK_REPORT_CHANNEL 입력",
    ],
    setupHref: "https://github.com/herwoojin/ai_office_agent/blob/main/docs/platform-setup/slack-setup.md",
  },
  {
    id: "discord",
    icon: "🎮",
    name: "디스코드 봇",
    desc: "디스코드 서버 / DM 에서 명령 (5분)",
    bullets: [
      "Discord Developer Portal 에서 봇 생성",
      "MESSAGE CONTENT INTENT 켜기 ⭐",
      ".env.local 에 DISCORD_BOT_TOKEN + DISCORD_CHANNEL_ID 입력",
    ],
    setupHref: "https://github.com/herwoojin/ai_office_agent/blob/main/docs/platform-setup/discord-setup.md",
  },
];

const MODES = [
  { id: "working", icon: "💼", name: "작업 모드", desc: "자기 자리에서 묵묵히 일함. 짧은 응답.", trigger: "/task <내용>" },
  { id: "meeting", icon: "🪑", name: "회의 모드", desc: "회의실 모여 3명 한 줄 의견.", trigger: "/meeting <주제>" },
  { id: "research", icon: "🔍", name: "리서치 모드", desc: "3명 동시 깊이 분석.", trigger: "/research <주제>" },
  { id: "report", icon: "📄", name: "보고서 모드", desc: "3명 섹션 분담 → 박과장 통합.", trigger: "/report <주제>" },
];

export default function SetupHubPage() {
  const [status, setStatus] = useState<ServiceStatus | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/office/status");
        if (!r.ok) throw new Error();
        setStatus(await r.json());
      } catch {
        // 기본값 (status 엔드포인트 없으면 unknown)
        setStatus({
          deskrpg: true, trigger: true, openclaw: true,
          telegram: false, slack: false, discord: false, firestore: false,
        });
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-700 bg-gray-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">🛠️ 설정 허브</h1>
            <p className="text-sm text-gray-400">맥북 24시간 운영 + 외부 메시지 채널 + LLM 모델 설정</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/characters" className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm">← 내 캐릭터</Link>
            <Link href="/settings/llm" className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded text-sm">⚙️ LLM 설정</Link>
            <Link href="/demo" className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 rounded text-sm">📺 데모</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {/* 4단계 빠른 시작 */}
        <section className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-lg p-6 border border-indigo-700/50">
          <h2 className="text-xl font-bold mb-3">⚡ 4단계 빠른 시작</h2>
          <ol className="space-y-2 text-sm">
            <li><strong className="text-amber-300">1.</strong> [/settings/llm](settings/llm) 에서 OpenAI/Claude/Gemini API 키 입력</li>
            <li><strong className="text-amber-300">2.</strong> 아래 <strong>맥북 24시간 운영</strong> 가이드로 자동 시작 등록</li>
            <li><strong className="text-amber-300">3.</strong> 아래 <strong>텔레그램/슬랙/디스코드</strong> 중 하나(또는 셋 다) 설정</li>
            <li><strong className="text-amber-300">4.</strong> 메시지 보내기: <code className="bg-black/40 px-1 rounded">/meeting 여름 신메뉴 전략</code></li>
          </ol>
        </section>

        {/* 4가지 작업 모드 */}
        <section>
          <h2 className="text-xl font-bold mb-3">🎯 4가지 작업 모드</h2>
          <p className="text-sm text-gray-400 mb-4">
            각 모드는 NPC 별로 다른 시스템 프롬프트를 사용합니다. 모드별 프롬프트 편집은{" "}
            <Link href="/settings/llm" className="text-amber-400 hover:underline">⚙️ LLM 설정 → 3단계</Link> 에서.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
            {MODES.map((m) => (
              <div key={m.id} className="p-4 bg-gray-800 border border-gray-700 rounded">
                <div className="text-3xl mb-2">{m.icon}</div>
                <h3 className="font-bold">{m.name}</h3>
                <p className="text-xs text-gray-400 mt-1 mb-2">{m.desc}</p>
                <code className="text-xs bg-black/40 px-2 py-1 rounded text-emerald-300">{m.trigger}</code>
              </div>
            ))}
          </div>
        </section>

        {/* 상태 표시 */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-3">📊 현재 서비스 상태</h2>
          {status ? (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <StatusItem label="DeskRPG :3000" ok={status.deskrpg} />
              <StatusItem label="HTTP Trigger :13000" ok={status.trigger} />
              <StatusItem label="OpenClaw :18789" ok={status.openclaw} />
              <StatusItem label="텔레그램 봇" ok={status.telegram} hint="TELEGRAM_BOT_TOKEN 필요" />
              <StatusItem label="슬랙 봇" ok={status.slack} hint="SLACK_BOT_TOKEN 필요" />
              <StatusItem label="디스코드 봇" ok={status.discord} hint="DISCORD_BOT_TOKEN 필요" />
              <StatusItem label="Firestore (프롬프트 동기화)" ok={status.firestore} hint="FIREBASE_SERVICE_ACCOUNT_PATH 필요" />
            </div>
          ) : <p className="text-gray-400">상태 불러오는 중...</p>}
        </section>

        {/* 4개 플랫폼 카드 */}
        <section>
          <h2 className="text-xl font-bold mb-3">📚 플랫폼 설정 가이드</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {PLATFORMS.map((p) => (
              <div key={p.id} className="p-5 bg-gray-800 border border-gray-700 rounded-lg hover:border-amber-600/50 transition">
                <div className="flex items-start gap-3">
                  <div className="text-4xl">{p.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{p.name}</h3>
                    <p className="text-sm text-gray-400 mb-3">{p.desc}</p>
                    <ul className="text-xs text-gray-300 space-y-1 mb-3">
                      {p.bullets.map((b, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-amber-400">·</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                    <a
                      href={p.setupHref}
                      target="_blank"
                      rel="noopener"
                      className="inline-block px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded text-sm font-semibold"
                    >
                      📖 상세 가이드 열기 ↗
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 사용 예시 */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-3">💬 메시지 보내는 예시</h2>
          <p className="text-sm text-gray-400 mb-3">
            텔레그램·슬랙·디스코드 어느 채널에서든 동일한 명령이 동작합니다.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-emerald-400 mb-2">기본 명령</h3>
              <pre className="bg-black/40 p-3 rounded text-xs space-y-1">
{`/help
/status
/task 여름 신메뉴 기획
/meeting 음료 카테고리 전략
/research 2026 한국 편의점 PB 트렌드
/report Q3 매출 분석 보고서`}
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-emerald-400 mb-2">예상 응답 시간</h3>
              <ul className="text-sm space-y-2">
                <li><code className="text-amber-300">/task</code> → <strong>5초</strong> (NPC 자리 이동 + 풍선)</li>
                <li><code className="text-amber-300">/meeting</code> → <strong>60–90초</strong> (3명 순차 발언)</li>
                <li><code className="text-amber-300">/research</code> → <strong>30–60초</strong> (3명 병렬)</li>
                <li><code className="text-amber-300">/report</code> → <strong>90–150초</strong> (섹션 + 통합)</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusItem({ label, ok, hint }: { label: string; ok: boolean; hint?: string }) {
  return (
    <div className={`p-3 rounded border ${ok ? "bg-emerald-900/20 border-emerald-700" : "bg-gray-900/40 border-gray-700"}`}>
      <div className="flex items-center gap-2">
        <span className={ok ? "text-emerald-400" : "text-gray-500"}>{ok ? "●" : "○"}</span>
        <span className={`text-sm font-medium ${ok ? "text-white" : "text-gray-400"}`}>{label}</span>
      </div>
      {!ok && hint && <p className="text-xs text-gray-500 mt-1 ml-5">{hint}</p>}
    </div>
  );
}
