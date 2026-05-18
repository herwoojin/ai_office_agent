# 🏢 AI Office Agents — 3인 AI 직원 가상 사무실 시스템

> DeskRPG + Hermes Agent + OpenClaw-Kakao 통합 멀티 에이전트 시스템

## 🎯 시스템 개요

텔레그램으로 업무를 지시하면, **3명의 AI 직원(OpenAI, Claude, Gemini)** 이 DeskRPG 가상 사무실에서 걸어다니며 일하고, 서로 **미팅·논쟁**한 뒤, 최종 **보고서**를 텔레그램 / 카카오톡 / 슬랙으로 전송하는 시스템입니다.

```
사용자(텔레그램)
    │
    ▼
┌──────────────────────────────────┐
│  Hermes Agent Gateway            │
│  (Telegram / Slack / KakaoTalk)  │
└──────────┬───────────────────────┘
           │  WebSocket RPC
           ▼
┌──────────────────────────────────┐
│  DeskRPG Server (Next.js)        │
│  ┌────────────────────────────┐  │
│  │  OpenClaw Gateway (WS RPC) │  │
│  └────────┬───────────────────┘  │
│           │                      │
│  ┌────────▼───────────────────┐  │
│  │  Meeting Broker             │  │
│  │  (Poll → Raise Hand → Speak)│  │
│  └────────┬───────────────────┘  │
│           │                      │
│  ┌────────▼───────────────────┐  │
│  │  3x AI NPC Agents          │  │
│  │  ┌─────┐ ┌─────┐ ┌──────┐│  │
│  │  │ GPT │ │Claude│ │Gemini││  │
│  │  └─────┘ └─────┘ └──────┘│  │
│  └───────────────────────────┘  │
│                                  │
│  Phaser.js 2D Office (브라우저)   │
└──────────────────────────────────┘
```

---

## 📦 프로젝트 구조

```
ai-office-agents/
├── docs/
│   └── GUIDE.md                  ← 이 파일
├── config/
│   ├── .env.example              ← 환경변수 템플릿
│   └── cli-config.yaml           ← Hermes Agent 설정
├── agents/
│   ├── openai-agent/
│   │   ├── IDENTITY.md           ← GPT NPC 페르소나
│   │   ├── SOUL.md               ← 성격/톤
│   │   └── AGENTS.md             ← 회의 프로토콜
│   ├── claude-agent/
│   │   ├── IDENTITY.md
│   │   ├── SOUL.md
│   │   └── AGENTS.md
│   └── gemini-agent/
│       ├── IDENTITY.md
│       ├── SOUL.md
│       └── AGENTS.md
├── gateway/
│   └── multi-agent-router.py     ← 메시지 라우팅 + 회의 트리거
├── deskrpg-integration/
│   ├── npc-presets.ts             ← 3인 NPC 외형/역할 정의
│   ├── office-preset.json        ← 사무실 맵 배치
│   └── task-dispatcher.ts        ← 텔레그램→태스크 변환
├── scripts/
│   ├── setup.sh                  ← 원클릭 설치
│   └── start.sh                  ← 원클릭 실행
├── package.json
└── README.md
```

---

## 🚀 설치 가이드 (Step-by-Step)

### STEP 1: 사전 준비물

| 항목 | 설명 |
|------|------|
| Node.js 18+ | DeskRPG 실행 |
| Python 3.11+ | Hermes Agent 실행 |
| PostgreSQL 또는 SQLite | DeskRPG DB |
| Telegram Bot Token | @BotFather에서 발급 |
| Slack Bot Token | Slack App 생성 후 발급 |
| OpenAI API Key | GPT NPC용 |
| Anthropic API Key | Claude NPC용 |
| Google AI API Key | Gemini NPC용 |
| macOS (카톡 연동 시) | kmsg CLI 필요 |

### STEP 2: DeskRPG 설치

```bash
# 레포 클론
git clone https://github.com/herwoojin/desk_rpg_model.git
cd desk_rpg_model

# 의존성 설치
npm install

# SQLite 모드 (간편)
npm run setup:lite

# 또는 PostgreSQL 모드
cp .env.example .env.local
# .env.local 편집 후:
npm run setup
```

### STEP 3: Hermes Agent 설치

```bash
# 원클릭 설치
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc

# 초기 설정
hermes setup
```

### STEP 4: 카카오톡 연동 (macOS 전용)

```bash
# kmsg CLI 설치
mkdir -p ~/.local/bin
curl -fL https://github.com/channprj/kmsg/releases/latest/download/kmsg-macos-universal \
  -o ~/.local/bin/kmsg && chmod +x ~/.local/bin/kmsg

# Claude Code 스킬 설치
git clone https://github.com/herwoojin/openclaw-kakao.git
claude install-skill openclaw-kakao/kmsg.skill
```

