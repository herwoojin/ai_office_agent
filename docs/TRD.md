# Technical Requirements Document (TRD) — AI Office Agents

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER (외부)                                 │
│   📱 Telegram / 💬 Slack / 🎮 Discord / 🌐 Browser                   │
└───────────────┬─────────────────────────────────┬───────────────────┘
                │ HTTPS/WSS                       │ HTTP localhost:3000
                ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  사용자 맥북 (24/7 가동, caffeinate -i)                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────┐         │
│  │  DeskRPG dev-server (Next.js + Socket.IO @ :3000)      │         │
│  │   ├─ /auth, /characters, /channels, /game, /setup      │         │
│  │   ├─ /settings/llm (모델 + 페르소나 + 모드 프롬프트)    │         │
│  │   ├─ /api/office/{task,meeting,research,report,...}    │         │
│  │   └─ Phaser scene (NPC 렌더링, 풍선, 좌표 동기)         │         │
│  └────────────────────┬───────────────────────────────────┘         │
│                       │ socket.io (in-process)                       │
│  ┌────────────────────▼───────────────────────────────────┐         │
│  │  server-patch.js (deskrpg-integration/)                 │         │
│  │   ├─ Wander loop (NPC 자율 산책, 1.2s tick)             │         │
│  │   ├─ HTTP trigger server :13000                         │         │
│  │   ├─ Telegram / Slack / Discord listeners               │         │
│  │   ├─ 4-mode orchestrator (task/meeting/research/report) │         │
│  │   └─ Firestore admin sync (옵션)                        │         │
│  └────────────────────┬───────────────────────────────────┘         │
│                       │ child_process.execFile(openclaw)             │
│  ┌────────────────────▼───────────────────────────────────┐         │
│  │  OpenClaw Gateway (WebSocket @ :18789, ed25519 auth)    │         │
│  │   ├─ Agent: kim-daeri    → openai/gpt-4o                │         │
│  │   ├─ Agent: park-gwajang → anthropic/claude-sonnet-4-5  │         │
│  │   └─ Agent: lee-juim     → google/gemini-2.5-flash      │         │
│  └────────────────────┬───────────────────────────────────┘         │
└────────────────────────┼─────────────────────────────────────────────┘
                         │ HTTPS
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OpenAI / Anthropic / Google API (자기 키)                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack

### Frontend
| Layer | Tech | 버전 |
|---|---|---|
| Framework | Next.js (App Router) | 15.x |
| UI Library | React | 18.x |
| Styling | Tailwind CSS | 4.x |
| 2D Engine | Phaser | 3.x |
| Auth Client | Firebase JS SDK | 11.x |
| Realtime | socket.io-client | 4.x |

### Backend (인-프로세스 with Next.js dev)
| Layer | Tech |
|---|---|
| Runtime | Node.js 20+ |
| Web Framework | Next.js custom server (dev-server.ts) |
| Realtime | socket.io |
| Database | SQLite (better-sqlite3) — dev / Postgres — prod 옵션 |
| ORM | Drizzle ORM |
| Auth | jose (HS256 JWT) + Firebase Admin (선택) |
| LLM Gateway | OpenClaw CLI (subprocess) |
| Trigger Server | Native http (:13000) |

### External Services
| Service | 용도 |
|---|---|
| Firebase Auth | Google 로그인 |
| Firebase Firestore | 페르소나/프롬프트 클라우드 저장 (선택) |
| Telegram Bot API | 메시지 폴링 |
| Slack Web API | 메시지 폴링 |
| Discord Gateway WS | 메시지 수신 |
| OpenAI API | GPT-4o / GPT-5.5 |
| Anthropic API | Claude Sonnet 4.5 / Opus 4.5 |
| Google AI Studio | Gemini 2.5 Flash / Pro |

---

## 3. Key Modules

### 3.1 dev-server.ts (커스텀 Next.js 서버)
```ts
- Next.js prepare()
- HTTP 서버 생성
- Socket.IO 인스턴스 부착
- src/server/socket-handlers.ts (TaskManager, channelGateways)
- server-patch.js import → setupAIOfficeAgents(io, ...)
```

### 3.2 server-patch.js (deskrpg-integration/)
```js
exports.setupAIOfficeAgents(io, db, schema, taskManager, channelGateways)
  ├─ startWanderLoop(ctx)         // NPC 자율 산책
  ├─ startOfficeTriggerServer(ctx) // :13000 HTTP API
  ├─ startTelegramPoller(ctx)     // longpoll getUpdates
  ├─ startSlackPoller(ctx)        // conversations.history polling
  ├─ startDiscordPoller(ctx)      // WSS Gateway
  └─ startFirestoreSync(ctx)      // firebase-admin onSnapshot
```

