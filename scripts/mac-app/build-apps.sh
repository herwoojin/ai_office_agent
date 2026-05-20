#!/bin/bash
# =============================================================================
# build-apps.sh — macOS .app 번들 두 개 생성
#
#   1. "AI Office 시작.app"  — 더블클릭으로 서버 가동 + 친절한 팝업
#   2. "AI Office 중지.app"  — 더블클릭으로 안전하게 정지
#
# 사용법:
#   bash scripts/mac-app/build-apps.sh           # ~/Applications 에 설치
#   bash scripts/mac-app/build-apps.sh /Users/heoujin/Desktop  # 지정 경로
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEST="${1:-$HOME/Applications}"

mkdir -p "$DEST"

# .app 번들을 만드는 헬퍼
build_app() {
  local app_name="$1"
  local bundle_id="$2"
  local script_src="$3"
  local emoji_label="$4"
  local app_path="$DEST/$app_name.app"

  echo "🔨 빌드: $app_name"

  # 기존 제거
  rm -rf "$app_path"

  # 디렉터리 구조
  mkdir -p "$app_path/Contents/MacOS"
  mkdir -p "$app_path/Contents/Resources"

  # 실행 스크립트 복사
  cp "$script_src" "$app_path/Contents/MacOS/launcher"
  chmod +x "$app_path/Contents/MacOS/launcher"

  # Info.plist
  cat > "$app_path/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIdentifier</key>
    <string>$bundle_id</string>
    <key>CFBundleName</key>
    <string>$app_name</string>
    <key>CFBundleDisplayName</key>
    <string>$app_name</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>LSUIElement</key>
    <false/>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSSupportsAutomaticGraphicsSwitching</key>
    <true/>
    <key>NSHumanReadableCopyright</key>
    <string>AI Office Agents</string>
</dict>
</plist>
EOF

  # 간단한 아이콘 생성 (이모지 → PNG → icns, 옵션)
  generate_icon "$app_path/Contents/Resources/icon.icns" "$emoji_label" 2>/dev/null || true

  echo "  ✓ $app_path"
}

# 이모지 기반 간단 아이콘 생성 (sips 가 있는 macOS 에서만 동작)
generate_icon() {
  local out="$1"
  local emoji="$2"
  # 실제로 .icns 만들기는 복잡하니 기본 macOS 앱 아이콘 사용 (이 함수는 no-op)
  # 사용자가 원하면 직접 .icns 파일 만들어서 Resources/icon.icns 로 넣으면 됨
  return 0
}

# ─── 빌드 ───

build_app "AI Office 시작" \
  "com.ai-office-agents.start" \
  "$SCRIPT_DIR/start-script.sh" \
  "🏢"

build_app "AI Office 중지" \
  "com.ai-office-agents.stop" \
  "$SCRIPT_DIR/stop-script.sh" \
  "🛑"

echo ""
echo "✅ 완료!"
echo ""
echo "📁 설치 위치: $DEST"
echo ""
echo "💡 다음 단계:"
echo "  1. Finder 에서 '$DEST' 폴더 열기 (open '$DEST')"
echo "  2. 'AI Office 시작.app' 을 Dock 또는 Launchpad 로 드래그"
echo "  3. 더블클릭하면 친절한 팝업과 함께 가동!"
echo ""
echo "⚠ 첫 실행 시 macOS 보안 차단되면:"
echo "  System Settings → Privacy & Security → 하단 '확인 없이 열기' 버튼 클릭"
echo ""

# 자동으로 Finder 열기
open "$DEST"
