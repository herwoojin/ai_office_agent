"""
ai_office_hook.py

Hermes Agent Gateway 훅.
텔레그램/슬랙 메시지를 가로채서 DeskRPG 서버로 라우팅.

설치:
  1. 이 파일을 hermes-agent/gateway/builtin_hooks/ 에 복사
  2. hermes gateway 재시작

작동:
  - /task, /meeting 등 명령어 감지 → DeskRPG WebSocket RPC 호출
  - 자연어 메시지 → 자동 분류 후 적절한 NPC에게 전달
  - 회의 완료 → 보고서를 모든 플랫폼으로 전송
"""

import asyncio
import json
import logging
import os
import re
from typing import Optional, Dict, Any, List

logger = logging.getLogger("ai_office_hook")

# ─── 설정 ───

DESKRPG_URL = os.getenv("DESKRPG_URL", "http://localhost:3000")
DESKRPG_WS_URL = os.getenv("DESKRPG_WS_URL", "ws://localhost:3000/api/openclaw")

NPC_AGENTS = {
    "김대리": {"id": "ai-gpt-kim",    "role": "전략기획", "keywords": ["분석", "데이터", "전략", "시장", "매출", "수치"]},
    "박과장": {"id": "ai-claude-park", "role": "보고서",   "keywords": ["보고서", "문서", "정리", "편집", "요약", "검토"]},
    "이주임": {"id": "ai-gemini-lee",  "role": "리서치",   "keywords": ["검색", "조사", "트렌드", "사례", "해외", "아이디어"]},
}

# ─── 명령어 파싱 ───

COMMANDS = {
    "task":    re.compile(r"^/task\s+(.+)", re.DOTALL),
    "assign":  re.compile(r"^/assign\s+(\S+)\s+(.+)", re.DOTALL),
    "meeting": re.compile(r"^/meeting\s+(.+)", re.DOTALL),
    "debate":  re.compile(r"^/debate\s+(.+)", re.DOTALL),
    "report":  re.compile(r"^/report\s*$"),
    "status":  re.compile(r"^/status\s*$"),
}


def parse_message(text: str) -> Optional[Dict[str, Any]]:
    """메시지에서 명령어를 파싱."""
    text = text.strip()
    for cmd, pattern in COMMANDS.items():
        m = pattern.match(text)
        if m:
            return {"command": cmd, "args": m.groups()}
    return None


def find_agent_by_name(name_hint: str) -> Optional[str]:
    """이름 힌트로 에이전트 찾기."""
    for name, info in NPC_AGENTS.items():
        if name_hint in name or name_hint in info["id"]:
            return name
    return None


def classify_agents(text: str) -> List[str]:
    """자연어 텍스트에서 관련 에이전트 자동 분류."""
    matched = []
    for name, info in NPC_AGENTS.items():
        for kw in info["keywords"]:
            if kw in text:
                matched.append(name)
                break
    return matched or list(NPC_AGENTS.keys())


# ─── DeskRPG 연동 (HTTP API) ───

async def send_to_deskrpg(endpoint: str, payload: dict) -> Optional[dict]:
    """DeskRPG 서버에 HTTP 요청."""
    try:
        import aiohttp
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{DESKRPG_URL}/api/{endpoint}",
                json=payload,
                headers={"Authorization": f"Bearer {os.getenv('OPENCLAW_TOKEN', '')}"},
                timeout=aiohttp.ClientTimeout(total=30),
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                logger.error(f"DeskRPG API error: {resp.status}")
    except Exception as e:
        logger.error(f"DeskRPG connection error: {e}")
    return None


# ─── 메시지 핸들러 ───

async def handle_task(content: str, user_name: str) -> str:
    """전체 팀 업무 지시 처리."""
    agents = classify_agents(content)
    
    task_lines = []
    for name in agents:
        info = NPC_AGENTS[name]
        await send_to_deskrpg("tasks", {
            "npcId": info["id"],
            "title": f"[텔레그램] {content[:50]}",
            "summary": content,
            "assigner": user_name,
        })
        task_lines.append(f"  • {name} ({info['role']})")
    
    return (
        f"📋 업무가 할당되었습니다.\n\n"
        + "\n".join(task_lines)
        + f"\n\n내용: {content[:100]}"
        + "\n\n작업 완료 후 보고서가 자동 전송됩니다."
    )


