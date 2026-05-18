# 🏢 AI Office Agents — 사용 설명서

> 3명의 AI 직원이 가상 사무실을 돌아다니며 일하고 회의하는 디지털 트윈 데모.

## 한눈에 보기

```
브라우저(Phaser 맵)  ←socket.io→  DeskRPG :3000  ←─┐
                                                   │ WebSocket
텔레그램 ─→ DeskRPG dev-server(server-patch) ──→ OpenClaw :18789 ──→ OpenAI/Claude/Gemini
   │                            │
   └──→ HTTP :13000 ──→ trigger ┘
```

---

## 지금 작동하는 것 ✅

| 컴포넌트 | 상태 |
|---|---|
| DeskRPG (NPC가 사무실 돌아다님) | ✅ 가동 중 |
| 3명 NPC (김대리/박과장/이주임) | ✅ DB 등록 + 외형 + 위치 + OpenClaw agent |
| 게이트웨이 ↔ DeskRPG 연결 | ✅ pairing/protocol/token 모두 OK |
| 회의 오케스트레이션 + LLM 실제 호출 | ✅ 67초로 검증 완료 |
| 풍선 메시지 / 자리 이동 / 위치 동기화 | ✅ |
| HTTP 트리거 API (`:13000/office/*`) | ✅ |

## 사용자가 직접 해야 할 것 ⚙️

**3가지** 만 하면 됩니다.

### ① 3개 LLM API 키 발급 (15분)

| 모델 | 키 발급 페이지 | .env 변수명 |
|---|---|---|
| Claude (Anthropic) | https://console.anthropic.com/settings/keys | `ANTHROPIC_API_KEY` |
| OpenAI | https://platform.openai.com/api-keys | `OPENAI_API_KEY` |
| Gemini (Google AI) | https://aistudio.google.com/apikey | `GOOGLE_AI_API_KEY` |

`/Users/heoujin/ai-office-agents/.env.local` 파일을 열어서 placeholder를 실제 키로 교체:

```bash
# 예시 (실제 키로 바꾸세요)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxx
GOOGLE_AI_API_KEY=AIzaSyxxxxxxxxx
```

> 💡 OpenAI 는 이미 OAuth(`herhero78@gmail.com`)로 인증되어 있어서 키 없어도 김대리는 동작합니다. Claude와 Gemini는 API 키가 필수입니다.

---

### ② NPC별 모델 자동 매핑 (1분)

키를 채운 뒤:

```bash
bash /Users/heoujin/ai-office-agents/scripts/configure-llm-models.sh
```

이 스크립트가 자동으로:
- Anthropic / Google / OpenAI를 OpenClaw에 등록
- **김대리 → OpenAI GPT-4o**
- **박과장 → Claude Sonnet 4.5**
- **이주임 → Gemini 2.5 Flash**
- 라우팅 매핑까지 끝까지 처리

---

### ③ 텔레그램 봇 (선택, 5분)

텔레그램 명령어로 업무 지시하려면:

