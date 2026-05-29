#!/bin/bash
# =============================================================================
# build-launchers.sh
#
# 사용자가 더블클릭으로 실행할 수 있는 macOS / Windows 런처 묶음을 생성한다.
#
# 출력:
#   dist/launchers/macos/  → "AI Office 시작.app", "AI Office 중지.app"
#   dist/launchers/windows/→ start.cmd, stop.cmd, AI-Office-Start.vbs, install.cmd
#   dist/AI-Office-Launchers-macOS.zip
#   dist/AI-Office-Launchers-Windows.zip
#
# 사용법:
#   bash scripts/build-launchers.sh
# =============================================================================

set -e
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

DIST="$PROJECT_ROOT/dist/launchers"
mkdir -p "$DIST"

echo "▎ 출력 위치: $DIST"

# ─── macOS ────────────────────────────────────────────────────────────────────
echo
echo "──── macOS .app 빌드 ────────────────────────────────────────────"
MAC_OUT="$DIST/macos"
rm -rf "$MAC_OUT"
mkdir -p "$MAC_OUT"
bash "$PROJECT_ROOT/scripts/mac-app/build-apps.sh" "$MAC_OUT"

# 사용자가 .app 만 열어도 알 수 있게 README 동봉
cat > "$MAC_OUT/README.txt" <<'EOF'
AI Office Agents — macOS 런처
================================

[설치]
  1) 이 폴더의 .app 두 개를 /Applications 로 드래그
  2) 처음 실행 시 macOS 가 차단하면:
     시스템 설정 → 개인정보 보호 및 보안 → "확인 없이 열기"

[시작]
  "AI Office 시작.app" 더블클릭
  → 자동으로 OpenClaw 게이트웨이 + DeskRPG 서버 가동
  → 브라우저에서 http://localhost:3000 열기

[중지]
  "AI Office 중지.app" 더블클릭

[전제 조건]
  • Node.js 20+ (https://nodejs.org/ko)
  • OpenClaw CLI: npm install -g openclaw
  • 프로젝트 폴더 위치 (다음 중 하나):
      ~/ai-office-agents
      ~/Documents/ai-office-agents
      /Applications/AI-Office-Agents
    또는 환경변수 AI_OFFICE_HOME 으로 지정
EOF

# ─── Windows ──────────────────────────────────────────────────────────────────
echo
echo "──── Windows 런처 패키지 ───────────────────────────────────────"
WIN_OUT="$DIST/windows"
rm -rf "$WIN_OUT"
mkdir -p "$WIN_OUT"
cp "$PROJECT_ROOT/scripts/windows/"*.cmd "$WIN_OUT/"
cp "$PROJECT_ROOT/scripts/windows/"*.vbs "$WIN_OUT/"

# 사용자에게 친화적인 한국어 파일명도 함께 (Windows 탐색기에서 더 직관적)
cp "$WIN_OUT/start.cmd" "$WIN_OUT/AI Office 시작.cmd"
cp "$WIN_OUT/stop.cmd"  "$WIN_OUT/AI Office 중지.cmd"
cp "$WIN_OUT/install.cmd" "$WIN_OUT/AI Office 설치.cmd"

cat > "$WIN_OUT/README.txt" <<'EOF'
AI Office Agents — Windows 런처
===================================

[설치]
  1) 이 폴더 전체를 원하는 위치에 복사 (예: 바탕화면)
  2) "AI Office 설치.cmd" 더블클릭
     → Node.js 확인 + 의존성 설치 + 바탕화면 바로가기 생성

[시작]
  "AI Office 시작.cmd" 또는 "AI-Office-Start.vbs" (콘솔창 안 보임) 더블클릭
  → 자동으로 OpenClaw 게이트웨이 + DeskRPG 서버 가동
  → 기본 브라우저에서 http://localhost:3000 열기

[중지]
  "AI Office 중지.cmd" 또는 "AI-Office-Stop.vbs" 더블클릭

[전제 조건]
  • Node.js 20+ (https://nodejs.org/ko - LTS 권장)
  • OpenClaw CLI: 명령 프롬프트에서  npm install -g openclaw
  • 프로젝트 폴더 위치 (다음 중 하나):
      %USERPROFILE%\ai-office-agents
      %USERPROFILE%\Documents\ai-office-agents
    또는 환경변수 AI_OFFICE_HOME 으로 지정

[Windows Defender / SmartScreen 경고가 뜨면]
  "추가 정보" → "실행" 클릭. 서명되지 않은 스크립트라서 발생하는 정상 경고.
EOF

# ─── 패키징 (.zip) ─────────────────────────────────────────────────────────────
echo
echo "──── ZIP 패키지 생성 ──────────────────────────────────────────"
cd "$DIST"

MAC_ZIP="$PROJECT_ROOT/dist/AI-Office-Launchers-macOS.zip"
WIN_ZIP="$PROJECT_ROOT/dist/AI-Office-Launchers-Windows.zip"
rm -f "$MAC_ZIP" "$WIN_ZIP"

(cd "$MAC_OUT/.." && zip -r "$MAC_ZIP" "macos") >/dev/null
(cd "$WIN_OUT/.." && zip -r "$WIN_ZIP" "windows") >/dev/null

echo "  ✓ $MAC_ZIP"
echo "  ✓ $WIN_ZIP"

echo
echo "✅ 완료. 배포는 두 .zip 파일을 그대로 전달하면 됩니다."
