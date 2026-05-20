#!/bin/bash
# =============================================================================
# AI Office Agents — macOS .app 본체 실행 스크립트
#
# 이 스크립트는 "AI Office 시작.app" 더블클릭 시 실행됩니다.
# AppleScript 팝업으로 사용자 인터랙션 + 백그라운드 가동.
# =============================================================================

set -e

PROJECT_ROOT="/Users/heoujin/ai-office-agents"
LOG="$PROJECT_ROOT/logs/deskrpg.log"
PID_FILE="$PROJECT_ROOT/.pids/deskrpg.pid"

mkdir -p "$PROJECT_ROOT/logs" "$PROJECT_ROOT/.pids"

# ─── 헬퍼 함수 ───

osa() {
  osascript -e "$1"
}

dialog() {
  local title="$1"
  local message="$2"
  local buttons="$3"     # 콤마로 구분된 버튼 이름 (예: "취소,시작")
  local default="$4"     # 기본 버튼 이름
  local icon="${5:-note}"  # note / caution / stop

  # AppleScript 문자열 escape (큰따옴표를 백슬래시로)
  message=$(echo "$message" | sed 's/"/\\"/g')
  title=$(echo "$title" | sed 's/"/\\"/g')

  # 버튼 배열 변환
  local btnList=""
  IFS=',' read -ra BTN_ARR <<< "$buttons"
  for b in "${BTN_ARR[@]}"; do
    btnList+="\"$b\","
  done
  btnList="${btnList%,}"

  osa "display dialog \"$message\" with title \"$title\" buttons {$btnList} default button \"$default\" with icon $icon"
}

# 사용자가 클릭한 버튼 이름만 추출
clicked() {
  echo "$1" | sed -E 's/.*button returned:([^,]*).*/\1/'
}

notify() {
  local title="$1"
  local message="$2"
  osascript -e "display notification \"$message\" with title \"$title\""
}

# 포트 가동 확인
port_up() {
  lsof -ti :$1 >/dev/null 2>&1
}

# OpenClaw 게이트웨이 살아있는지
openclaw_up() {
  port_up 18789
}

# DeskRPG 살아있는지
deskrpg_up() {
  port_up 3000
}

# ─── Step 1: 현재 상태 진단 ───

CURRENT_STATE="stopped"
if deskrpg_up && openclaw_up; then
  CURRENT_STATE="running"
elif deskrpg_up; then
  CURRENT_STATE="partial-deskrpg"
elif openclaw_up; then
  CURRENT_STATE="partial-openclaw"
fi

# ─── Step 2: 이미 가동 중이면 다른 메뉴 ───

if [ "$CURRENT_STATE" = "running" ]; then
  result=$(dialog "🟢 AI Office Agents — 가동 중" \
    "이미 실행 중입니다.

📡 DeskRPG:    http://localhost:3000
🛠 설정 허브:  http://localhost:3000/setup
📺 데모:       http://localhost:3000/demo
🤖 OpenClaw:   ws://127.0.0.1:18789

무엇을 하시겠어요?" \
    "닫기,로그 보기,브라우저 열기" "브라우저 열기" "note") || exit 0

  btn=$(clicked "$result")
  case "$btn" in
    "브라우저 열기")
      open "http://localhost:3000/setup"
      ;;
    "로그 보기")
      open -a "Console" "$LOG" || open "$LOG"
      ;;
  esac
  exit 0
fi

# ─── Step 3: 환영 화면 (정지 상태) ───

