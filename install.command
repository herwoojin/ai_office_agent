#!/bin/bash
# =============================================================================
# AI Office Agents — macOS 원클릭 설치 (.command 파일)
#
# 사용법: 이 파일을 Finder 에서 더블클릭
# (Terminal 권한 처음 묻는 경우 허용)
#
# 이 스크립트가 자동으로 하는 일:
#   1. Homebrew 설치 확인 (없으면 안내)
#   2. Node.js 20+ / git / openclaw 설치
#   3. AI Office Agents 저장소 클론 (~/ai-office-agents)
#   4. desk_rpg_model 의존성 설치 + SQLite 초기화
#   5. OpenClaw 게이트웨이 디바이스 페어링
#   6. macOS .app 번들 빌드 (Applications 폴더)
#   7. .env.local 템플릿 + 안내 팝업
# =============================================================================

set -e
cd "$(dirname "$0")"

INSTALL_ROOT="${INSTALL_ROOT:-$HOME/ai-office-agents}"
REPO_URL="https://github.com/herwoojin/ai_office_agent.git"

# ─── AppleScript 헬퍼 ───

dialog() {
  local title="$1" message="$2" buttons="$3" default="$4" icon="${5:-note}"
  message=$(echo "$message" | sed 's/"/\\"/g')
  title=$(echo "$title" | sed 's/"/\\"/g')
  local btnList=""
  IFS=',' read -ra BTN_ARR <<< "$buttons"
  for b in "${BTN_ARR[@]}"; do btnList+="\"$b\","; done
  btnList="${btnList%,}"
  osascript -e "display dialog \"$message\" with title \"$title\" buttons {$btnList} default button \"$default\" with icon $icon"
}

clicked() {
  echo "$1" | sed -E 's/.*button returned:([^,]*).*/\1/'
}

# 진행 단계 표시 (notification)
step() {
  osascript -e "display notification \"$2\" with title \"AI Office 설치 ($1/8)\""
  echo ""
  echo "━━━ [$1/8] $2 ━━━"
}

err_exit() {
  dialog "❌ 설치 실패" "$1\n\n전체 로그는 Terminal 출력을 참고하세요." "닫기" "닫기" "stop" >/dev/null 2>&1
  exit 1
}

# ─── 0단계: 환영 ───

WELCOME_TEXT='🏢 AI Office Agents 설치 마법사

3명의 AI 직원(김대리 · 박과장 · 이주임)이 가상 사무실에서 \
일하고 회의하는 시스템을 설치합니다.

▎ 설치되는 것
  • Homebrew (필요 시)
  • Node.js 20+
  • Git
  • OpenClaw CLI
  • AI Office Agents 저장소 (~/ai-office-agents)
  • macOS .app 번들 (Applications 폴더)

▎ 소요 시간
  처음 설치: 약 10~15분 (네트워크 속도에 따라)
  재실행: 1~2분 (이미 설치된 부분 건너뜀)

▎ 설치 후
  Applications 폴더의 "AI Office 시작.app" 더블클릭만 하면 가동!

지금 설치를 시작할까요?'

result=$(dialog "🏢 AI Office Agents — 원클릭 설치" "$WELCOME_TEXT" "취소,설치 시작" "설치 시작" "note") || exit 0
btn=$(clicked "$result")
[ "$btn" != "설치 시작" ] && exit 0

# Terminal 창 띄우기 (사용자가 진행 상황 볼 수 있게)
echo ""
echo "═══════════════════════════════════════════════════"
echo "  AI Office Agents — 원클릭 설치"
echo "═══════════════════════════════════════════════════"

# ─── 1단계: Homebrew ───

step 1 "Homebrew 확인 중..."
if ! command -v brew >/dev/null 2>&1; then
  result=$(dialog "📦 Homebrew 필요" \
"Homebrew 가 설치되어 있지 않습니다.

Homebrew 는 macOS 용 패키지 관리자로, Node.js / git / openclaw 등을 \
설치하는 데 필요합니다.

지금 설치할까요? (관리자 비밀번호 1회 입력 필요)" \
"취소,Homebrew 설치" "Homebrew 설치" "caution") || exit 0
  btn=$(clicked "$result")
  if [ "$btn" = "Homebrew 설치" ]; then
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv 2>/dev/null || /usr/local/bin/brew shellenv)"
  else
    err_exit "Homebrew 없이 진행할 수 없습니다."
  fi
fi
echo "✓ Homebrew $(brew --version | head -1)"

# ─── 2단계: 필수 의존성 ───

step 2 "Node.js / git / openclaw 설치 중..."

for pkg in node@20 git; do
  if ! brew list "$pkg" >/dev/null 2>&1 && ! command -v ${pkg%@*} >/dev/null 2>&1; then
    brew install "$pkg" || true
  fi
done

if ! command -v openclaw >/dev/null 2>&1; then
  brew install openclaw 2>/dev/null || npm install -g openclaw 2>/dev/null || \
    echo "⚠ OpenClaw 자동 설치 실패 — 수동 설치 필요"
fi

