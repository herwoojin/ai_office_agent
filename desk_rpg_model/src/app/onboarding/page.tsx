"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Sparkles,
  UserPlus,
  Cpu,
  KeyRound,
  Bot,
  Building2,
  MessageSquare,
  ListTodo,
  Repeat,
  ArrowRight,
  AlertTriangle,
  Lightbulb,
  Image as ImageIcon,
} from "lucide-react";

const STORAGE_KEY = "onboarding.completed";

type Step = {
  id: string;
  num: number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle: string;
  body: React.ReactNode;
  ctaLabel: string;
  ctaHref: string;
  imageSrc?: string;
  imageAlt: string;
  tip?: string;
  warning?: string;
};

const STEPS: Step[] = [
  {
    id: "character",
    num: 1,
    icon: UserPlus,
    title: "내 캐릭터 만들기",
    subtitle: "사무실에 들어갈 나의 픽셀 캐릭터를 생성합니다.",
    body: (
      <>
        <p>가장 먼저 본인의 캐릭터를 만들어요. 이 캐릭터로 사무실에 출근하고 NPC들과 대화합니다.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2 text-sm text-[var(--text-muted,#9090a0)]">
          <li>이름은 자유롭게 (예: 워크 매니저, 호진)</li>
          <li>외모는 머리 / 의상 / 신발 등 부위별로 선택 가능</li>
          <li>최대 5개까지 만들 수 있어요</li>
        </ul>
      </>
    ),
    ctaLabel: "캐릭터 만들러 가기",
    ctaHref: "/characters/create",
    imageSrc: "/onboarding/01-character.png",
    imageAlt: "캐릭터 만들기 화면 예시",
    tip: "이미 있다면 캐릭터 목록 페이지에서 그대로 사용해도 됩니다.",
  },
  {
    id: "gateway",
    num: 2,
    icon: Cpu,
    title: "AI 게이트웨이 확인",
    subtitle: "OpenClaw 게이트웨이가 살아 있는지 점검합니다.",
    body: (
      <>
        <p>NPC가 LLM과 대화하려면 게이트웨이가 필요합니다. 로컬 개발 환경에서는 자동으로 떠 있는 경우가 많아요.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2 text-sm text-[var(--text-muted,#9090a0)]">
          <li><b>localhost</b>에서 실행 중이면 — <code className="px-1 py-0.5 rounded bg-[var(--surface-raised,#22222e)] text-xs">ws://127.0.0.1:18789</code> 에 자동 바인딩</li>
          <li>안 떠 있으면 터미널에서 <code className="px-1 py-0.5 rounded bg-[var(--surface-raised,#22222e)] text-xs">openclaw gateway --port 18789</code></li>
          <li>다른 기기/원격을 쓰려면 <b>페어링 코드</b>로 연결</li>
        </ul>
      </>
    ),
    ctaLabel: "게이트웨이 페이지 열기",
    ctaHref: "/gateways",
    imageSrc: "/onboarding/02-gateway.png",
    imageAlt: "게이트웨이 등록 화면 예시",
    warning: "게이트웨이가 빨간 점이면 NPC가 응답하지 않습니다. 먼저 살려두세요.",
  },
  {
    id: "llm-key",
    num: 3,
    icon: KeyRound,
    title: "LLM 키 등록 (가장 중요)",
    subtitle: "OpenAI / Anthropic / Google 중 한 곳의 API 키를 넣습니다.",
    body: (
      <>
        <p>NPC가 실제로 “생각”하려면 LLM(예: GPT, Claude, Gemini) 서비스의 API 키가 필요합니다. 한 곳만 등록해도 동작합니다.</p>
        <ol className="list-decimal pl-5 space-y-1 mt-2 text-sm text-[var(--text-muted,#9090a0)]">
          <li>OpenAI 키는 <a className="text-[var(--color-primary,#7c8cff)] hover:underline" target="_blank" rel="noopener noreferrer" href="https://platform.openai.com/api-keys">platform.openai.com/api-keys</a> 에서 발급</li>
          <li>Anthropic 키는 <a className="text-[var(--color-primary,#7c8cff)] hover:underline" target="_blank" rel="noopener noreferrer" href="https://console.anthropic.com/settings/keys">console.anthropic.com/settings/keys</a></li>
          <li>Google(Gemini) 키는 <a className="text-[var(--color-primary,#7c8cff)] hover:underline" target="_blank" rel="noopener noreferrer" href="https://aistudio.google.com/app/apikey">aistudio.google.com/app/apikey</a></li>
          <li>발급받은 키를 <b>설정 → LLM</b> 페이지의 <b>1단계</b>에 붙여넣고 저장</li>
        </ol>
      </>
    ),
    ctaLabel: "LLM 설정 페이지로",
    ctaHref: "/settings/llm",
    imageSrc: "/onboarding/03-llm-key.png",
    imageAlt: "LLM API 키 입력 화면 예시",
    tip: "키는 OpenClaw 게이트웨이의 보안 저장소에 저장됩니다. 브라우저에 평문으로 남지 않아요.",
    warning: "키 없이는 NPC가 무응답입니다. (가장 흔한 ‘안 됨’ 원인)",
  },
  {
    id: "model",
    num: 4,
    icon: Bot,
    title: "NPC마다 모델 지정",
    subtitle: "각 직원(NPC)에게 사용할 LLM 모델을 골라줍니다.",
    body: (
      <>
        <p>같은 LLM 설정 페이지에서 NPC별로 모델을 따로 지정할 수 있어요.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2 text-sm text-[var(--text-muted,#9090a0)]">
          <li><b>김대리</b> · <b>박과장</b> · <b>이주임</b> 등 사무실의 NPC들이 보입니다</li>
          <li>각 NPC 우측의 모델 드롭다운에서 선택 (예: <code className="px-1 py-0.5 rounded bg-[var(--surface-raised,#22222e)] text-xs">openai/gpt-4.1</code>)</li>
          <li>고급 작업엔 강한 모델, 단순 응대엔 빠른 모델 — 비용/품질 trade-off</li>
        </ul>
      </>
    ),
    ctaLabel: "NPC 모델 지정하기",
    ctaHref: "/settings/llm",
    imageSrc: "/onboarding/04-npc-model.png",
    imageAlt: "NPC 모델 지정 화면 예시",
    tip: "모델을 바꾸면 게이트웨이 재시작이 필요할 수 있습니다. ‘적용을 위해 재시작 권장’ 안내가 뜨면 따라주세요.",
  },
  {
    id: "channel",
    num: 5,
    icon: Building2,
    title: "사무실(채널) 만들기",
    subtitle: "AI 팀원들이 일할 공간을 하나 만듭니다.",
    body: (
      <>
        <p>사무실 = 하나의 공간(채널). 그 안에 NPC를 배치하고, 함께 일하는 화면입니다.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2 text-sm text-[var(--text-muted,#9090a0)]">
          <li><b>이름</b>: “기획팀”, “1인 회사” 등 자유롭게</li>
          <li><b>공개/비공개</b>: 혼자 쓸 거면 비공개</li>
          <li>나중에 NPC를 더 채용/배치할 수 있어요</li>
        </ul>
      </>
    ),
    ctaLabel: "사무실 만들기",
    ctaHref: "/channels/create",
    imageSrc: "/onboarding/05-channel.png",
    imageAlt: "사무실(채널) 생성 화면 예시",
  },
  {
    id: "first-chat",
    num: 6,
    icon: MessageSquare,
    title: "NPC와 첫 대화",
    subtitle: "게임 화면에서 NPC를 클릭하고 인사해 봅니다.",
    body: (
      <>
        <p>사무실에 들어가면 캐릭터로 움직이며 NPC와 대화할 수 있어요.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2 text-sm text-[var(--text-muted,#9090a0)]">
          <li>NPC 옆으로 이동 → 클릭 → 채팅창 열림</li>
          <li>“안녕? 너는 누구야?” 같은 가벼운 인사로 응답 확인</li>
          <li>응답이 오면 LLM 연결 정상</li>
        </ul>
      </>
    ),
    ctaLabel: "사무실로 들어가기",
    ctaHref: "/channels",
    imageSrc: "/onboarding/06-chat.png",
    imageAlt: "NPC와 첫 채팅 화면 예시",
    warning: "응답이 안 오면 (1) 게이트웨이 (2) LLM 키 (3) NPC 모델 순서로 다시 확인해주세요.",
  },
  {
    id: "first-task",
    num: 7,
    icon: ListTodo,
    title: "첫 업무 부여",
    subtitle: "“OO 좀 해줘” 형식으로 자연어 업무를 던집니다.",
    body: (
      <>
        <p>NPC에게 단순 채팅 대신 <b>업무</b>를 맡길 수 있어요. 채팅창에 자연어로 부탁하면 작업 카드가 자동 생성됩니다.</p>
        <div className="mt-2 p-3 rounded-md bg-[var(--surface-raised,#22222e)] text-sm">
          <p className="text-[var(--text-muted,#9090a0)] mb-1">예시 프롬프트</p>
          <p>“우리 회사 기술 스택 정리해서 markdown으로 만들어줘.”</p>
          <p>“오늘 처리할 메일을 자동 분류하는 스크립트 짜줘.”</p>
        </div>
        <ul className="list-disc pl-5 space-y-1 mt-2 text-sm text-[var(--text-muted,#9090a0)]">
          <li>업무 보드에서 진행 상태(대기/진행/완료) 추적</li>
          <li>NPC가 결과 보고서를 자동으로 정리해 알려줍니다</li>
        </ul>
      </>
    ),
    ctaLabel: "사무실에서 시작",
    ctaHref: "/channels",
    imageSrc: "/onboarding/07-task.png",
    imageAlt: "NPC에게 업무 부여 예시",
    tip: "여러 NPC에게 다른 업무를 동시에 부여해도 됩니다. 각자 병렬로 일해요.",
  },
  {
    id: "autopilot",
    num: 8,
    icon: Repeat,
    title: "24/7 자동 운영으로 전환",
    subtitle: "내가 자리에 없어도 AI 팀이 알아서 돌아가게 합니다.",
    body: (
      <>
        <p>마지막 단계 — 진짜 “나 대신 일하는” 셋업.</p>
        <ul className="list-disc pl-5 space-y-1 mt-2 text-sm text-[var(--text-muted,#9090a0)]">
          <li><b>정기 회의</b>: 매일 아침 NPC끼리 회의 → 회의록을 나에게 보고</li>
          <li><b>외부 알림</b>: 텔레그램 / 슬랙 / 카카오톡으로 NPC가 메시지 전송</li>
          <li><b>이메일 모니터링</b>: Gmail 인박스를 NPC가 자동 정리</li>
          <li><b>스케줄러</b>: cron으로 NPC에게 정기 트리거</li>
        </ul>
      </>
    ),
    ctaLabel: "고급 설정 보기",
    ctaHref: "/settings/llm",
    imageSrc: "/onboarding/08-autopilot.png",
    imageAlt: "자동 운영 설정 예시",
    tip: "처음엔 1~2개만 켜고, 잘 되는지 확인하면서 늘리세요.",
  },
];

function StepImage({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="aspect-[16/9] rounded-lg border border-dashed border-[var(--border-subtle,#2a2a35)] bg-[var(--surface-raised,#22222e)] flex flex-col items-center justify-center text-[var(--text-muted,#9090a0)] gap-2">
        <ImageIcon size={28} />
        <p className="text-xs">{alt}</p>
        <p className="text-[10px] opacity-60">스크린샷을 <code>public{src ?? "/onboarding/..."}</code> 에 추가하면 자동 표시됩니다</p>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className="w-full rounded-lg border border-[var(--border-subtle,#2a2a35)] bg-[var(--surface-raised,#22222e)]"
    />
  );
}

export default function OnboardingPage() {
  const [doneIds, setDoneIds] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      return new Set<string>(JSON.parse(raw));
    } catch {
      return new Set();
    }
  });

  function toggleDone(id: string) {
    const next = new Set(doneIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDoneIds(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {}
  }

  const progress = Math.round((doneIds.size / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-[var(--bg,#0f0f15)] text-[var(--text,#e5e5ee)]">
      {/* Hero */}
      <header className="border-b border-[var(--border-subtle,#2a2a35)] bg-[var(--surface,#181820)]">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-center gap-2 text-[var(--color-primary,#7c8cff)] text-sm mb-2">
            <Sparkles size={16} />
            <span>처음 사용 가이드</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            나 대신 일하는 AI 사무실, <br className="hidden md:block" />
            <span className="text-[var(--color-primary,#7c8cff)]">10분 안에</span> 셋업하기
          </h1>
          <p className="mt-3 text-[var(--text-muted,#9090a0)] leading-relaxed max-w-2xl">
            처음이라 막막하셨죠? 아래 8단계만 그대로 따라 하면, AI 직원들이 내 일을 대신 처리하는 작은 사무실이 완성됩니다. 각 단계마다 ‘지금 이동’ 버튼이 있으니, 눌러서 바로 작업하고 돌아오세요.
          </p>

          {/* Progress */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted,#9090a0)] mb-1.5">
              <span>진행률</span>
              <span>{doneIds.size} / {STEPS.length} 단계 완료</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface-raised,#22222e)] overflow-hidden">
              <div
                className="h-full bg-[var(--color-primary,#7c8cff)] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Steps */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-12">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const done = doneIds.has(step.id);
          return (
            <section
              key={step.id}
              className={`rounded-xl border ${done ? "border-[var(--color-primary-muted,rgba(124,140,255,0.4))] bg-[var(--color-primary-muted,rgba(124,140,255,0.05))]" : "border-[var(--border-subtle,#2a2a35)] bg-[var(--surface,#181820)]"} p-6 md:p-8 transition-colors`}
            >
              <div className="grid md:grid-cols-[auto,1fr] gap-5 md:gap-8 items-start">
                {/* Number badge */}
                <div className="flex md:flex-col items-center md:items-start gap-3">
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold ${done ? "bg-[var(--color-primary,#7c8cff)] text-white" : "bg-[var(--surface-raised,#22222e)] text-[var(--color-primary,#7c8cff)]"}`}
                  >
                    {done ? <CheckCircle2 size={28} /> : step.num}
                  </div>
                  <Icon size={20} className="text-[var(--text-muted,#9090a0)] hidden md:block" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <h2 className="text-xl md:text-2xl font-semibold">{step.title}</h2>
                    <button
                      type="button"
                      onClick={() => toggleDone(step.id)}
                      className={`shrink-0 inline-flex items-center gap-1.5 text-xs rounded-full px-3 py-1 border transition-colors ${done ? "border-[var(--color-primary,#7c8cff)] text-[var(--color-primary,#7c8cff)] bg-[var(--color-primary-muted,rgba(124,140,255,0.12))]" : "border-[var(--border-subtle,#2a2a35)] text-[var(--text-muted,#9090a0)] hover:text-[var(--text,#e5e5ee)]"}`}
                    >
                      <CheckCircle2 size={12} />
                      {done ? "완료됨" : "완료 표시"}
                    </button>
                  </div>
                  <p className="text-[var(--text-muted,#9090a0)] mb-4">{step.subtitle}</p>

                  <div className="text-sm leading-relaxed space-y-2 mb-4">
                    {step.body}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <StepImage src={step.imageSrc} alt={step.imageAlt} />
                    <div className="space-y-2">
                      {step.tip && (
                        <div className="rounded-md border border-[var(--border-subtle,#2a2a35)] bg-[var(--surface-raised,#22222e)] p-3 text-sm flex gap-2">
                          <Lightbulb size={16} className="shrink-0 text-amber-400 mt-0.5" />
                          <div>
                            <div className="text-xs font-medium text-amber-400 mb-0.5">팁</div>
                            <div className="text-[var(--text-muted,#c0c0d0)]">{step.tip}</div>
                          </div>
                        </div>
                      )}
                      {step.warning && (
                        <div className="rounded-md border border-red-900/40 bg-red-950/30 p-3 text-sm flex gap-2">
                          <AlertTriangle size={16} className="shrink-0 text-red-400 mt-0.5" />
                          <div>
                            <div className="text-xs font-medium text-red-400 mb-0.5">주의</div>
                            <div className="text-red-200/90">{step.warning}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <Link
                    href={step.ctaHref}
                    className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary,#7c8cff)] text-white px-4 py-2 text-sm font-medium hover:opacity-90"
                  >
                    {step.ctaLabel}
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </section>
          );
        })}

        {/* Footer / Next steps */}
        <section className="rounded-xl border border-[var(--border-subtle,#2a2a35)] bg-[var(--surface,#181820)] p-6 md:p-8">
          <h3 className="text-lg font-semibold mb-2">막혔을 때 체크리스트</h3>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-[var(--text-muted,#9090a0)]">
            <li>NPC가 무응답이면 → STEP 3 (LLM 키), STEP 4 (NPC 모델) 다시 확인</li>
            <li>“Restart the gateway to apply” 안내가 떴으면 → 터미널에서 게이트웨이 재시작</li>
            <li>설정 페이지가 30초 이상 멈춰 있으면 → OpenClaw CLI 자체가 느린 상태. 잠시 후 재시도</li>
            <li>그래도 안 되면 → 콘솔(F12) 에러를 캡쳐해서 운영자에게 공유</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/characters" className="rounded-md border border-[var(--border-subtle,#2a2a35)] px-4 py-2 text-sm hover:bg-[var(--surface-raised,#22222e)]">
              내 캐릭터 보기
            </Link>
            <Link href="/channels" className="rounded-md border border-[var(--border-subtle,#2a2a35)] px-4 py-2 text-sm hover:bg-[var(--surface-raised,#22222e)]">
              사무실 목록
            </Link>
            <Link href="/settings/llm" className="rounded-md border border-[var(--border-subtle,#2a2a35)] px-4 py-2 text-sm hover:bg-[var(--surface-raised,#22222e)]">
              LLM 설정
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
