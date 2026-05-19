# 🖥️ macOS — 노트북 항상 켜두기 (sleep 모드에서도 동작)

> 목표: 맥북 뚜껑을 닫고 가방에 넣어도 텔레그램/슬랙/디스코드 메시지를 받고 처리.
> 최소 전력으로 24시간 가동.

---

## 핵심 원리

| 상태 | 설명 | 전력 |
|---|---|---|
| **활성** | 화면 켜짐 + CPU 풀파워 | 25–60W |
| **idle** | 화면 꺼짐 + CPU 절전 | 3–7W ⭐ 우리 목표 |
| **sleep** | 메모리만 유지, 네트워크 OFF | 0.5W (메시지 못 받음) |
| **off** | 완전 종료 | 0W |

우리는 **idle 상태** 를 유지합니다 — 화면은 꺼지지만 CPU/네트워크는 깨어 있어서 메시지를 받을 수 있어요.

---

## 1단계 — System Settings 변경

### 1) Battery (전원) 설정
**System Settings → Battery → Options (옵션...)** 클릭:

| 옵션 | 값 |
|---|---|
| Prevent automatic sleeping on power adapter when the display is off | **✓ 체크** |
| Enable Power Nap | **✓ 체크** |
| Wake for network access | **Always** (또는 "Only on power adapter") |

> 💡 노트북 충전기 꽂혀 있을 때 sleep 안 들어가게 하는 게 핵심.

### 2) Lock Screen 설정
**System Settings → Lock Screen**:

| 옵션 | 값 |
|---|---|
| Turn display off when inactive | **3분** (또는 더 짧게, 화면만 꺼짐) |
| Require password ... | 본인 보안 정책대로 (CPU 동작과 무관) |

### 3) 뚜껑 닫고도 동작하게 하기
**기본 macOS**는 뚜껑 닫으면 sleep 입니다. 두 가지 방법:

**방법 A — 외부 모니터/키보드 + 충전기 연결** (가장 안전):
- 충전기 + USB-C/HDMI 모니터 + 외부 키보드 → 뚜껑 닫아도 동작.
- 이를 "Clamshell mode" 라고 합니다.

**방법 B — 뚜껑 닫아도 sleep 안 하기 (외부 장치 없이)**:
- 기본 macOS 설정으로는 불가능 (Apple 정책).
- **`amphetamine`** 또는 **`InsomniaX`** 같은 무료 앱 사용:
  ```bash
  brew install --cask amphetamine
  ```
  - Amphetamine 실행 후 "Allow system to sleep when display is closed" **OFF**.
- 또는 `pmset` 으로 강제:
  ```bash
  sudo pmset -b sleep 0      # 배터리 모드에서도 sleep=0
  sudo pmset -c sleep 0      # 충전기 연결 시 sleep=0
  sudo pmset -b disablesleep 1  # 뚜껑 닫아도 동작
  ```

---

## 2단계 — 자동 시작 launchd 등록

부팅/로그인 시 자동으로 DeskRPG + OpenClaw 가동:

```bash
cd /Users/heoujin/ai-office-agents
bash scripts/install-launchd.sh install
```

설치되는 것들:
- `~/Library/LaunchAgents/com.ai-office-agents.server.plist` — launchd 데몬 정의
- `scripts/run-always-on.sh` — `caffeinate -i npm run dev` 래퍼
- 충돌 시 10초 후 자동 재시작 (`KeepAlive` + `ThrottleInterval`)
- 백그라운드 우선순위 (`ProcessType: Background`, `LowPriorityIO`, `Nice: 5`) — 다른 작업 방해 최소화

**상태 확인**:
```bash
bash scripts/install-launchd.sh status
```

출력 예시:
```
=== launchd 상태 ===
540    0    com.ai-office-agents.server
=== 프로세스 ===
49630 npm run dev
=== 포트 ===
  ✓ :3000 (pid 49645)
  ✓ :13000 (pid 49645)
  ✓ :18789 (pid 1809)
```

**중지 (다시 로그인 시 재시작)**:
```bash
bash scripts/install-launchd.sh stop
```

**완전 제거**:
```bash
bash scripts/install-launchd.sh uninstall
```

---

## 3단계 — OpenClaw 게이트웨이도 자동 시작

OpenClaw 도 launchd 로 등록해서 항상 켜두기:

```bash
mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/com.openclaw.gateway.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.openclaw.gateway</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/caffeinate</string>
        <string>-i</string>
        <string>/opt/homebrew/bin/openclaw</string>
        <string>gateway</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/heoujin/.openclaw/logs/gateway.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/heoujin/.openclaw/logs/gateway-err.log</string>
</dict>
</plist>
EOF
launchctl load -w ~/Library/LaunchAgents/com.openclaw.gateway.plist
echo "✅ OpenClaw 게이트웨이 자동 시작 등록"
```

---

## 4단계 — 검증

```bash
# 1) 맥 재부팅 후 로그인 → 1~2분 기다림
# 2) 포트 확인
lsof -ti :3000 :13000 :18789

# 3) 텔레그램 봇에 /status 보내고 응답 확인
```

## ⚡ 전력 모니터링

```bash
# 현재 상태 확인
pmset -g

# 1시간 동안 sleep 안 했는지 검증
pmset -g log | grep "Idle Sleep" | tail -5

# 실시간 모니터링
sudo powermetrics --samplers smc -i1000 -n5 | grep -E "Power|temp"
```

평균 전력:
- 대기 (메시지 없음): **3~5W** (M1/M2 기준)
- 회의 진행 (LLM 호출 중): **15~25W** 일시적
- 24시간 평균: **~5W = 하루 0.12 kWh ≈ 한 달 25원 전기료**

---

## 🚨 트러블슈팅

### "launchctl: ... service is disabled"
```bash
launchctl enable user/$(id -u)/com.ai-office-agents.server
launchctl load -w ~/Library/LaunchAgents/com.ai-office-agents.server.plist
```

### 부팅 후 npm 명령을 못 찾는 경우
plist 의 `EnvironmentVariables → PATH` 에 본인 node 경로 추가:
```bash
which node      # → /opt/homebrew/bin/node
which npm       # → /opt/homebrew/bin/npm
```
이미 install-launchd.sh 가 `/opt/homebrew/bin` 포함했지만, nvm 사용 중이면 직접 수정 필요.

### "Cannot use lsof on :3000" — 자동 시작이 동작 안 함
```bash
# 로그 확인
tail -50 /Users/heoujin/ai-office-agents/logs/launchd-stderr.log
```

### 맥 부팅 자체를 자동으로 (예: 매일 새벽 4시)
```bash
sudo pmset repeat poweron MTWRFSU 04:00:00   # 매일 04:00 자동 부팅
sudo pmset -g sched                          # 스케줄 확인
sudo pmset repeat cancel                     # 취소
```

---

## 🔗 다음 단계

이제 맥북이 항상 동작하니, 외부에서 메시지로 명령을 보내야겠죠:

- [📱 텔레그램 설정 가이드](telegram-setup.md)
- [💬 슬랙 설정 가이드](slack-setup.md)
- [🎮 디스코드 설정 가이드](discord-setup.md)