echo "  ✓ node $(node --version 2>/dev/null || echo '미설치')"
echo "  ✓ npm $(npm --version 2>/dev/null || echo '미설치')"
echo "  ✓ git $(git --version 2>/dev/null | awk '{print $3}' || echo '미설치')"
echo "  ✓ openclaw $(openclaw --version 2>/dev/null | head -1 || echo '미설치')"

# ─── 3단계: 저장소 클론 ───

step 3 "AI Office Agents 저장소 클론 중..."

if [ -d "$INSTALL_ROOT/.git" ]; then
  echo "  이미 클론된 저장소가 있음 → git pull"
  (cd "$INSTALL_ROOT" && git pull --rebase || true)
else
  git clone "$REPO_URL" "$INSTALL_ROOT" || err_exit "저장소 클론 실패"
fi
cd "$INSTALL_ROOT"

# ─── 4단계: desk_rpg_model 클론 + 설치 ───

step 4 "DeskRPG 설치 중 (5~10분 소요)..."

if [ ! -d "desk_rpg_model/.git" ] && [ ! -f "desk_rpg_model/package.json" ]; then
  git clone https://github.com/herwoojin/desk_rpg_model.git desk_rpg_model 2>/dev/null \
    || echo "  (desk_rpg_model 가 이미 클론되어 있거나 다른 위치에 있음)"
fi

if [ -d "desk_rpg_model" ]; then
  (cd desk_rpg_model && npm install --silent 2>&1 | tail -3) || err_exit "npm install 실패"
fi

# ─── 5단계: SQLite + 환경변수 ───

step 5 "SQLite DB 초기화 + 환경변수 템플릿..."

if [ ! -f ".env.local" ]; then
  cp config/.env.example .env.local 2>/dev/null || true
fi
if [ ! -f "desk_rpg_model/.env.local" ]; then
  cp desk_rpg_model/.env.example desk_rpg_model/.env.local 2>/dev/null || true
  echo "DB_TYPE=sqlite" >> desk_rpg_model/.env.local
  echo "SQLITE_PATH=data/deskrpg.db" >> desk_rpg_model/.env.local
fi

mkdir -p desk_rpg_model/data
(cd desk_rpg_model && DB_TYPE=sqlite npx drizzle-kit push --config=drizzle-sqlite.config.ts --force 2>&1 | tail -3) || true

# ─── 6단계: NPC 프리셋 패치 + OpenClaw 페어링 ───

step 6 "NPC 프리셋 + OpenClaw 페어링..."

node scripts/patch-office-presets.js ./desk_rpg_model 2>&1 | tail -3 || true

if command -v openclaw >/dev/null 2>&1; then
  # OpenClaw 게이트웨이 시작 (백그라운드)
  if ! lsof -ti :18789 >/dev/null 2>&1; then
    openclaw gateway > "$INSTALL_ROOT/logs/openclaw.log" 2>&1 &
    sleep 5
  fi

  # 토큰 추출
  TOKEN=$(grep -A1 '"auth"' ~/.openclaw/openclaw.json 2>/dev/null | grep '"token"' | head -1 | sed -E 's/.*"token": "([^"]+)".*/\1/')
  if [ -n "$TOKEN" ]; then
    echo "OPENCLAW_TOKEN=$TOKEN" >> .env.local
    echo "OPENCLAW_URL=ws://127.0.0.1:18789" >> .env.local

    # 디바이스 페어링 시도
    OPENCLAW_TOKEN="$TOKEN" node gateway/pair-deskrpg.js 2>&1 | tail -3 || \
      echo "  ⚠ 페어링 필요 — 처음 시작 후 'openclaw devices approve --latest' 실행"
  fi
fi

# ─── 7단계: macOS .app 번들 빌드 ───

step 7 "macOS .app 번들 빌드..."

bash scripts/mac-app/build-apps.sh "$HOME/Applications" 2>&1 | tail -5

# ─── 8단계: 완료 + 안내 ───

step 8 "완료!"

result=$(dialog "🎉 설치 완료!" \
"AI Office Agents 가 성공적으로 설치되었습니다.

▎ 다음 단계
  1. Applications 폴더에서 '🏢 AI Office 시작.app' 더블클릭
  2. 친절한 팝업이 뜨면서 서버 자동 가동
  3. 브라우저에서 http://localhost:3000/setup 열림

▎ LLM 모델 설정
  설정 허브에서 OpenAI / Claude / Gemini API 키 입력하면 \
3명의 NPC가 각각 다른 모델로 응답합니다.

▎ 외부에서 명령
  텔레그램/슬랙/디스코드 봇 설정 후 \
'/task ...' '/meeting ...' 명령으로 어디서든 조작 가능.

▎ 설치 위치
  프로젝트:  $INSTALL_ROOT
  앱:       ~/Applications/AI Office 시작.app

지금 무엇을 하시겠어요?" \
"닫기,Applications 폴더 열기,바로 시작" "바로 시작" "note") || exit 0

btn=$(clicked "$result")
case "$btn" in
  "Applications 폴더 열기") open "$HOME/Applications" ;;
  "바로 시작") open "$HOME/Applications/AI Office 시작.app" ;;
esac

echo ""
echo "✅ 설치 완료. 이 창은 닫아도 됩니다."
