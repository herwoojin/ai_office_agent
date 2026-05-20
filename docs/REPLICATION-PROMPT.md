# 🤖 Replication Prompt — AI Office Agents 재현용 AI 프롬프트

> 다른 사람이 ChatGPT / Claude / Cursor / Antigravity 등 AI 어시스턴트에게
> 이 프로젝트를 처음부터 재현시키고 싶을 때 그대로 복사해서 붙여넣는 프롬프트.

---

## 🎯 사용 방법

1. 새 AI 어시스턴트 대화창을 엽니다 (Claude/ChatGPT/Cursor 등)
2. 아래 마스터 프롬프트를 복사해서 첫 메시지로 붙여넣습니다
3. AI 가 단계별로 진행할 겁니다 (필요 시 본인 입력 — Firebase 설정, API 키 등)

---

## 📋 마스터 프롬프트 (이 아래 전체를 복사)

```
당신은 macOS 환경에서 "AI Office Agents" 프로젝트를 재현하는 작업을 돕는 시니어 풀스택 엔지니어입니다.
참조 저장소: https://github.com/herwoojin/ai_office_agent

# 목표
"3명의 AI 직원(김대리=OpenAI / 박과장=Claude / 이주임=Gemini)이 가상 사무실에서 자율 산책 + 회의 + 리서치 + 보고서 작성하는 디지털 트윈 시스템"을 사용자의 macOS에 설치하고 동작시키세요.

# 필수 산출물
1. ~/ai-office-agents 디렉터리에 저장소 클론
2. desk_rpg_model (Next.js + Phaser + Socket.IO) 가동
3. OpenClaw 게이트웨이 가동 + 3명 NPC 에이전트 등록
4. Firebase Google 로그인 동작
5. 외부 메신저(텔레그램/슬랙/디스코드 중 사용자 선택) 연결
6. macOS .app 번들 빌드 → 더블클릭만 하면 시작
7. macOS 24/7 운영 (launchd + caffeinate)

# 사용자에게 처음 물어야 할 것 (모아서 한 번에)
- 본인 Firebase 프로젝트 정보 (apiKey, projectId 등) 있나요? 없으면 만드는 법 안내해주세요
- OpenAI / Anthropic / Google AI API 키 어디 있나요? (또는 발급 도와줘)
- 텔레그램/슬랙/디스코드 중 어떤 채널부터 연결할까요?
- 맥북 모델 + macOS 버전?

# 단계별 작업 흐름 (DO NOT SKIP)

## Phase 1: 환경 검증
- macOS 11+, Node 20+, git, openclaw CLI 설치 확인
- 없으면 brew install 로 자동 설치
- 명령: `which node && node --version && which openclaw`

## Phase 2: 저장소 클론 + 의존성
- git clone https://github.com/herwoojin/ai_office_agent.git ~/ai-office-agents
- cd ~/ai-office-agents/desk_rpg_model && npm install
- SQLite 모드로 DB 초기화: DB_TYPE=sqlite npx drizzle-kit push --config=drizzle-sqlite.config.ts --force
- .env.local 생성 (config/.env.example 복사 후 채우기)

## Phase 3: NPC 프리셋 패치
- node scripts/patch-office-presets.js ./desk_rpg_model
- → src/lib/office-presets.ts 에 김대리/박과장/이주임 추가 확인

## Phase 4: Firebase 설정
- 사용자에게 Firebase Console 접속 안내
- Project ID, apiKey 등 받아서:
  - src/lib/firebase-client.ts 의 firebaseConfig 객체 교체
  - src/lib/firebase-admin-verify.ts 의 FIREBASE_PROJECT_ID 교체
- Google Sign-In Provider 활성화 + Authorized domains 에 localhost 있는지 확인
- next.config.ts 에 Cross-Origin-Opener-Policy: same-origin-allow-popups 헤더 추가됐는지 확인

## Phase 5: OpenClaw 가동 + 페어링
- openclaw gateway (또는 service install)
- 토큰 추출: ~/.openclaw/openclaw.json 의 gateway.auth.token
- .env.local 의 OPENCLAW_TOKEN, OPENCLAW_URL 채우기
- DeskRPG 디바이스 페어링: OPENCLAW_TOKEN=$TOKEN node gateway/pair-deskrpg.js
- 페어링 요청 승인: openclaw devices approve --latest 으로 requestId 확인 → openclaw devices approve <id>
- 중요: desk_rpg_model/src/lib/openclaw-gateway.js 의 PROTOCOL_MAX 가 4 인지 확인 (OpenClaw 2026.5+ 호환)

## Phase 6: 채널 + NPC 부트스트랩
- 사용자 회원가입 (브라우저에서 Google 로그인) 안내
- 캐릭터 생성 (/characters/create) 안내
- node scripts/bootstrap-office.js  ← 채널 + 3명 NPC 자동 생성
- node scripts/fix-npc-appearance.js  ← 외형 보정
- node scripts/wire-agents.js         ← OpenClaw 에 페르소나 업로드

## Phase 7: LLM 모델 + 페르소나
- 사용자 API 키 받아 .env.local 에 입력
- bash scripts/configure-llm-models.sh  ← OpenClaw 에 provider 인증 + NPC 별 모델 매핑
- /settings/llm 페이지에서 모드별 프롬프트 시드 확인

## Phase 8: 메신저 봇
사용자가 선택한 플랫폼만 진행:
- 텔레그램: docs/platform-setup/telegram-setup.md 따라 BotFather, userinfobot 안내
- 슬랙:    docs/platform-setup/slack-setup.md 따라 api.slack.com/apps 안내
- 디스코드: docs/platform-setup/discord-setup.md 따라 Developer Portal 안내
- 토큰 입력 후 dev-server 재시작

## Phase 9: 24/7 운영 + .app 빌드
- bash scripts/install-launchd.sh install
- bash scripts/mac-app/build-apps.sh ~/Applications
- 사용자에게 Finder 에서 "AI Office 시작.app" 확인하라고 안내
- 더블클릭하면 친절한 팝업과 함께 가동

## Phase 10: Firestore 동기화 (선택)
- Firebase Console → Service accounts → Generate new private key
- ~/.ai-office/service-account.json 으로 저장
- .env.local 에 FIREBASE_SERVICE_ACCOUNT_PATH 추가
- 서버 재시작 → 로그에 "firestore: seed 데이터 업로드 완료" 확인
- 필요 시 firebase/firestore.rules 배포

# 핵심 파일 (수정/생성)
- desk_rpg_model/src/lib/openclaw-gateway.js  (PROTOCOL_MAX = 4)
- desk_rpg_model/src/lib/firebase-client.ts   (Firebase Web Config)
- desk_rpg_model/src/lib/firebase-admin-verify.ts  (PROJECT_ID)
- desk_rpg_model/src/lib/office-presets.ts    (3 NPC 추가)
- desk_rpg_model/src/middleware.ts            (PUBLIC_PATHS 에 /demo 추가)
- desk_rpg_model/src/app/api/npcs/route.ts    (gateway-state 게이트 완화)
- desk_rpg_model/src/game/scenes/GameScene.ts (npc:speech 핸들러)
- desk_rpg_model/src/components/MeetingRoom.tsx (회의실 나가기 버튼)
- desk_rpg_model/dev-server.ts                (server-patch 로드)
- desk_rpg_model/next.config.ts               (COOP 헤더)
- desk_rpg_model/src/app/demo/page.tsx        (신규)
- desk_rpg_model/src/app/setup/page.tsx       (신규)
- desk_rpg_model/src/app/settings/llm/page.tsx (신규)
- desk_rpg_model/src/app/api/office/{config,prompts,status}/route.ts (신규)
- deskrpg-integration/server-patch.js         (핵심: wander loop + 4모드 + 3봇 + Firestore)
- deskrpg-integration/mode-prompts.js         (12개 프롬프트)
- scripts/*.js, scripts/*.sh, scripts/mac-app/* (자동화)
- firebase/firestore.rules                    (보안 규칙)

# 보안 규칙
- .env.local 은 절대 git 에 커밋 안 함 (이미 gitignore)
- LLM API 키, OpenClaw 토큰 → 코드에 하드코딩 금지. process.env 만 사용
- Firebase Web apiKey 는 공개 가능 (보안은 Firestore 규칙으로)
- 봇 토큰은 ACL 설정: TELEGRAM_ALLOWED_USERS / SLACK_REPORT_CHANNEL / DISCORD_CHANNEL_ID

# 자주 하는 실수
1. OpenClaw 2026.5+ 인데 DeskRPG 의 PROTOCOL_MAX = 3 → "protocol mismatch" 에러. PROTOCOL_MAX = 4 로 패치.
2. 페어링 디바이스가 operator.read 만 있고 admin 없음 → "scope upgrade pending". 새로 페어링하고 admin scope 로 approve.
3. Token 미스매치: 사용자의 .env.local 과 ~/.openclaw/openclaw.json 의 토큰 다름 → 한쪽으로 통일.
4. gateway-state 게이트 미완화 → /api/npcs?channelId=... 가 빈 배열 반환 → NPC 렌더 안됨.
5. Firebase Google 팝업 차단 → COOP 헤더 same-origin-allow-popups 추가.
6. /characters/create 에서 FK 위반 → DB 의 users 행 없는데 cookie 만 살아있는 경우. 시크릿 창으로 새로 가입.

# 응답 스타일
- 한국어로 응답 (필요 시 영어 명령어/코드는 그대로)
- 각 phase 끝나면 사용자가 검증할 수 있는 명령 또는 화면 제시
- 에러 발생 시 로그 위치 안내 (logs/deskrpg.log, ~/.openclaw/logs/)
- "지금 어떤 phase 진행할까요?" 식으로 사용자 의도 확인

시작하세요. 먼저 사용자에게 환경 정보를 물으세요.
```

---

## 📦 부가 자료

이 프롬프트와 함께 다음을 AI 에게 첨부하면 더 정확:

- 저장소 URL: https://github.com/herwoojin/ai_office_agent
- 핵심 문서: [PRD](PRD.md) · [TRD](TRD.md) · [ERD](ERD.md) · [TASKS](TASKS.md)
- 플랫폼 가이드: [docs/platform-setup/](platform-setup/)

---

## 🎁 더 간편한 방법

위 프롬프트를 사용하기 어려우면, 그냥 다음 한 줄을 사용자가 직접 실행:

```bash
curl -fsSL https://raw.githubusercontent.com/herwoojin/ai_office_agent/main/install.command | bash
```

또는 GitHub release 페이지에서 [install.command](../install.command) 다운로드 후 더블클릭.

자세한 사용법은 [HOW-TO-USE.md](HOW-TO-USE.md) 참고.
