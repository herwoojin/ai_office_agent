# 📱 텔레그램 봇 설정 가이드

> 스마트폰의 텔레그램 앱에서 메시지를 보내면 맥북의 AI Office Agents가 자동 처리.
> 5분이면 완료.

---

## 1단계 — BotFather 에서 봇 생성 (2분)

### 1) 텔레그램 앱에서 BotFather 찾기
- 텔레그램 검색에 **`@BotFather`** 입력
- "BotFather" 라는 공식 봇 (파란 체크) 선택 → **시작 / Start**

### 2) 봇 만들기
BotFather에게:
```
/newbot
```

질문에 답:
```
BotFather: Alright, a new bot. How are we going to call it?
당신: AI Office Agent          ← 표시 이름 (한글 OK)

BotFather: Good. Now let's choose a username for your bot.
당신: my_ai_office_bot         ← 영문 username (Bot 으로 끝나야 함, 영문/숫자/_ 만)
```

### 3) 토큰 받기
BotFather 가 마지막에 토큰을 줍니다:
```
Use this token to access the HTTP API:
<숫자10자리>:AAG<영문숫자35자> ← 텔레그램 봇 토큰 형식 (실제 값은 발급분)
```
→ **복사해두세요**. 이 토큰이 곧 내 봇의 비밀번호입니다.

---

## 2단계 — 내 텔레그램 user ID 확인 (1분)

봇이 아무한테나 응답하면 안 되니, 내 ID 를 화이트리스트로 등록해야 합니다.

### 1) UserInfoBot 사용
- 텔레그램 검색에 **`@userinfobot`** 입력 → 시작
- 봇이 보여주는 정보:
```
@userinfobot:
👤 Name: 우진
🆔 Id: 123456789       ← 이 숫자 복사
🌐 Lang: ko
```

`Id:` 옆 숫자가 내 텔레그램 user ID 입니다.

---

## 3단계 — 맥북에 토큰 입력 (1분)

`/Users/heoujin/ai-office-agents/.env.local` 파일을 열어 두 줄 입력:

```bash
TELEGRAM_BOT_TOKEN=<숫자10자리>:AAG<영문숫자35자> ← 텔레그램 봇 토큰 형식 (실제 값은 발급분)
TELEGRAM_ALLOWED_USERS=123456789
```

여러 명에게 허용하려면 콤마로:
```bash
TELEGRAM_ALLOWED_USERS=123456789,987654321,111222333
```

---

## 4단계 — 서버 재시작 (자동 반영)

```bash
# launchd 가 등록되어 있다면 한 줄로
launchctl unload ~/Library/LaunchAgents/com.ai-office-agents.server.plist
launchctl load -w ~/Library/LaunchAgents/com.ai-office-agents.server.plist

# 또는 수동
cd /Users/heoujin/ai-office-agents/desk_rpg_model
kill $(cat ../.pids/deskrpg.pid) 2>/dev/null
npm run dev > ../logs/deskrpg.log 2>&1 &
echo $! > ../.pids/deskrpg.pid
```

로그에서 확인:
```
[AI-Office] telegram poller 가동: 7654321...
```

이 줄이 보이면 성공.

---

## 5단계 — 첫 메시지 보내보기

내가 만든 봇과 채팅 열고 (BotFather가 알려준 봇 username 검색 → 시작):

```
/help
```

응답:
```
🏢 AI Office Bot — 명령어
/task <내용>     — 3명에게 업무 분배
/meeting <주제>  — 회의실 소집 + 실 LLM 토론 (~70s)
/research <주제> — 깊이 리서치 (~90s)
/report <주제>   — 보고서 작성 (~120s)
/status          — NPC 상태 조회
```

테스트:
```
/status
```
→ 김대리/박과장/이주임 위치 + 모드 응답.

```
/meeting 여름 신메뉴 전략
```
→ 1분 정도 기다리면 회의 종료 결과.

```
/report Q3 매출 분석 보고서
```
→ 2분 정도 기다리면 3명이 협업한 보고서가 텔레그램 메시지로 도착.

---

## 💡 자주 묻는 질문

**Q. 텔레그램에서 다른 사람도 내 봇을 사용할 수 있나?**

A. `TELEGRAM_ALLOWED_USERS` 에 등록된 user ID 만 응답합니다. 비워두면 누구나 사용 가능 (보안상 권장 안 함).

**Q. 봇이 응답을 안 해요.**

A. 다음 순서로 점검:
```bash
# 1) 서버 로그
tail -50 /Users/heoujin/ai-office-agents/logs/deskrpg.log | grep -i telegram

# 2) 토큰 유효성 확인
curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe
# 응답에 "ok":true 면 토큰 OK
```

**Q. 회의 결과가 너무 길어서 메시지 잘림.**

A. 텔레그램 메시지 한 번에 4096자 한도. 우리 시스템은 자동으로 잘라서 보내지만, 더 긴 보고서가 필요하면 `/report` 결과를 텔레그램 + 슬랙 동시 전송하도록 .env 에 `SLACK_BOT_TOKEN` 추가.

**Q. 그룹 채팅에서 봇 쓰기.**

A. BotFather → `/setjoingroups` → Enable. 그 다음 그룹에 봇 추가. 단 봇이 그룹의 모든 메시지를 보려면:
- BotFather → `/setprivacy` → **Disable** (그래야 / 명령어 외 자유 메시지도 처리)

**Q. 명령어 자동완성 만들기.**

A. BotFather → `/setcommands` 선택 → 봇 선택 → 다음 텍스트 붙여넣기:
```
task - 3명에게 업무 분배
meeting - 회의 소집 + LLM 토론
research - 깊이 리서치
report - 보고서 작성
status - NPC 상태 조회
help - 명령어 도움말
```

---

## 🔐 보안 팁

- **`.env.local` 은 git 에 절대 안 들어가게** (이미 gitignore 됨 ✓)
- **`TELEGRAM_ALLOWED_USERS` 필수** — 안 그러면 봇 username 만 알면 누구나 LLM 비용 발생시킬 수 있음
- 토큰 노출되면 BotFather → `/revoke` 로 즉시 무효화

---

## 🔗 다음

- [💬 슬랙도 설정하기](slack-setup.md)
- [🎮 디스코드도 설정하기](discord-setup.md)
- [🖥️ 맥북 24시간 운영](macos-always-on.md)
