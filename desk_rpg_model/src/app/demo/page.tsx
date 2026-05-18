"use client";

import Link from "next/link";
import { useState } from "react";

const SCENES = [
  {
    n: 1,
    title: "채널 목록",
    img: "/demo/screenshots/01-channels-list.png",
    body: "브라우저로 http://localhost:3000 에 접속해 로그인하면 채널 목록이 보입니다. 'AI Office' 채널이 데모 무대입니다.",
  },
  {
    n: 2,
    title: "사무실 진입 — 3명의 NPC",
    img: "/demo/screenshots/02-office-scene.png",
    body: "Small Office 맵에 김대리(📊 OpenAI), 박과장(✍️ Claude), 이주임(🔍 Gemini) 세 명이 보입니다. 각각 머리는 서로 다른 LLM이 담당합니다.",
  },
  {
    n: 3,
    title: "자율 산책 (디지털 트윈)",
    img: "/demo/screenshots/03-wandering.png",
    body: "가만히 두면 1.2초마다 한 칸씩 자율적으로 이동합니다. 일하는 모드 / 산책 모드 / 휴식 모드를 자동으로 오갑니다. 가끔 '분석 중...', '재밌는 사례 발견!' 같은 풍선 메시지를 띄웁니다.",
  },
  {
    n: 4,
    title: "/task 업무 분배",
    img: "/demo/screenshots/04-task-dispatched.png",
    body: "터미널에서 curl 한 줄 또는 텔레그램 /task 명령으로 업무 지시. 3명이 자기 자리로 휙 이동하고 짧은 액션 풍선이 뜹니다.",
  },
  {
    n: 5,
    title: "회의 소집",
    img: "/demo/screenshots/05-meeting-start.png",
    body: "/meeting 명령을 보내면 3명이 회의실 좌석으로 모입니다. 회의 시작을 알리는 풍선 메시지가 표시됩니다.",
  },
  {
    n: 6,
    title: "🌟 실제 LLM 응답 풍선",
    img: "/demo/screenshots/06-meeting-llm-bubble.png",
    body: "각자 자기 LLM 모델을 진짜로 호출해서 의견을 만들어옵니다. OpenAI / Claude / Gemini의 응답이 풍선으로 표시됩니다.",
  },
  {
    n: 7,
    title: "회의 진행",
    img: "/demo/screenshots/07-meeting-late.png",
    body: "3명이 차례대로 의견을 내고 있습니다. 한 명당 약 25~30초, 전체 회의 약 70~90초가 걸립니다.",
  },
  {
    n: 8,
    title: "회의 종료 — 자기 자리 복귀",
    img: "/demo/screenshots/08-meeting-end.png",
    body: "회의가 끝나면 3명은 자기 자리로 돌아가고, 다시 디지털 트윈 산책 모드로 복귀합니다.",
  },
];