### 3.3 mode-prompts.js
```js
exports.getPrompt(agentId, mode, context)
  → base persona + mode-specific directive + context block
exports.sync(firestoreData)  // 클라우드 갱신 시 호출
exports.exportSeed()         // 첫 배포 시 Firestore 시드
```

### 3.4 openclaw-gateway.js (DeskRPG 내장)
```js
class OpenClawGateway
  - connect(url, token) → ed25519 challenge-response
  - agentsList(), agentsCreate(name, workspace, emoji)
  - agentsFileSet(agentId, name, content)  // IDENTITY.md 등
  - sendMessage(agentId, message)
```

---

## 4. Data Flow Examples

### A. /meeting 명령 흐름
```
1. User → Telegram "/meeting 여름 신메뉴"
2. server-patch handleIncomingMessage()
3. triggerMeeting(ctx, "여름 신메뉴")
   ├─ 3명 NPC 회의실 좌석 좌표로 이동 (npc:position-sync emit)
   ├─ meeting:start 이벤트 emit
   ├─ for each NPC (순차):
   │   ├─ getPrompt(agentId, "meeting", {topic})
   │   ├─ execFile("openclaw", ["agent", "--agent", id, "--message", prompt, "--json"])
   │   ├─ Parse JSON → finalAssistantRawText 추출
   │   └─ npc:speech 이벤트 → Phaser 풍선
   ├─ meeting:end 이벤트
   └─ 자기 자리 복귀
4. 텔레그램에 "회의 종료 — 참석: 김대리, 박과장, 이주임" 응답
```

### B. /settings/llm 에서 페르소나 수정
```
1. User → /settings/llm 3단계 → 김대리 → meeting 탭 → 프롬프트 수정 → 저장
2. PATCH /api/office/prompts {agentId, modes: {meeting: {systemPrompt}}}
3. Firestore admin → /npc-prompts/kim-daeri.modes.meeting 갱신
4. server-patch.js 의 onSnapshot 콜백 → mode-prompts.sync()
5. 다음 /meeting 호출부터 새 프롬프트 적용
```

---

## 5. Security

| 영역 | 제어 |
|---|---|
| 사용자 인증 | Firebase Google OAuth + JWT cookie (httpOnly, sameSite=lax, 7일) |
| 봇 ACL | TELEGRAM_ALLOWED_USERS, SLACK_REPORT_CHANNEL, DISCORD_CHANNEL_ID |
| 시크릿 보호 | .env.local gitignore + GitHub Push Protection + .env.example만 커밋 |
| Firebase 규칙 | firebase/firestore.rules — 본인 데이터만 R/W |
| OpenClaw 페어링 | ed25519 디바이스 키, /api/devices/approve 수동 승인 |
| LLM 키 | 평문 .env.local (서버 측만), 또는 OpenClaw auth profile (암호화) |
| 토큰 암호화 | gateway_resources.token_encrypted (AES-256-GCM, JWT_SECRET 유래) |
| CSP / COOP | Cross-Origin-Opener-Policy: same-origin-allow-popups (Firebase 팝업 호환) |

---

## 6. Performance

| 메트릭 | 목표 | 실측 |
|---|---|---|
| Wander tick interval | 1.2s | 1.2s |
| /task 응답 시간 | < 10s | 5s |
| /meeting 응답 시간 | < 90s | 60-80s |
| /research 응답 시간 | < 90s | 30-60s (병렬) |
| /report 응답 시간 | < 180s | 90-150s |
| OpenClaw `agent --json` 1회 호출 | < 30s | 20-30s |
| Idle 전력 | < 7W | 5W (M2) |
| 시작 시간 (.app 더블클릭 → ready) | < 30s | 20-25s |

---

## 7. Deployment Targets

| 타겟 | 상태 | 비고 |
|---|---|---|
| 로컬 (npm run dev) | ✅ 완전 동작 | 개발 + 사용자 운영 |
| macOS .app 번들 | ✅ 완전 동작 | 일반 사용자 |
| Render / Railway (Docker) | ⚠ 부분 (OpenClaw 별도) | 외부 사용자에게 서비스 시 |
| Netlify | ❌ 불가 | Socket.IO + 영구 프로세스 미지원 |
| Vercel | ❌ 불가 | 같은 이유 |

---

## 8. Constraints

- macOS 11 (Big Sur) 이상
- Node.js 20+
- OpenClaw 2026.5+ (Protocol 4 필요)
- 메모리 8GB+ 권장 (Next.js dev + Phaser + LLM 호출 시 일시 1GB)
- 디스크 10GB+ (node_modules 1GB + .next 빌드 1GB + 스프라이트 자산 200MB)
- 인터넷 연결 (LLM API 호출 시)