**a. 봇 생성**
1. 텔레그램에서 [@BotFather](https://t.me/BotFather) 검색 → `/newbot` 입력
2. 봇 이름·username 지정 → 받은 토큰 복사
   - 형식: `7654321098:AAGxxxxxxxxxxxxxx`

**b. 내 텔레그램 user ID 알아내기**
1. 텔레그램에서 [@userinfobot](https://t.me/userinfobot) 검색 → `/start`
2. 받은 ID (숫자) 복사

**c. .env.local 에 입력**
```bash
TELEGRAM_BOT_TOKEN=7654321098:AAGxxxxxxxxxxxxxx
TELEGRAM_ALLOWED_USERS=123456789
```

**d. 적용 — dev-server 재시작**
```bash
kill $(cat /Users/heoujin/ai-office-agents/.pids/deskrpg.pid)
cd /Users/heoujin/ai-office-agents/desk_rpg_model && npm run dev > ../logs/deskrpg.log 2>&1 &
echo $! > /Users/heoujin/ai-office-agents/.pids/deskrpg.pid
```

로그에 `[AI-Office] telegram poller 가동` 이 보이면 OK.

---

## 사용법

### 🟢 브라우저에서 보기

http://localhost:3000

1. 로그인 후 "AI Office" 채널 진입
2. 김대리/박과장/이주임이 사무실을 자유롭게 돌아다님
3. 가끔 작업 풍선 메시지 (`분석 중...`, `보고서 다듬는 중`, `재밌는 사례 발견!`)
4. NPC 클릭하면 채팅창 열림 (각자 다른 LLM이 응답)

### 🟢 텔레그램 (봇 설정 완료 시)

```
/task 편의점 신선식품 전략 보고서 만들어줘
/meeting 여름 시즌 음료 전략
/status
/help
```

NPC가 회의실로 이동 → 각자 LLM 의견 → 풍선으로 표시 → 자기 자리 복귀

### 🟢 HTTP API (텔레그램 없이 즉시)

```bash
# 업무 분배 (5초)
curl -X POST http://127.0.0.1:13000/office/task \
  -H 'Content-Type: application/json' \
  -d '{"task":"신메뉴 기획"}'

# 회의 (60~90초 — 실제 LLM 호출)
curl -X POST http://127.0.0.1:13000/office/meeting \
  -H 'Content-Type: application/json' \
  -d '{"topic":"여름 시즌 신상품 전략"}'

# 상태 조회
curl -X POST http://127.0.0.1:13000/office/status -d '{}'
```

---

## 자주 묻는 질문

**Q. 정말 텔레그램만 안 하면 되나요?**

→ ❌ 아닙니다. 사용자가 직접 해야 하는 게 **3가지** 있습니다:
1. **3개 API 키 발급** (Claude / OpenAI / Gemini) — 필수
2. **`configure-llm-models.sh` 실행** — 필수 (현재는 OpenAI 만 동작 중)
3. 텔레그램 봇 토큰 (선택)

지금은 모든 NPC가 같은 OpenAI 모델을 쓰고 있습니다. 사용자가 원한 "3개 다른 LLM" 동작은 ②번 완료 후입니다.

**Q. dev-server 가 죽었을 때?**
```bash
cd /Users/heoujin/ai-office-agents/desk_rpg_model && npm run dev > ../logs/deskrpg.log 2>&1 &
echo $! > /Users/heoujin/ai-office-agents/.pids/deskrpg.pid
```

**Q. NPC가 한 번에 안 보여요**

브라우저 콘솔에서 `token` 쿠키를 지우고 다시 로그인. 또는 시크릿 창으로 접속.

**Q. 회의가 너무 느려요**

LLM 한 번에 25~30초 × 3명 = 70~90초가 정상. `configure-llm-models.sh` 가 각자 다른 모델을 쓰게 만들면 병렬 처리 가능 (현재는 직렬).

---

## 핵심 파일 위치

| 무엇 | 어디 |
|---|---|
| 환경변수 | [.env.local](.env.local) |
| 채널 / NPC 부트스트랩 스크립트 | [scripts/bootstrap-office.js](scripts/bootstrap-office.js) |
| **LLM 모델 자동 매핑** | [scripts/configure-llm-models.sh](scripts/configure-llm-models.sh) |
| 디지털 트윈 + 회의 오케스트레이터 | [deskrpg-integration/server-patch.js](deskrpg-integration/server-patch.js) |
| Phaser 클라이언트 (말풍선 추가) | [desk_rpg_model/src/game/scenes/GameScene.ts](desk_rpg_model/src/game/scenes/GameScene.ts) |
| DeskRPG 채널 URL | http://localhost:3000/channels/30ceda56-9bf3-412e-b499-7958896a4e61 |

## 서버 상태 확인 / 종료

```bash
# 상태
lsof -ti :3000 :13000 :18789

# DeskRPG 종료
kill $(cat /Users/heoujin/ai-office-agents/.pids/deskrpg.pid)
```