### STEP 5: 환경변수 설정

```bash
cp config/.env.example .env.local
```

`.env.local`을 열어 모든 API 키와 토큰을 입력합니다.

### STEP 6: 실행

```bash
# 터미널 1: DeskRPG 서버
cd desk_rpg_model && npm run dev

# 터미널 2: Hermes Gateway (Telegram + Slack)
hermes gateway

# 브라우저에서 http://localhost:3000 접속
```

---

## 🤖 3인 AI 직원 역할 정의

### 1. 김대리 (OpenAI GPT) — 전략 기획
- **모델:** `gpt-4o` (OpenAI)
- **역할:** 시장 분석, 전략 수립, 데이터 해석
- **성격:** 분석적, 체계적, 숫자에 강함
- **회의 스타일:** 근거 기반 주장, 데이터 인용

### 2. 박과장 (Claude) — 보고서 작성 / 품질 관리
- **모델:** `claude-sonnet-4-20250514` (Anthropic)
- **역할:** 문서 작성, 보고서 편집, 논리 검증
- **성격:** 꼼꼼하고 논리적, 완벽주의
- **회의 스타일:** 논리적 반박, 대안 제시

### 3. 이주임 (Gemini) — 리서치 / 크리에이티브
- **모델:** `gemini-2.0-flash` (Google)
- **역할:** 웹 리서치, 아이디어 발산, 트렌드 분석
- **성격:** 창의적, 호기심 많음, 빠른 검색
- **회의 스타일:** 새로운 관점 제시, 브레인스토밍

---

## 🏗️ 핵심 아키텍처 상세

### A. 업무 흐름 (Task Flow)

```
1. 사용자가 텔레그램으로 메시지 전송
   예: "편의점 2026 하반기 신선식품 전략 보고서 만들어줘"

2. Hermes Gateway가 메시지 수신
   → multi-agent-router.py가 태스크 분류

3. DeskRPG 서버에 태스크 생성
   → TaskManager.handleTaskAction()
   → 3개 NPC에게 동시 할당

4. 각 NPC가 자기 역할에 따라 작업 수행
   - 이주임(Gemini): 시장 조사 및 트렌드 검색
   - 김대리(GPT): 데이터 분석 및 전략 수립
   - 박과장(Claude): 초안 작성 및 종합

5. 회의 자동 소집 (Meeting Broker)
   - Poll → Raise Hand → Speak 모델
   - NPC 간 논쟁 및 의견 조율
   - 회의록 자동 생성

6. 최종 보고서 생성
   → 박과장(Claude)이 종합 편집

7. 결과 전송
   → 텔레그램 + 카카오톡 + 슬랙
```

### B. Meeting Broker (회의 시스템)

DeskRPG의 `meeting-broker.js`가 핵심입니다:

```
Listen → Raise Hand → Speak 모델:
1. 모든 에이전트에게 병렬 poll (SPEAK / PASS)
2. 손든 에이전트 중 하나를 선택하여 발언권 부여
3. 발언 내용을 스트리밍으로 전달
4. 전원 PASS가 연속하면 회의 자연 종료
5. 사용자는 아무 시점에나 개입 가능
```

### C. OpenClaw Gateway (에이전트 통신)

DeskRPG의 `openclaw-gateway.js`가 Hermes Agent와 WebSocket RPC로 통신합니다:
- Ed25519 키 기반 디바이스 인증
- 프로토콜 버전 3 (최신)
- 에이전트별 독립 세션 키

### D. 메시징 플랫폼 연동

| 플랫폼 | 어댑터 | 설정 |
|--------|--------|------|
| Telegram | `hermes-agent/gateway/platforms/telegram.py` | Bot Token |
| Slack | `hermes-agent/gateway/platforms/slack.py` | Bot + App Token |
| KakaoTalk | `openclaw-kakao/kmsg` | macOS + kmsg CLI |

---

## ⚙️ Hermes Agent 설정 (cli-config.yaml)

```yaml
# 핵심 설정 요약
model:
  provider: openai          # 기본 라우팅 (각 NPC별 오버라이드)
  model_id: gpt-4o

gateway:
  platforms:
    telegram:
      enabled: true
      bot_token: "${TELEGRAM_BOT_TOKEN}"
    slack:
      enabled: true
      bot_token: "${SLACK_BOT_TOKEN}"
      app_token: "${SLACK_APP_TOKEN}"

agents:
  - id: "kim-daeri"
    provider: openai
    model_id: gpt-4o
    persona_dir: "./agents/openai-agent"

  - id: "park-gwajang"
    provider: anthropic
    model_id: claude-sonnet-4-20250514
    persona_dir: "./agents/claude-agent"

  - id: "lee-juim"
    provider: google
    model_id: gemini-2.0-flash
    persona_dir: "./agents/gemini-agent"
```