async def handle_assign(name_hint: str, content: str, user_name: str) -> str:
    """특정 직원 지정 업무."""
    agent_name = find_agent_by_name(name_hint)
    if not agent_name:
        return f"❌ '{name_hint}' 직원을 찾을 수 없습니다.\n사용 가능: 김대리, 박과장, 이주임"
    
    info = NPC_AGENTS[agent_name]
    await send_to_deskrpg("tasks", {
        "npcId": info["id"],
        "title": content[:50],
        "summary": content,
        "assigner": user_name,
    })
    
    return f"📋 {agent_name}에게 업무를 할당했습니다.\n내용: {content[:100]}"


async def handle_meeting(topic: str) -> str:
    """3인 회의 소집."""
    await send_to_deskrpg("meetings", {
        "topic": topic,
        "participants": [
            {"agentId": info["id"], "displayName": name, "role": info["role"]}
            for name, info in NPC_AGENTS.items()
        ],
    })
    
    return (
        f"🏢 회의가 소집되었습니다.\n"
        f"주제: {topic}\n"
        f"참석: 김대리(GPT), 박과장(Claude), 이주임(Gemini)\n\n"
        f"DeskRPG에서 실시간 확인 가능합니다.\n"
        f"회의 완료 후 보고서가 자동 전송됩니다."
    )


async def handle_status() -> str:
    """직원 상태 확인."""
    lines = ["📍 AI 직원 현황\n"]
    for name, info in NPC_AGENTS.items():
        lines.append(f"• {name} ({info['role']})")
    lines.append("\n🏢 DeskRPG: http://localhost:3000")
    return "\n".join(lines)


# ─── Hermes Gateway 훅 인터페이스 ───

HOOK_NAME = "ai_office_hook"
HOOK_DESCRIPTION = "AI Office Agents — DeskRPG 멀티 에이전트 라우터"


async def on_message(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Hermes Gateway 메시지 훅.
    
    모든 수신 메시지에 대해 호출됨.
    명령어를 감지하면 처리하고 응답을 반환.
    명령어가 아니면 None을 반환하여 기본 처리 진행.
    """
    text = event.get("text", "").strip()
    user_name = event.get("user_name", "사용자")
    platform = event.get("platform", "unknown")
    
    if not text:
        return None
    
    parsed = parse_message(text)
    if not parsed:
        # 명령어가 아닌 자연어 → 자동 분류 가능하지만
        # 일반 대화도 많으므로 명시적 명령어만 처리
        return None
    
    cmd = parsed["command"]
    args = parsed["args"]
    
    response = None
    
    if cmd == "task":
        response = await handle_task(args[0], user_name)
    elif cmd == "assign":
        response = await handle_assign(args[0], args[1], user_name)
    elif cmd == "meeting" or cmd == "debate":
        prefix = "🔥 토론" if cmd == "debate" else "🏢 회의"
        response = await handle_meeting(args[0])
        if cmd == "debate":
            response = response.replace("🏢 회의가", "🔥 토론이")
    elif cmd == "report":
        response = "📊 진행 현황을 수집 중입니다...\n각 직원에게 보고를 요청합니다."
    elif cmd == "status":
        response = await handle_status()
    
    if response:
        return {
            "action": "reply",
            "text": response,
            "consume": True,  # 이 메시지는 기본 에이전트로 전달하지 않음
        }
    
    return None


# ─── 훅 등록 (Hermes Agent 형식) ───

def register():
    """Hermes Gateway에 훅 등록."""
    return {
        "name": HOOK_NAME,
        "description": HOOK_DESCRIPTION,
        "events": ["message.incoming"],
        "handler": on_message,
        "priority": 100,  # 높은 우선순위
    }
