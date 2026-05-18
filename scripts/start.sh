#!/bin/bash
# =============================================
# AI Office Agents — 원클릭 실행 스크립트
# =============================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$SCRIPT_DIR"

# 환경변수 로드
if [ -f ".env.local" ]; then
    set -a
    source .env.local
    set +a
else
    echo "❌ .env.local 파일이 없습니다. scripts/setup.sh 를 먼저 실행하세요."
    exit 1
fi

echo "🏢 AI Office Agents를 시작합니다..."
echo ""

# PID 파일 디렉토리
mkdir -p .pids

cleanup() {
    echo ""
    echo "🛑 서비스를 종료합니다..."
    
    if [ -f .pids/deskrpg.pid ]; then
        kill $(cat .pids/deskrpg.pid) 2>/dev/null || true
        rm .pids/deskrpg.pid
    fi
    
    if [ -f .pids/hermes.pid ]; then
        kill $(cat .pids/hermes.pid) 2>/dev/null || true
        rm .pids/hermes.pid
    fi
    
    echo "✅ 모든 서비스가 종료되었습니다."
    exit 0
}

trap cleanup SIGINT SIGTERM

# ─── 1. DeskRPG 서버 시작 ───
echo "🎮 DeskRPG 서버 시작 중..."

cd desk_rpg_model
npm run dev &
DESKRPG_PID=$!
echo $DESKRPG_PID > "$SCRIPT_DIR/.pids/deskrpg.pid"
cd "$SCRIPT_DIR"

echo "  ✓ DeskRPG: http://localhost:${DESKRPG_PORT:-3000}"

# DeskRPG 서버가 준비될 때까지 대기
echo "  ⏳ DeskRPG 서버 준비 대기 중..."
for i in {1..30}; do
    if curl -s "http://localhost:${DESKRPG_PORT:-3000}" > /dev/null 2>&1; then
        echo "  ✓ DeskRPG 서버 준비 완료"
        break
    fi
    sleep 2
done

# ─── 2. Hermes Gateway 시작 ───
echo ""
echo "🤖 Hermes Gateway 시작 중..."

hermes gateway &
HERMES_PID=$!
echo $HERMES_PID > .pids/hermes.pid

echo "  ✓ Hermes Gateway 시작됨"

# ─── 3. 상태 요약 ───
echo ""
echo "============================================"
echo "✅ AI Office Agents 가동 중!"
echo "============================================"
echo ""
echo "  🎮 DeskRPG:    http://localhost:${DESKRPG_PORT:-3000}"
echo "  🤖 Hermes:     Gateway 활성"
echo "  📱 Telegram:   @YourBotName으로 메시지 전송"
echo ""
echo "  텔레그램 명령어:"
echo "    /task <내용>         전체 팀 업무 지시"
echo "    /assign <이름> <내용> 특정 직원 지정"
echo "    /meeting <주제>      3인 회의 소집"
echo "    /debate <주제>       찬반 토론 시작"
echo "    /report              진행 보고 요청"
echo "    /status              직원 상태 확인"
echo ""
echo "  종료: Ctrl+C"
echo "============================================"
echo ""

# 포그라운드에서 대기
wait