result=$(dialog "🏢 AI Office Agents 시작" \
"3명의 AI 직원(김대리 · 박과장 · 이주임)이 가상 사무실에서 \
일하고 회의하는 시스템을 시작합니다.

▎ 무엇이 켜지나요?
  • OpenClaw 게이트웨이 (포트 18789)
  • DeskRPG 서버 (포트 3000)
  • HTTP 트리거 (포트 13000)
  • 텔레그램/슬랙/디스코드 봇 (.env.local 에 토큰 입력된 경우)

▎ 처음이라면?
  설정값이 비어있어도 일단 가동됩니다.
  http://localhost:3000/setup 에서 단계별로 설정하세요.

지금 시작할까요?" \
"취소,시작" "시작" "note") || exit 0

btn=$(clicked "$result")
if [ "$btn" != "시작" ]; then exit 0; fi

# ─── Step 4: OpenClaw 게이트웨이 가동 ───

notify "AI Office Agents" "게이트웨이 시작 중..."

if ! openclaw_up; then
  if command -v openclaw >/dev/null 2>&1; then
    /usr/bin/caffeinate -i /opt/homebrew/bin/openclaw gateway > "$PROJECT_ROOT/logs/openclaw.log" 2>&1 &
    # 가동 대기 (최대 10초)
    for i in {1..10}; do
      if openclaw_up; then break; fi
      sleep 1
    done
  else
    dialog "⚠️ OpenClaw 미설치" \
"OpenClaw CLI 를 못 찾았습니다.

OpenClaw 없이도 DeskRPG 자체는 시작 가능하지만, \
LLM 응답이 동작하지 않습니다.

설치 후 다시 시도하거나, 우선 DeskRPG 만 시작할까요?" \
"취소,DeskRPG 만" "DeskRPG 만" "caution" >/dev/null || exit 0
  fi
fi

# ─── Step 5: DeskRPG dev-server 가동 ───

notify "AI Office Agents" "DeskRPG 서버 시작 중..."

cd "$PROJECT_ROOT/desk_rpg_model"

# 기존 좀비 프로세스 정리
[ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null
lsof -ti :3000 2>/dev/null | xargs kill 2>/dev/null
sleep 1

# caffeinate 로 wrap → sleep 방지 + 백그라운드 실행
/usr/bin/caffeinate -i /opt/homebrew/bin/npm run dev > "$LOG" 2>&1 &
DESKRPG_PID=$!
echo $DESKRPG_PID > "$PID_FILE"

# 준비될 때까지 대기 (최대 60초)
READY=0
for i in {1..30}; do
  if grep -q "office trigger server" "$LOG" 2>/dev/null; then
    READY=1
    break
  fi
  if ! kill -0 $DESKRPG_PID 2>/dev/null; then
    READY=-1  # 죽음
    break
  fi
  sleep 2
done

# ─── Step 6: 결과 팝업 ───

if [ $READY -eq 1 ]; then
  # 봇 상태 확인 (로그 라인 기반)
  TG="❌"; grep -q "telegram poller 가동" "$LOG" && TG="✅"
  SL="❌"; grep -q "slack 리스너 가동"     "$LOG" && SL="✅"
  DC="❌"; grep -q "discord 리스너 가동"   "$LOG" && DC="✅"

  result=$(dialog "✅ AI Office Agents 가동 완료" \
"모든 서비스가 정상 가동되었습니다!

📡 DeskRPG:        http://localhost:3000
🛠 설정 허브:      http://localhost:3000/setup
📺 데모 페이지:    http://localhost:3000/demo

🤖 메신저 봇:
  $TG  텔레그램
  $SL  슬랙
  $DC  디스코드

💡 봇이 ❌ 라면 .env.local 에 토큰을 추가하고 다시 시작하세요.
   설정 방법: 설정 허브 → 플랫폼 설정 가이드

지금 무엇을 하시겠어요?" \
"닫기,설정 허브 열기,오피스 입장" "설정 허브 열기" "note") || exit 0

  btn=$(clicked "$result")
  case "$btn" in
    "설정 허브 열기") open "http://localhost:3000/setup" ;;
    "오피스 입장")    open "http://localhost:3000/characters" ;;
  esac

elif [ $READY -eq -1 ]; then
  # 프로세스가 죽었음 → 로그 보여주기
  TAIL=$(tail -20 "$LOG" 2>/dev/null | sed 's/"/\\"/g')
  osa "display dialog \"❌ 시작 실패 — 서버 프로세스가 종료되었습니다.\n\n로그 마지막 20줄:\n$TAIL\" with title \"AI Office Agents\" buttons {\"로그 열기\", \"닫기\"} default button \"로그 열기\" with icon stop"
  # 어떤 버튼이든 로그 열기
  open -a "TextEdit" "$LOG"

else
  # 60초 안에 준비 못 함 — 그래도 가동 중일 수 있음
  dialog "⏳ 시작 대기 중" \
"서버가 60초 안에 'ready' 신호를 보내지 못했습니다.

아직 시작 중일 수 있으니 잠시 후 브라우저에서 \
http://localhost:3000 확인하세요.

로그: $LOG" \
"확인" "확인" "caution" >/dev/null
fi
