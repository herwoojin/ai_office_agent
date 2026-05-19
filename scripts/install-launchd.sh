#!/bin/bash
# =============================================================================
# install-launchd.sh — macOS 부팅 자동 시작 + sleep 방지 설정
#
# 효과:
#   1. 맥북 부팅/로그인 즉시 OpenClaw + DeskRPG + (Slack/Discord/Telegram bot) 가동
#   2. caffeinate 로 시스템 sleep 방지 (디스플레이는 꺼짐 → 저전력)
#   3. 충돌/크래시 시 자동 재시작 (KeepAlive)
#
# 사용법:
#   bash scripts/install-launchd.sh        # 설치 + 즉시 시작
#   bash scripts/install-launchd.sh stop   # 중지
#   bash scripts/install-launchd.sh status # 상태 확인
# =============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_DIR="$HOME/Library/LaunchAgents"
LABEL="com.ai-office-agents.server"
PLIST_PATH="$PLIST_DIR/$LABEL.plist"
LOG_DIR="$PROJECT_ROOT/logs"
RUN_SCRIPT="$PROJECT_ROOT/scripts/run-always-on.sh"

mkdir -p "$PLIST_DIR" "$LOG_DIR"

case "${1:-install}" in
  install)
    # 1. 실행 래퍼 스크립트 (caffeinate 적용)
    cat > "$RUN_SCRIPT" <<EOF
#!/bin/bash
# AI Office Agents 항상 켜두기 래퍼
# caffeinate -i : 시스템 idle sleep 방지 (디스플레이는 꺼짐)
cd "$PROJECT_ROOT/desk_rpg_model"
exec /usr/bin/caffeinate -i /opt/homebrew/bin/npm run dev
EOF
    chmod +x "$RUN_SCRIPT"

    # 2. launchd plist 생성
    cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$LABEL</string>
    <key>ProgramArguments</key>
    <array>
        <string>$RUN_SCRIPT</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$PROJECT_ROOT/desk_rpg_model</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
        <key>HOME</key>
        <string>$HOME</string>
        <key>NODE_ENV</key>
        <string>development</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>
    <key>ThrottleInterval</key>
    <integer>10</integer>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/launchd-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/launchd-stderr.log</string>
    <key>ProcessType</key>
    <string>Background</string>
    <key>LowPriorityIO</key>
    <true/>
    <key>Nice</key>
    <integer>5</integer>
</dict>
</plist>
EOF

    # 3. 기존 데몬 언로드 + 새로 로드
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load -w "$PLIST_PATH"

    echo "✅ launchd 등록 완료"
    echo "  📄 plist:  $PLIST_PATH"
    echo "  🛠  실행:    $RUN_SCRIPT"
    echo "  📝 로그:    $LOG_DIR/launchd-{stdout,stderr}.log"
    echo ""
    echo "이제 부팅 시 자동으로 가동됩니다."
    echo ""
    echo "💡 sleep 모드 동작:"
    echo "   - 화면은 꺼짐 (절전)"
    echo "   - CPU/네트워크는 계속 (텔레그램·슬랙 메시지 받음)"
    echo "   - 뚜껑 닫아도 동작 — 단, '뚜껑 닫아도 sleep 안 하기'는"
    echo "     System Settings → Battery → Options → 'Prevent automatic sleeping...'"
    echo "     체크 필요 (전원 연결 시)"
    ;;

  stop|uninstall)
    if [ -f "$PLIST_PATH" ]; then
      launchctl unload -w "$PLIST_PATH" 2>/dev/null || true
      if [ "$1" = "uninstall" ]; then
        rm "$PLIST_PATH"
        echo "🗑  완전 제거"
      else
        echo "⏸  중지됨 (다음 로그인 시 다시 시작)"
      fi
    else
      echo "설치되어 있지 않습니다"
    fi
    ;;

  start)
    launchctl load -w "$PLIST_PATH"
    echo "▶  시작됨"
    ;;

  status)
    echo "=== launchd 상태 ==="
    launchctl list | grep "$LABEL" || echo "  (등록 안 됨)"
    echo ""
    echo "=== 프로세스 ==="
    pgrep -lf "npm run dev" || echo "  (실행 안 됨)"
    echo ""
    echo "=== 포트 ==="
    for p in 3000 13000 18789; do
      pid=$(lsof -ti :$p 2>/dev/null)
      if [ -n "$pid" ]; then echo "  ✓ :$p (pid $pid)"; else echo "  ✗ :$p (DOWN)"; fi
    done
    echo ""
    echo "=== 최근 로그 (마지막 10줄) ==="
    [ -f "$LOG_DIR/launchd-stdout.log" ] && tail -10 "$LOG_DIR/launchd-stdout.log"
    ;;

  *)
    echo "Usage: $0 [install|stop|uninstall|start|status]"
    exit 1
    ;;
esac