export default function DemoPage() {
  const [active, setActive] = useState(0);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto p-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🎬 AI Office Agents — 데모</h1>
            <p className="text-sm text-gray-400">3명의 AI 직원이 일하는 가상 사무실</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/characters"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded font-semibold"
            >
              ← 내 캐릭터
            </Link>
            <Link
              href="/settings/llm"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 rounded font-semibold"
            >
              ⚙️ LLM 설정
            </Link>
            <Link
              href="/channels"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded font-semibold"
            >
              🏢 채널 / 오피스 입장
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Hero Video */}
        <section className="bg-gray-800 rounded-lg overflow-hidden">
          <video
            className="w-full"
            controls
            autoPlay
            muted
            loop
            playsInline
            src="/demo/ai-office-demo.mp4"
          />
          <div className="p-4">
            <h2 className="text-lg font-semibold">▶️ 자동 녹화 데모 영상</h2>
            <p className="text-sm text-gray-400">
              Playwright로 자동 녹화 · 약 2분 · 무음
              (보이스오버를 입히고 싶다면{" "}
              <code className="bg-gray-700 px-1 rounded">demo/VIDEO-SCRIPT.md</code> 참조)
            </p>
          </div>
        </section>

        {/* Step navigator */}
        <section>
          <h2 className="text-xl font-bold mb-4">📋 단계별로 보기</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {SCENES.map((s, i) => (
              <button
                key={s.n}
                onClick={() => setActive(i)}
                className={`px-3 py-2 rounded text-sm font-medium ${
                  active === i
                    ? "bg-indigo-600"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
              >
                {s.n}. {s.title}
              </button>
            ))}
          </div>
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SCENES[active].img}
              alt={SCENES[active].title}
              className="w-full block"
            />
            <div className="p-4">
              <h3 className="text-lg font-semibold">
                씬 {SCENES[active].n} — {SCENES[active].title}
              </h3>
              <p className="text-gray-300 mt-2 leading-relaxed">
                {SCENES[active].body}
              </p>
            </div>
          </div>
        </section>

        {/* 3 LLM 직원 */}
        <section className="grid md:grid-cols-3 gap-4">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-3xl mb-2">📊</div>
            <h3 className="font-bold text-lg">김대리</h3>
            <p className="text-xs text-gray-500 mb-2">OpenAI GPT</p>
            <p className="text-sm text-gray-300">데이터 분석, 시장 조사, 수치 기반 전략</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-3xl mb-2">✍️</div>
            <h3 className="font-bold text-lg">박과장</h3>
            <p className="text-xs text-gray-500 mb-2">Anthropic Claude</p>
            <p className="text-sm text-gray-300">보고서 작성, 품질 관리, 논리 검증</p>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-3xl mb-2">🔍</div>
            <h3 className="font-bold text-lg">이주임</h3>
            <p className="text-xs text-gray-500 mb-2">Google Gemini</p>
            <p className="text-sm text-gray-300">웹 리서치, 트렌드 분석, 새 아이디어</p>
          </div>
        </section>

        {/* How to use */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">🎯 직접 해보기</h2>
          <div className="space-y-4 text-sm">
            <div>
              <h3 className="font-semibold mb-1">1️⃣ 사무실 보기</h3>
              <p className="text-gray-400 mb-1">위의 "🏢 채널 / 오피스 입장" 버튼 클릭 → AI Office 채널 진입</p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">2️⃣ 업무 분배</h3>
              <pre className="bg-black/50 p-3 rounded text-xs overflow-x-auto">
{`curl -X POST http://127.0.0.1:13000/office/task \\
  -H 'Content-Type: application/json' \\
  -d '{"task":"여름 신메뉴 기획"}'`}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold mb-1">3️⃣ 회의 소집 (60~90초)</h3>
              <pre className="bg-black/50 p-3 rounded text-xs overflow-x-auto">
{`curl -X POST http://127.0.0.1:13000/office/meeting \\
  -H 'Content-Type: application/json' \\
  -d '{"topic":"여름 음료 카테고리 전략"}'`}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold mb-1">4️⃣ 상태 조회</h3>
              <pre className="bg-black/50 p-3 rounded text-xs overflow-x-auto">
{`curl -X POST http://127.0.0.1:13000/office/status -d '{}'`}
              </pre>
            </div>
          </div>
        </section>

        {/* Setup checklist */}
        <section className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">⚙️ 처음 설정해야 할 것 (3가지)</h2>
          <ol className="space-y-3 text-sm">
            <li>
              <span className="font-semibold text-yellow-400">① LLM API 키 3개 발급</span>
              <ul className="ml-4 mt-1 text-gray-400 list-disc">
                <li>Claude: <a className="text-blue-400 hover:underline" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a></li>
                <li>OpenAI: <a className="text-blue-400 hover:underline" href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com</a></li>
                <li>Gemini: <a className="text-blue-400 hover:underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com</a></li>
              </ul>
              <p className="text-gray-500 mt-1 text-xs">
                키를 <code className="bg-black/50 px-1 rounded">.env.local</code> 에 입력
              </p>
            </li>
            <li>
              <span className="font-semibold text-yellow-400">② NPC ↔ 모델 자동 매핑</span>
              <pre className="ml-4 mt-1 bg-black/50 p-2 rounded text-xs">
                bash scripts/configure-llm-models.sh
              </pre>
            </li>
            <li>
              <span className="font-semibold text-yellow-400">③ (선택) 텔레그램 봇 토큰 설정</span>
              <p className="ml-4 mt-1 text-gray-400 text-xs">
                BotFather 토큰 + 본인 user ID 를 .env.local 에 입력하고 dev-server 재시작
              </p>
            </li>
          </ol>
        </section>

        <footer className="text-center text-gray-500 text-xs pt-4 pb-8">
          📚 자세한 설명은 <code>demo/DEMO-GUIDE.md</code> · 소스 <code>deskrpg-integration/server-patch.js</code>
        </footer>
      </main>
    </div>
  );
}
