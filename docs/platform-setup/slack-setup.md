# 💬 슬랙 설정 가이드

> 슬랙 채널에서 `/task`, `/meeting` 같은 명령으로 맥북의 AI Office Agents 조작.
> 10분 소요.

---

## 1단계 — Slack App 만들기 (3분)

### 1) Slack API 콘솔 접속
https://api.slack.com/apps 접속 → 본인 계정 로그인

### 2) "Create New App" 클릭
- **From scratch** 선택
- **App Name**: `AI Office Agent`
- **Workspace**: 사용할 워크스페이스 선택
- **Create App** 클릭

---

## 2단계 — 봇 권한 설정 (3분)

### 1) OAuth & Permissions 페이지로 이동
좌측 메뉴 → **OAuth & Permissions**

### 2) Bot Token Scopes 추가
스크롤 내려서 **Scopes → Bot Token Scopes** 에서 **Add an OAuth Scope** 클릭하고 다음 5개 추가:

| Scope | 용도 |
|---|---|
| `chat:write` | 메시지 답장 |
| `channels:history` | 채널 메시지 읽기 (polling) |
| `groups:history` | 비공개 채널 메시지 읽기 |
| `im:history` | 1:1 DM 읽기 |
| `commands` | 슬래시 명령어 (선택) |

### 3) 워크스페이스에 설치
페이지 맨 위로 가서 **Install to Workspace** 버튼 클릭 → Allow.

### 4) 토큰 복사
설치 후 표시되는 **Bot User OAuth Token**:
```
xoxb-<숫자>-<숫자>-<영문숫자>   ← 형식 예시 (실제 값은 본인 발급분)
```
→ 복사해두기.

---

## 3단계 — 채널 만들고 봇 초대 (1분)

### 1) Slack 앱에서 채널 만들기
예: `#ai-office`

### 2) 봇 초대
채널에서:
```
/invite @AI Office Agent
```

### 3) 채널 ID 알기
- 슬랙 데스크탑에서 채널 클릭 → 채널 이름 클릭 → 맨 아래 **Channel ID** 표시:
  ```
  C0XXXXXXXXX
  ```
- 또는 채널을 브라우저로 열면 URL 에:
  ```
  https://app.slack.com/client/T123/C0XXXXXXXXX
                                     ^^^^^^^^^^ ← 이게 채널 ID
  ```

---

## 4단계 — 맥북에 토큰 + 채널 ID 입력 (1분)

`/Users/heoujin/ai-office-agents/.env.local` 에 추가:

```bash
SLACK_BOT_TOKEN=xoxb-<숫자>-<숫자>-<영문숫자>   ← 형식 예시 (실제 값은 본인 발급분)
SLACK_REPORT_CHANNEL=C0XXXXXXXXX
```

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
[AI-Office] slack 리스너 가동 (channels=C0XXXXXXXXX)
```

이 줄이 보이면 성공.

---

## 6단계 — 첫 메시지

슬랙 `#ai-office` 채널에서:
```
/help
```

봇이 thread 로 응답:
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
/meeting 신상품 마케팅 전략
```

1분 후 thread 에 회의 결과.

---

## (선택) 슬래시 명령어 등록

기본적으로 위 명령은 **단순 메시지로 인식**되어 동작합니다. 슬랙 네이티브 슬래시 명령으로 등록하면 자동완성이 됩니다.

> ⚠️ 슬래시 명령은 **HTTPS 콜백 URL** 필요. 맥북에서는 ngrok 등 터널이 필요합니다 (단순 메시지로 처리하는 게 더 간단함).

ngrok 사용 시:
```bash
# 1) ngrok 설치
brew install ngrok

# 2) DeskRPG 서버를 인터넷에 노출
ngrok http 3000
# → Forwarding: https://xxxxx-xxxx.ngrok-free.app -> http://localhost:3000
```

그 다음 Slack API → **Slash Commands → Create New Command**:
| 필드 | 값 |
|---|---|
| Command | `/task` |
| Request URL | `https://xxxxx-xxxx.ngrok-free.app/api/slack/command` |
| Short Description | `3명에게 업무 분배` |

> 💡 ngrok 무료 플랜은 URL 이 매번 바뀌니, 매번 갱신해야 합니다. 단순 채널 메시지 방식이 더 안정적.

---

## 💡 자주 묻는 질문

**Q. 메시지를 보내도 봇이 무반응.**

```bash
# 1) 로그 확인
tail -50 /Users/heoujin/ai-office-agents/logs/deskrpg.log | grep -i slack

# 2) 토큰 검증
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" https://slack.com/api/auth.test
# 응답에 "ok": true 면 OK
```

흔한 원인:
- 채널에 봇 미초대 → `/invite @AI Office Agent`
- `channels:history` 권한 누락 → Scope 다시 추가 후 재설치
- `SLACK_REPORT_CHANNEL` 채널 ID 가 틀림 (이름 말고 ID)

**Q. 봇이 자기 메시지를 또 처리해서 무한 루프.**

A. 우리 코드는 `if (m.bot_id) continue;` 로 봇 메시지 무시합니다. 별도 처리 불필요.

**Q. 워크스페이스의 다른 채널에서도 쓰고 싶다.**

A. 현재 구현은 한 채널만 polling. 여러 채널 지원하려면 `SLACK_REPORT_CHANNEL=C111,C222,C333` 형식으로 콤마 지원 추가 필요 (`server-patch.js` 의 `startSlackPoller` 함수 수정).

**Q. Polling 5초 간격이 부담.**

A. `pollSlack` 의 `setInterval(pollSlack, 5000)` 을 늘리거나, Socket Mode (WebSocket) 로 전환 가능 — 이 경우 `SLACK_APP_TOKEN` (xapp-...) 도 필요.

**Q. DM 으로 봇한테 직접 보내고 싶다.**

A. 슬랙에서 봇 프로필 → "Message" → 1:1 채팅. 단 코드에서 채널 ID 가 DM 채널이 되므로, `.env.local` 에 DM 채널 ID 를 입력해야 함:
```bash
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  "https://slack.com/api/conversations.open?users=U_MY_USER_ID"
# 응답의 channel.id 가 DM 채널 ID
```

---

## 🔐 보안

- 토큰은 `.env.local` 에만 (git 제외 ✓)
- 봇이 추가된 채널이 공개라면, 누구든 봇 명령 사용 가능 — **비공개 채널** 권장
- 토큰 유출 시 Slack API → Manage Apps → 본인 앱 → **Reinstall** 또는 **Revoke**

---

## 🔗 다음

- [📱 텔레그램도 설정](telegram-setup.md)
- [🎮 디스코드도 설정](discord-setup.md)
- [🖥️ 맥북 24시간 운영](macos-always-on.md)
