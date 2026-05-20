# Task Breakdown — AI Office Agents

> 프로젝트를 0부터 재현하는 마일스톤 단위 작업 목록.
> 각 작업은 자동화 가능한 명령 또는 코드 포인터 포함.

---

## Phase 0 — 환경 준비

| # | 작업 | 명령 / 산출물 |
|---|---|---|
| 0.1 | macOS Big Sur+ 확인 | `sw_vers` |
| 0.2 | Homebrew 설치 | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| 0.3 | Node 20 + git 설치 | `brew install node@20 git` |
| 0.4 | OpenClaw 설치 | `brew install openclaw` (또는 npm 글로벌) |
| 0.5 | 저장소 클론 | `git clone https://github.com/herwoojin/ai_office_agent.git ~/ai-office-agents` |

✅ **자동화**: [install.command](../install.command) 더블클릭으로 0.1~0.5 모두 자동.

---

## Phase 1 — DeskRPG 부트스트랩

| # | 작업 | 명령 / 산출물 |
|---|---|---|
| 1.1 | desk_rpg_model 클론 | 이미 저장소에 포함됨 (또는 별도 clone) |
| 1.2 | 의존성 설치 | `cd desk_rpg_model && npm install` |
| 1.3 | SQLite 모드 .env.local | `DB_TYPE=sqlite`, `SQLITE_PATH=data/deskrpg.db` |
| 1.4 | DB 스키마 마이그 | `DB_TYPE=sqlite npx drizzle-kit push --config=drizzle-sqlite.config.ts --force` |
| 1.5 | NPC 프리셋 패치 | `node scripts/patch-office-presets.js ./desk_rpg_model` |
| 1.6 | 첫 실행 | `npm run dev` → http://localhost:3000 |

---

## Phase 2 — Firebase 인증

| # | 작업 | 산출물 |
|---|---|---|
| 2.1 | Firebase 프로젝트 생성 | https://console.firebase.google.com |
| 2.2 | Web 앱 등록 + Web SDK 설정 복사 | apiKey, authDomain, projectId, ... |
| 2.3 | Google Sign-In Provider 활성화 | Authentication → Sign-in method → Google |
| 2.4 | Authorized domains 에 `localhost` 추가 | (기본 포함) |
| 2.5 | `src/lib/firebase-client.ts` 의 firebaseConfig 교체 | 클라이언트 측 |
| 2.6 | `src/lib/firebase-admin-verify.ts` PROJECT_ID 교체 | 서버 측 |
| 2.7 | COOP 헤더 설정 | `next.config.ts` → `same-origin-allow-popups` |

---

## Phase 3 — OpenClaw 게이트웨이

| # | 작업 | 명령 |
|---|---|---|
| 3.1 | 게이트웨이 가동 | `openclaw gateway` |
| 3.2 | 토큰 확인 | `cat ~/.openclaw/openclaw.json \| grep token` |
| 3.3 | DeskRPG 디바이스 페어링 | `OPENCLAW_TOKEN=... node gateway/pair-deskrpg.js` |
| 3.4 | 페어링 승인 | `openclaw devices approve --latest` 후 `approve <requestId>` |
| 3.5 | Protocol 4 패치 확인 | `openclaw-gateway.js` 의 `PROTOCOL_MAX = 4` |

---

## Phase 4 — 3명 NPC + 에이전트 등록

| # | 작업 | 산출물 |
|---|---|---|
| 4.1 | 사용자 회원가입 (Google 로그인) | `/auth` 페이지 |
| 4.2 | 캐릭터 생성 | `/characters/create` |
| 4.3 | 채널 부트스트랩 (자동) | `node scripts/bootstrap-office.js` |
| 4.4 | NPC 외형 보정 | `node scripts/fix-npc-appearance.js` |
| 4.5 | OpenClaw 에이전트 등록 + 페르소나 업로드 | `node scripts/wire-agents.js` |
| 4.6 | `/api/npcs` 의 gateway-state 게이트 완화 | 우리 패치 적용됨 |

