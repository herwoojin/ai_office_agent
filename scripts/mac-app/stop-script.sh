#!/bin/bash
# =============================================================================
# AI Office 중지.app — 본체 스크립트
# =============================================================================

find_project_root() {
  if [ -n "$AI_OFFICE_HOME" ] && [ -d "$AI_OFFICE_HOME/desk_rpg_model" ]; then
    echo "$AI_OFFICE_HOME"; return
  fi
  for cand in "$HOME/ai-office-agents" "$HOME/Documents/ai-office-agents" "/Applications/AI-Office-Agents"; do
    if [ -d "$cand/desk_rpg_model" ]; then echo "$cand"; return; fi
  done
}
PROJECT_ROOT="$(find_project_root)"
PID_FILE="$PROJECT_ROOT/.pids/deskrpg.pid"

dialog() {
  local title="$1" message="$2" buttons="$3" default="$4" icon="${5:-caution}"
  message=$(echo "$message" | sed 's/"/\\"/g')
  local btnList=""
  IFS=',' read -ra BTN_ARR <<< "$buttons"
  for b in "${BTN_ARR[@]}"; do btnList+="\"$b\","; done
  btnList="${btnList%,}"
  osascript -e "display dialog \"$message\" with title \"$title\" buttons {$btnList} default button \"$default\" with icon $icon"
}

DESKRPG_UP=0
TRIGGER_UP=0
OPENCLAW_UP=0
lsof -ti :3000 >/dev/null 2>&1 && DESKRPG_UP=1
lsof -ti :13000 >/dev/null 2>&1 && TRIGGER_UP=1
lsof -ti :18789 >/dev/null 2>&1 && OPENCLAW_UP=1

if [ $DESKRPG_UP -eq 0 ] && [ $OPENCLAW_UP -eq 0 ]; then
  dialog "🟢 이미 중지됨" "AI Office Agents 가 이미 실행되고 있지 않습니다." "확인" "확인" "note" >/dev/null
  exit 0
fi

result=$(dialog "🛑 AI Office Agents 중지" \
"현재 가동 중인 서비스:

📡 DeskRPG (port 3000):  $([ $DESKRPG_UP -eq 1 ] && echo ✓ 가동 중 || echo ✗ 정지)
🛠 HTTP Trigger (13000): $([ $TRIGGER_UP -eq 1 ] && echo ✓ 가동 중 || echo ✗ 정지)
🤖 OpenClaw (18789):     $([ $OPENCLAW_UP -eq 1 ] && echo ✓ 가동 중 || echo ✗ 정지)

OpenClaw 게이트웨이는 다른 작업에 영향을 줄 수 있어 별도 선택 가능합니다.

무엇을 중지하시겠어요?" \
"취소,DeskRPG 만,전체 중지" "DeskRPG 만" "caution") || exit 0

btn=$(echo "$result" | sed -E 's/.*button returned:([^,]*).*/\1/')

case "$btn" in
  "DeskRPG 만")
    [ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null
    lsof -ti :3000 :13000 2>/dev/null | xargs kill 2>/dev/null
    sleep 1
    dialog "✅ 중지 완료" "DeskRPG 서버가 중지되었습니다.\n\nOpenClaw 게이트웨이는 계속 가동 중입니다." "확인" "확인" "note" >/dev/null
    ;;
  "전체 중지")
    [ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null
    lsof -ti :3000 :13000 :18789 2>/dev/null | xargs kill 2>/dev/null
    sleep 1
    dialog "✅ 전체 중지 완료" "모든 서비스가 중지되었습니다.\n\nAI Office 시작.app 으로 다시 켤 수 있습니다." "확인" "확인" "note" >/dev/null
    ;;
esac
