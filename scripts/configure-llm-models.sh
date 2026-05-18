#!/bin/bash
# =================================================================
# configure-llm-models.sh
#
# .env.local 의 API 키를 읽어서:
#   1) OpenClaw 에 Anthropic / Google / OpenAI provider 등록 (apiKey 방식)
#   2) NPC 3명에 각자 다른 모델 할당
#      - 김대리(kim-daeri)    → openai/gpt-4o
#      - 박과장(park-gwajang) → anthropic/claude-sonnet-4-5
#      - 이주임(lee-juim)     → google/gemini-2.0-flash
#
# 실행: bash scripts/configure-llm-models.sh
# =================================================================

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

# .env.local 로드
[ -f "$ENV_FILE" ] && set -a && source "$ENV_FILE" && set +a

echo "🔧 LLM 모델 설정 시작"
echo ""

# ─── 1. API 키 점검 ───
MISSING=0
if [ -z "$ANTHROPIC_API_KEY" ] || [[ "$ANTHROPIC_API_KEY" == sk-ant-xxxx* ]]; then
  echo "⚠ ANTHROPIC_API_KEY 가 .env.local 에 설정되지 않음"
  echo "  발급: https://console.anthropic.com/settings/keys"
  MISSING=1
fi
if [ -z "$GOOGLE_AI_API_KEY" ] || [[ "$GOOGLE_AI_API_KEY" == AIzaSyxxxx* ]]; then
  echo "⚠ GOOGLE_AI_API_KEY 가 .env.local 에 설정되지 않음"
  echo "  발급: https://aistudio.google.com/apikey"
  MISSING=1
fi
if [ -z "$OPENAI_API_KEY" ] || [[ "$OPENAI_API_KEY" == sk-xxxx* ]]; then
  echo "⚠ OPENAI_API_KEY 가 .env.local 에 설정되지 않음 (OAuth 만으로도 동작 가능)"
  echo "  발급: https://platform.openai.com/api-keys"
fi

if [ $MISSING -eq 1 ]; then
  echo ""
  echo "❌ Anthropic / Google 키가 필요합니다. .env.local 에 채운 뒤 다시 실행하세요."
  exit 1
fi

# ─── 2. OpenClaw 에 provider 추가 ───
echo ""
echo "📡 OpenClaw 에 provider 등록 중..."

# anthropic
if openclaw capability model providers 2>&1 | grep -q '"provider":"anthropic".*"configured":true'; then
  echo "  ✓ anthropic 이미 인증됨"
else
  echo "  - anthropic 인증 진행 (api-key)..."
  echo "$ANTHROPIC_API_KEY" | openclaw capability model auth login --provider anthropic --method api-key 2>&1 | tail -3 || true
fi

# google
if openclaw capability model providers 2>&1 | grep -q '"provider":"google".*"configured":true'; then
  echo "  ✓ google 이미 인증됨"
else
  echo "  - google 인증 진행 (api-key)..."
  echo "$GOOGLE_AI_API_KEY" | openclaw capability model auth login --provider google --method api-key 2>&1 | tail -3 || true
fi

# openai (선택)
if [ -n "$OPENAI_API_KEY" ] && [[ ! "$OPENAI_API_KEY" == sk-xxxx* ]]; then
  if openclaw capability model providers 2>&1 | grep -q '"provider":"openai".*"configured":true.*"selected":true'; then
    echo "  ✓ openai 이미 인증됨"
  else
    echo "  - openai 인증 진행 (api-key)..."
    echo "$OPENAI_API_KEY" | openclaw capability model auth login --provider openai --method api-key 2>&1 | tail -3 || true
  fi
fi

# ─── 3. 각 agent 의 모델 할당 ───
echo ""
echo "🎭 NPC 별 모델 할당..."

assign_model() {
  local agent_id="$1"
  local model="$2"
  echo "  - $agent_id → $model"
  openclaw config set "agents.entries[?(@.id=='$agent_id')].model.primary" "$model" 2>&1 | tail -2 || true
}

# 정확한 모델 ID 를 가져오기 위해 catalog 에서 첫 번째 가용 모델 추출
PICK_OPENAI=$(openclaw capability model list 2>&1 | grep -oE '"id":"openai/gpt-[0-9.]+[^"]*"' | head -1 | sed 's/"id":"\(.*\)"/\1/')
PICK_ANTHROPIC=$(openclaw capability model list 2>&1 | grep -oE '"id":"anthropic/claude-(sonnet|opus|haiku)[^"]*"' | head -1 | sed 's/"id":"\(.*\)"/\1/')
PICK_GOOGLE=$(openclaw capability model list 2>&1 | grep -oE '"id":"google/gemini-[0-9.]+[^"]*"' | head -1 | sed 's/"id":"\(.*\)"/\1/')

# 기본값
PICK_OPENAI="${PICK_OPENAI:-openai/gpt-4o}"
PICK_ANTHROPIC="${PICK_ANTHROPIC:-anthropic/claude-sonnet-4-5-20250929}"
PICK_GOOGLE="${PICK_GOOGLE:-google/gemini-2.5-flash}"

assign_model "kim-daeri"    "$PICK_OPENAI"
assign_model "park-gwajang" "$PICK_ANTHROPIC"
assign_model "lee-juim"     "$PICK_GOOGLE"

echo ""
echo "📋 최종 등록 상태:"
openclaw agents list 2>&1 | grep -E "Identity:|Model:" | head -12

echo ""
echo "✅ 완료 — DeskRPG dev-server 는 재시작 불필요 (OpenClaw 가 자동 적용)"
echo ""
echo "테스트:"
echo "  curl -X POST http://127.0.0.1:13000/office/meeting \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"topic\":\"여름 시즌 신상품 전략\"}'"
