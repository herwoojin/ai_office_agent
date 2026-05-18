#!/bin/bash
# =============================================
# AI Office Agents — 원클릭 설치 스크립트
# =============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "🏢 AI Office Agents 설치를 시작합니다..."
echo ""

# ─── 1. 시스템 요구사항 확인 ───
echo "📋 시스템 요구사항 확인 중..."

check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "❌ $1 이 설치되어 있지 않습니다."
        echo "   설치 방법: $2"
        return 1
    fi
    echo "  ✓ $1 설치됨"
    return 0
}

MISSING=0
check_command "node" "https://nodejs.org" || MISSING=1
check_command "npm" "Node.js 설치 시 포함" || MISSING=1
check_command "python3" "https://python.org" || MISSING=1
check_command "git" "https://git-scm.com" || MISSING=1

if [ $MISSING -eq 1 ]; then
    echo ""
    echo "❌ 누락된 도구를 먼저 설치해주세요."
    exit 1
fi

echo ""
echo "✅ 시스템 요구사항 충족"
echo ""

# ─── 2. DeskRPG 설치 ───
echo "🎮 DeskRPG 설치 중..."

if [ ! -d "desk_rpg_model" ]; then
    git clone https://github.com/herwoojin/desk_rpg_model.git
fi

cd desk_rpg_model
npm install
npm run setup:lite  # SQLite 모드 (간편)
cd ..

echo "  ✓ DeskRPG 설치 완료"
echo ""

# ─── 3. Hermes Agent 설치 ───
echo "🤖 Hermes Agent 설치 중..."

if ! command -v hermes &> /dev/null; then
    curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
    source ~/.bashrc 2>/dev/null || true
    source ~/.zshrc 2>/dev/null || true
fi

echo "  ✓ Hermes Agent 설치 완료"
echo ""

# ─── 4. 환경변수 설정 ───
echo "⚙️ 환경변수 설정..."

if [ ! -f ".env.local" ]; then
    cp config/.env.example .env.local
    echo ""
    echo "⚠️  .env.local 파일이 생성되었습니다."
    echo "   다음 API 키들을 입력해주세요:"
    echo "   - OPENAI_API_KEY"
    echo "   - ANTHROPIC_API_KEY"
    echo "   - GOOGLE_AI_API_KEY"
    echo "   - TELEGRAM_BOT_TOKEN"
    echo "   - SLACK_BOT_TOKEN (선택)"
    echo ""
    echo "   편집: nano .env.local 또는 code .env.local"
    echo ""
else
    echo "  ✓ .env.local 이미 존재함"
fi

# ─── 5. Hermes Agent 설정 배포 ───
echo "📝 Hermes Agent 설정 배포..."

HERMES_HOME="${HOME}/.hermes"
mkdir -p "$HERMES_HOME"

if [ ! -f "$HERMES_HOME/cli-config.yaml" ]; then
    cp config/cli-config.yaml "$HERMES_HOME/cli-config.yaml"
    echo "  ✓ cli-config.yaml 배포 완료"
else
    echo "  ⚠️  cli-config.yaml 이미 존재 (덮어쓰지 않음)"
fi

# 에이전트 페르소나 파일 배포
for agent_dir in agents/*/; do
    agent_name=$(basename "$agent_dir")
    target_dir="$HERMES_HOME/agents/$agent_name"
    mkdir -p "$target_dir"
    cp -r "$agent_dir"* "$target_dir/"
    echo "  ✓ $agent_name 페르소나 배포 완료"
done

# ─── 6. 카카오톡 (macOS 전용) ───
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo ""
    echo "🍎 macOS 감지됨. 카카오톡 연동을 설정하시겠습니까? (y/N)"
    read -r kakao_answer
    if [[ "$kakao_answer" =~ ^[Yy]$ ]]; then
        if [ ! -f "$HOME/.local/bin/kmsg" ]; then
            mkdir -p "$HOME/.local/bin"
            curl -fL https://github.com/channprj/kmsg/releases/latest/download/kmsg-macos-universal \
                -o "$HOME/.local/bin/kmsg" && chmod +x "$HOME/.local/bin/kmsg"
            echo "  ✓ kmsg CLI 설치 완료"
        else
            echo "  ✓ kmsg CLI 이미 설치됨"
        fi
    fi
fi

# ─── 7. 완료 ───
echo ""
echo "============================================"
echo "✅ AI Office Agents 설치가 완료되었습니다!"
echo "============================================"
echo ""
echo "다음 단계:"
echo "  1. .env.local 에 API 키를 입력하세요"
echo "  2. bash scripts/start.sh 로 실행하세요"
echo ""
echo "또는 수동 실행:"
echo "  터미널 1: cd desk_rpg_model && npm run dev"
echo "  터미널 2: hermes gateway"
echo "  브라우저: http://localhost:3000"
echo ""
