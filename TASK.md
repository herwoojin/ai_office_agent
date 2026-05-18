# TASK.md — AI Office Agents 구현 체크리스트

> Claude Code / Antigravity에서 순차적으로 진행할 태스크 목록.
> 각 단계를 순서대로 실행하세요.

---

## Phase 1: 기반 설치 ⬜

- [ ] 1.1 DeskRPG 클론 및 설치
  ```bash
  git clone https://github.com/herwoojin/desk_rpg_model.git
  cd desk_rpg_model && npm install && npm run setup:lite
  ```

- [ ] 1.2 Hermes Agent 설치
  ```bash
  curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
  ```

- [ ] 1.3 `.env.local` 생성 및 API 키 입력
  ```bash
  cp config/.env.example .env.local
  # OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY 입력
  ```

- [ ] 1.4 DeskRPG 단독 실행 확인
  ```bash
  cd desk_rpg_model && npm run dev
  # http://localhost:3000 접속 확인
  ```

---

## Phase 2: 3인 NPC 등록 ⬜

- [ ] 2.1 NPC 프리셋 패치 적용
  ```bash
  node scripts/patch-office-presets.js ./desk_rpg_model
  ```

- [ ] 2.2 DeskRPG 서버 재시작 후 NPC 확인
  - 브라우저에서 오피스에 입장
  - 김대리, 박과장, 이주임 NPC가 보이는지 확인

- [ ] 2.3 NPC 대화 테스트
  - NPC 클릭하여 채팅 가능 확인
  - OpenClaw 연결 상태 확인

---

## Phase 3: Hermes Gateway 연동 ⬜

- [ ] 3.1 Telegram Bot 생성
  - @BotFather에서 새 봇 생성
  - 토큰을 `.env.local`의 `TELEGRAM_BOT_TOKEN`에 입력
  - `TELEGRAM_ALLOWED_USERS`에 자신의 user ID 입력

- [ ] 3.2 Hermes Agent 설정 배포
  ```bash
  cp config/cli-config.yaml ~/.hermes/cli-config.yaml
  mkdir -p ~/.hermes/agents
  cp -r agents/* ~/.hermes/agents/
  ```

- [ ] 3.3 Gateway 훅 설치
  ```bash
  cp gateway/ai_office_hook.py hermes-agent/gateway/builtin_hooks/
  ```

- [ ] 3.4 Hermes Gateway 시작
  ```bash
  hermes gateway
  ```

- [ ] 3.5 텔레그램 → DeskRPG 메시지 테스트
  - 텔레그램에서 `/status` 전송
  - 응답이 오는지 확인

---

## Phase 4: 회의 시스템 ⬜

- [ ] 4.1 서버 패치 적용
  ```bash
  # desk_rpg_model/server.js 에 server-patch.js 통합
  # server.js의 main 함수 마지막에 추가:
  # const { setupAIOfficeAgents } = require("../ai-office-agents/deskrpg-integration/server-patch.js");
  # setupAIOfficeAgents(io, db, schema, taskManager, channelGateways);
  ```

- [ ] 4.2 텔레그램에서 업무 지시 테스트
  ```
  /task 편의점 2026 하반기 신선식품 전략 보고서 만들어줘
  ```
  - 3명에게 분배되는지 확인
  - DeskRPG에서 NPC 작업 상태 확인

- [ ] 4.3 회의 소집 테스트
  ```
  /meeting 신선식품 카테고리 확대 전략
  ```
  - NPC가 회의실로 이동하는지 확인
  - 토론이 진행되는지 확인

- [ ] 4.4 회의록 생성 확인
  - 회의 종료 후 transcript가 저장되는지 확인

---

## Phase 5: 보고서 + 멀티 플랫폼 전송 ⬜

- [ ] 5.1 보고서 파이프라인 통합
  - report-pipeline.ts를 DeskRPG에 연결
  - meeting:end 이벤트 후 자동 보고서 생성

- [ ] 5.2 텔레그램 전송 테스트
  - 회의 종료 후 보고서가 텔레그램으로 오는지 확인

- [ ] 5.3 슬랙 전송 테스트
  - Slack App 생성 + 토큰 설정
  - 보고서가 슬랙 채널로 전송되는지 확인

- [ ] 5.4 카카오톡 전송 테스트 (macOS 전용)
  ```bash
  # kmsg CLI 설치
  mkdir -p ~/.local/bin
  curl -fL https://github.com/channprj/kmsg/releases/latest/download/kmsg-macos-universal \
    -o ~/.local/bin/kmsg && chmod +x ~/.local/bin/kmsg
  
  # 테스트
  kmsg send "테스트방" "보고서 테스트"
  ```

---

## Phase 6: 자동화 + 고도화 ⬜

- [ ] 6.1 Cron 스케줄 설정
  - 매일 09:00 일일 보고
  - 매주 금요일 17:00 주간 보고

- [ ] 6.2 자연어 업무 지시 개선
  - LLM 기반 태스크 분류기 구현
  - 키워드 매칭 → AI 분류로 업그레이드

- [ ] 6.3 회의 품질 개선
  - 회의 결론 자동 추출 (Claude 활용)
  - 후속 태스크 자동 생성

- [ ] 6.4 Docker 배포
  ```bash
  docker-compose up -d
  ```

---

## 모델 라우팅 가이드 (Claude Code)

| 태스크 유형 | 추천 모델 | 이유 |
|------------|----------|------|
| 설정 파일 편집 | Haiku | 단순 텍스트 수정 |
| 통합 코드 구현 | Sonnet | 기능 구현 |
| 아키텍처 변경 | Opus | 복잡한 설계 판단 |
