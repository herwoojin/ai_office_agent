# 🎮 디스코드 설정 가이드

> 디스코드 서버 / DM 에서 명령으로 AI Office Agents 조작.
> 5분 소요.

---

## 1단계 — Discord Developer Portal 에서 봇 생성 (3분)

### 1) 개발자 포털 접속
https://discord.com/developers/applications 접속 → 로그인

### 2) New Application 클릭
- **Name**: `AI Office Agent`
- 약관 동의 → **Create**

### 3) 봇 활성화
좌측 메뉴 → **Bot** → **Reset Token** 클릭 → **Yes, do it!**

→ 표시되는 토큰 복사:
```
<영문숫자>.<영문숫자>.<영문숫자> ← Discord 봇 토큰 형식 (실제 값은 발급분)
```

> ⚠️ 토큰은 한 번만 표시됩니다. 잃어버리면 Reset 해야 함.

### 4) 권한 설정 (중요)
같은 Bot 페이지에서 **Privileged Gateway Intents** 섹션:
- **MESSAGE CONTENT INTENT** → **ON**  ⭐ 필수
- **SERVER MEMBERS INTENT** → ON (선택)

→ **Save Changes**

---

## 2단계 — 봇을 서버에 초대 (1분)

### 1) OAuth2 URL Generator 사용
좌측 메뉴 → **OAuth2 → URL Generator**

**Scopes**:
- ✓ `bot`

**Bot Permissions** (필요한 것만):
- ✓ Read Messages / View Channels
- ✓ Send Messages
- ✓ Send Messages in Threads
- ✓ Read Message History

페이지 맨 아래에 생성된 URL 복사 (예시):
```
https://discord.com/api/oauth2/authorize?client_id=1234...&permissions=...&scope=bot
```

### 2) URL 을 브라우저로 열기
→ "Add to Server" 선택 → 본인 서버 선택 → 권한 확인 → **Authorize**.

---

## 3단계 — 채널 ID 찾기 (30초)

### 1) Discord 앱에서 개발자 모드 켜기
**User Settings → Advanced → Developer Mode** : ON

### 2) 봇을 사용할 채널 우클릭 → **Copy Channel ID**
```
1234567890123456789
```

---

## 4단계 — 맥북에 토큰 입력 (1분)

`/Users/heoujin/ai-office-agents/.env.local` 에 추가:

```bash
DISCORD_BOT_TOKEN=<영문숫자>.<영문숫자>.<영문숫자> ← Discord 봇 토큰 형식 (실제 값은 발급분)
DISCORD_CHANNEL_ID=1234567890123456789
```

> 채널 ID 비워두면 봇이 멤버인 모든 채널 메시지 수신 (보안상 비추).

---

## 5단계 — 서버 재시작 + 검증

```bash
launchctl unload ~/Library/LaunchAgents/com.ai-office-agents.server.plist 2>/dev/null
launchctl load -w ~/Library/LaunchAgents/com.ai-office-agents.server.plist 2>/dev/null \
  || (cd /Users/heoujin/ai-office-agents/desk_rpg_model \
      && kill $(cat ../.pids/deskrpg.pid) 2>/dev/null \
      && npm run dev > ../logs/deskrpg.log 2>&1 &)
```

로그에서:
```
[AI-Office] discord 리스너 가동 (channel=1234567890123456789)
```

이 줄이 보이면 성공.

---

## 6단계 — 첫 메시지

디스코드에서 봇이 있는 채널로 들어가 입력:

```
/help
```

봇 응답:
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
/research 2026 한국 편의점 PB 트렌드
```

90초 후 3명이 동시에 리서치한 결과가 디스코드 메시지로 옴.

---

## 💡 자주 묻는 질문

**Q. 봇이 채널에 있는데 메시지에 반응 안 함.**

가장 흔한 원인: **MESSAGE CONTENT INTENT 미활성화**. 1단계 → 4번 다시 확인.

```bash
# 로그 확인
tail -50 /Users/heoujin/ai-office-agents/logs/deskrpg.log | grep -i discord
```

만약 `discord ws closed: 4014` 같은 오류:
- "Disallowed intent(s)" 의미. Developer Portal 에서 intent 다시 확인.

**Q. /명령어 자동완성 만들기 (Slash Commands).**

A. Discord 의 정식 Slash Commands 는 별도 등록 절차 필요. 우리 봇은 **prefix 명령어** (메시지로 / 시작) 방식이라 자동완성은 없지만 즉시 동작합니다.

정식 Slash 등록하려면 Application Commands API 호출 + interaction webhook 필요 (복잡). 일반 메시지 방식 권장.

**Q. 봇 이름 / 아바타 변경.**

A. Developer Portal → 본인 앱 → **General Information** 에서 Name + Icon 변경. 봇 자체의 닉네임은 Discord 서버에서 봇 우클릭 → "Change Nickname".

**Q. 여러 서버에서 같은 봇 쓰기.**

A. OAuth2 URL 을 다른 서버 관리자에게 공유해서 초대하면 됨. 단 `DISCORD_CHANNEL_ID` 가 한 채널만 받게 제한했다면, 비워두거나 콤마 지원 추가 (`server-patch.js` 수정).

**Q. DM 에서 쓰기.**

A. 디스코드 봇은 DM 받으려면 별도 코드 필요. 현재 구현은 서버 채널 위주. DM 채널 ID 를 알면 동일하게 동작.
```bash
# DM 채널 만들기 (API):
curl -X POST -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"recipient_id":"YOUR_USER_ID"}' \
  https://discord.com/api/v10/users/@me/channels
```

**Q. 봇이 자꾸 끊겨요.**

A. Discord WS 는 정기 재연결이 정상입니다. 우리 코드는 자동 재연결 5초 대기. 자주 끊기면:
- 인터넷 안정성
- Discord rate limit (1초당 ~50 메시지 한도)

---

## 🔐 보안

- **MESSAGE CONTENT INTENT** 켜놓으면 봇이 멤버인 채널의 모든 메시지를 읽을 수 있음 — 신뢰하는 서버에만 초대
- 토큰은 `.env.local` 만 (git 제외 ✓)
- 토큰 유출 시 Developer Portal → Bot → **Reset Token**

---

## 🔗 다음

- [📱 텔레그램도 설정](telegram-setup.md)
- [💬 슬랙도 설정](slack-setup.md)
- [🖥️ 맥북 24시간 운영](macos-always-on.md)