---

## Phase 5 — LLM 키 + 모델 매핑

| # | 작업 | 산출물 |
|---|---|---|
| 5.1 | OpenAI / Anthropic / Google 키 발급 | console / dashboard |
| 5.2 | `.env.local` 에 키 입력 | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY` |
| 5.3 | OpenClaw 에 provider 등록 | `bash scripts/configure-llm-models.sh` 또는 UI |
| 5.4 | NPC × Model 매핑 | `/settings/llm` 2단계 |
| 5.5 | 모드별 프롬프트 시드 | `/settings/llm` 3단계 (자동 seed) |

---

## Phase 6 — 외부 메신저 봇

각 플랫폼별 5~10분.

| # | 플랫폼 | 가이드 |
|---|---|---|
| 6.1 | 텔레그램 | [telegram-setup.md](platform-setup/telegram-setup.md) |
| 6.2 | 슬랙 | [slack-setup.md](platform-setup/slack-setup.md) |
| 6.3 | 디스코드 | [discord-setup.md](platform-setup/discord-setup.md) |

---

## Phase 7 — 24/7 운영

| # | 작업 | 명령 |
|---|---|---|
| 7.1 | System Settings 변경 | macos-always-on.md 1단계 |
| 7.2 | launchd 자동 시작 | `bash scripts/install-launchd.sh install` |
| 7.3 | OpenClaw 자동 시작 plist | macos-always-on.md 3단계 |
| 7.4 | macOS .app 번들 | `bash scripts/mac-app/build-apps.sh` |

---

## Phase 8 — Firestore 동기화 (선택)

| # | 작업 | 산출물 |
|---|---|---|
| 8.1 | Firebase 서비스 계정 키 다운로드 | Console → Service accounts |
| 8.2 | JSON 파일 보관 | `~/.ai-office/service-account.json` |
| 8.3 | `.env.local` 에 경로 | `FIREBASE_SERVICE_ACCOUNT_PATH=...` |
| 8.4 | Firestore 보안 규칙 배포 | `cd firebase && firebase deploy --only firestore:rules` |
| 8.5 | 서버 재시작 → seed | 자동 |

---

## Phase 9 — 검증 & 배포

| # | 작업 | 확인 방법 |
|---|---|---|
| 9.1 | 포트 헬스 체크 | `lsof -ti :3000 :13000 :18789` |
| 9.2 | `/api/office/status` | curl 응답 확인 |
| 9.3 | 텔레그램 /status | 봇 응답 시간 < 5s |
| 9.4 | /meeting 실행 | 60~90초 후 텍스트 도착 |
| 9.5 | 24시간 가동 테스트 | `pmset -g log` sleep 횟수 0 |
| 9.6 | install.command 외부 테스트 | 깨끗한 맥에서 다운로드 → 더블클릭 |

---

## ⏱ 예상 소요 시간

| Phase | 자동 (install.command) | 수동 |
|---|---|---|
| 0-1 | 10분 | 30분 |
| 2 | 5분 (콘솔 작업) | 5분 |
| 3 | 자동 | 10분 |
| 4 | 자동 | 5분 |
| 5 | 5분 (키 입력) | 10분 |
| 6 | 5분/플랫폼 | 5-10분 |
| 7 | 자동 | 10분 |
| 8 | 5분 | 10분 |
| 9 | 5분 | 30분 |
| **합계** | **약 35분** | **2시간** |

---

## 🎯 마일스톤

- M1 — DeskRPG + 3 NPC 시각적으로 산책 (Phase 1-4)
- M2 — LLM 응답으로 회의 동작 (Phase 5)
- M3 — 외부 메신저 명령 → 결과 (Phase 6)
- M4 — 맥북 닫고도 동작 (Phase 7)
- M5 — 클라우드 동기화 + 멀티 디바이스 (Phase 8)
- M6 — 다른 사람도 install.command 한 번에 (Phase 9)

현재 모든 마일스톤 ✅ 완료.