---

## 🎮 DeskRPG에서 NPC가 움직이는 구조

DeskRPG는 **Phaser.js 기반 2D 픽셀 아트** 오피스입니다. 각 NPC는:

1. **LPC 스프라이트**: `office-presets.ts`에 정의된 외형 (머리, 옷, 신발 등)
2. **자동 이동**: GameScene.ts에서 NPC는 사무실을 돌아다님
3. **작업 상태 표시**: 머리 위에 말풍선으로 현재 작업 표시
4. **회의실 이동**: 회의 소집 시 NPC가 자동으로 회의실로 이동
5. **Socket.IO**: 실시간 위치/상태 동기화

### NPC 등록 구조 (office-presets.ts 참조)

```typescript
{
  id: "ai-gpt",
  nameKo: "김대리",
  role: "전략 기획",
  bodyType: "male",
  layers: {
    body: { itemKey: "body", variant: "light" },
    hair: { itemKey: "hair_messy1", variant: "black" },
    torso: { itemKey: "torso_clothes_tshirt", variant: "blue" },
    legs: { itemKey: "legs_pants", variant: "navy" },
    feet: { itemKey: "feet_shoes_basic", variant: "black" },
  },
  identity: "# 김대리 ..."
}
```

---

## 📱 텔레그램 명령어 체계

| 명령어 | 기능 |
|--------|------|
| `/task <내용>` | 전체 팀에 업무 지시 |
| `/assign <이름> <내용>` | 특정 직원에게 업무 할당 |
| `/meeting <주제>` | 3인 회의 소집 |
| `/report` | 현재 진행 상황 보고 요청 |
| `/status` | 각 직원 상태 확인 |
| `/debate <주제>` | 주제에 대해 토론 시작 |

---

## 🔧 VS Code / Antigravity에서 작업하기

### VS Code에서 열기

```bash
code ai-office-agents/
```

### Claude Code (Antigravity)에서 작업하기

1. **프로젝트 열기**: Antigravity에서 `ai-office-agents` 폴더 열기
2. **모델 라우팅**: 
   - Haiku → 단순 편집
   - Sonnet → 기능 구현
   - Opus → 아키텍처 설계
3. **순차 작업**: TASK.md의 체크리스트 순서대로 진행

### 추천 작업 순서

```
Phase 1: 기반 설치 (1~2시간)
  □ DeskRPG 클론 + SQLite 설치
  □ Hermes Agent 설치
  □ .env.local 설정
  □ 단독 실행 확인

Phase 2: NPC 등록 (30분)
  □ 3인 NPC 프리셋 추가 (npc-presets.ts)
  □ 페르소나 파일 배치 (IDENTITY/SOUL/AGENTS.md)
  □ DeskRPG 서버 재시작 후 NPC 확인

Phase 3: Gateway 연동 (1시간)
  □ Telegram Bot 생성 + 토큰 설정
  □ Hermes Gateway 시작
  □ 텔레그램→DeskRPG 메시지 흐름 테스트

Phase 4: 회의 시스템 (1시간)
  □ Meeting Broker 설정
  □ 3인 회의 테스트 (poll→speak→conclude)
  □ 회의록 생성 확인

Phase 5: 보고서 + 배포 (1시간)
  □ 보고서 포맷 템플릿 설정
  □ 슬랙/카톡 전송 테스트
  □ 자동 cron 스케줄 설정
```

---

## 🔐 보안 주의사항

1. API 키는 반드시 `.env.local`에만 저장 (git에 커밋 금지)
2. Telegram Bot은 허용 사용자 ID 화이트리스트 설정
3. DeskRPG 서버는 로컬 또는 VPN 내에서만 접근
4. 카카오톡 연동은 macOS Accessibility 권한 필요

---

## 📚 참고 레포

| 레포 | 역할 | URL |
|------|------|-----|
| DeskRPG | 2D 가상 오피스 + NPC 시스템 | `github.com/herwoojin/desk_rpg_model` |
| Hermes Agent | 멀티모델 에이전트 + 게이트웨이 | `github.com/herwoojin/hermes-agent` |
| OpenClaw-Kakao | 카카오톡 CLI 연동 | `github.com/herwoojin/openclaw-kakao` |
