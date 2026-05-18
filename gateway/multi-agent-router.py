"""
multi-agent-router.py

Hermes Agent Gateway의 커스텀 라우터.
텔레그램 메시지를 분석하여 3명의 AI NPC에게 업무를 분배하고,
회의를 소집하고, 최종 보고서를 전송한다.

사용법:
  1. hermes-agent/gateway/builtin_hooks/ 에 이 파일을 복사
  2. cli-config.yaml의 hooks 섹션에 등록
  3. hermes gateway 재시작

작동 원리:
  - 텔레그램 메시지가 들어오면 이 라우터가 먼저 가로챔
  - /task, /meeting, /assign 등의 명령어를 파싱
  - DeskRPG 서버의 OpenClaw Gateway에 RPC로 전달
  - 각 NPC 에이전트에게 태스크 할당 또는 회의 시작
"""

import asyncio
import json
import logging
import os
import re
from typing import Dict, List, Optional, Any
from datetime import datetime

logger = logging.getLogger("multi-agent-router")

# ============================
# 설정
# ============================

DESKRPG_WS_URL = os.getenv("DESKRPG_WS_URL", "ws://localhost:3000/api/openclaw")
OPENCLAW_TOKEN = os.getenv("OPENCLAW_TOKEN", "")

AGENTS = {
    "kim-daeri": {
        "id": "ai-gpt-kim",
        "name": "김대리",
        "provider": "openai",
        "model": "gpt-4o",
        "role": "전략 기획",
        "keywords": ["분석", "데이터", "전략", "시장", "KPI", "수치", "매출", "재무"],
    },
    "park-gwajang": {
        "id": "ai-claude-park",
        "name": "박과장",
        "provider": "anthropic",
        "model": "claude-sonnet-4-20250514",
        "role": "보고서 작성",
        "keywords": ["보고서", "문서", "정리", "편집", "기획서", "요약", "구조화"],
    },
    "lee-juim": {
        "id": "ai-gemini-lee",
        "name": "이주임",
        "provider": "google",
        "model": "gemini-2.0-flash",
        "role": "리서치",
        "keywords": ["검색", "조사", "트렌드", "사례", "해외", "리서치", "아이디어"],
    },
}

# ============================
# 명령어 파서
# ============================

COMMAND_PATTERNS = {
    "task":    re.compile(r"^/task\s+(.+)", re.DOTALL),
    "assign":  re.compile(r"^/assign\s+(\S+)\s+(.+)", re.DOTALL),
    "meeting": re.compile(r"^/meeting\s+(.+)", re.DOTALL),
    "report":  re.compile(r"^/report\s*$"),
    "status":  re.compile(r"^/status\s*$"),
    "debate":  re.compile(r"^/debate\s+(.+)", re.DOTALL),
}


def parse_command(text: str) -> Optional[Dict[str, Any]]:
    """텔레그램 메시지를 파싱하여 명령어와 인자를 반환."""
    text = text.strip()
    
    for cmd_name, pattern in COMMAND_PATTERNS.items():
        match = pattern.match(text)
        if match:
            return {
                "command": cmd_name,
                "args": match.groups(),
            }
    
    # 명령어 없이 자연어로 보낸 경우 → 자동 분류
    if text and not text.startswith("/"):
        return {
            "command": "auto",
            "args": (text,),
        }
    
    return None


def classify_task(text: str) -> List[str]:
    """
    자연어 태스크를 분석하여 관련 에이전트 ID 목록을 반환.
    키워드 매칭 기반 간단 분류. 실제 운영 시 LLM 기반 분류 추천.
    """
    text_lower = text.lower()
    matched = []
    
    for agent_key, agent_info in AGENTS.items():
        for keyword in agent_info["keywords"]:
            if keyword in text_lower:
                matched.append(agent_key)
                break
    
    # 매칭되는 에이전트가 없으면 전원 할당
    if not matched:
        matched = list(AGENTS.keys())
    
    return matched


# ============================
# DeskRPG 태스크 생성기
# ============================

async def create_deskrpg_task(
    agent_id: str,
    title: str,
    content: str,
    assigner: str = "telegram-user",
) -> Dict:
    """DeskRPG 서버에 태스크를 생성한다."""
    task_payload = {
        "action": "create",
        "npcId": agent_id,
        "assignerId": assigner,
        "title": title,
        "summary": content,
        "status": "in-progress",
    }
    
    # 실제 구현: WebSocket RPC로 DeskRPG 서버에 전달
    # 여기서는 구조만 정의
    logger.info(f"Task created for {agent_id}: {title}")
    return task_payload


async def trigger_meeting(
    topic: str,
    participants: List[str],
) -> Dict:
    """DeskRPG 회의실에서 AI 회의를 시작한다."""
    meeting_config = {
        "topic": topic,
        "participants": [
            {
                "agentId": AGENTS[p]["id"],
                "displayName": AGENTS[p]["name"],
                "role": AGENTS[p]["role"],
            }
            for p in participants
        ],
        "settings": {
            "initialMode": "auto",
            "hybridMode": True,
        },
        "quota": {
            "maxTurnsPerAgent": 10,
            "maxTotalTurns": 30,
            "maxConsecutivePasses": 2,
        },
    }
    
    logger.info(f"Meeting triggered: {topic} with {len(participants)} participants")
    return meeting_config


# ============================
# 보고서 전송기
# ============================

async def send_report_to_platforms(
    report: str,
    platforms: List[str] = None,
) -> Dict[str, bool]:
    """
    최종 보고서를 여러 플랫폼으로 전송.
    
    지원 플랫폼:
    - telegram: Hermes Gateway의 telegram adapter 사용
    - slack: Hermes Gateway의 slack adapter 사용
    - kakao: kmsg CLI 사용 (macOS 전용)
    """
    if platforms is None:
        platforms = ["telegram", "slack", "kakao"]
    
    results = {}
    
    for platform in platforms:
        try:
            if platform == "telegram":
                # Hermes Gateway의 send_message_tool 사용
                results["telegram"] = True
                logger.info("Report sent to Telegram")
                
            elif platform == "slack":
                # Hermes Gateway의 Slack adapter 사용
                slack_channel = os.getenv("SLACK_REPORT_CHANNEL", "")
                results["slack"] = True
                logger.info(f"Report sent to Slack #{slack_channel}")
                
            elif platform == "kakao":
                kakao_enabled = os.getenv("KAKAO_ENABLED", "false").lower() == "true"
                if kakao_enabled:
                    chat_room = os.getenv("KAKAO_CHAT_ROOM", "")
                    # kmsg CLI 사용: kmsg send "채팅방" "메시지"
                    import subprocess
                    result = subprocess.run(
                        ["kmsg", "send", chat_room, report],
                        capture_output=True,
                        text=True,
                        timeout=30,
                    )
                    results["kakao"] = result.returncode == 0
                    logger.info(f"Report sent to KakaoTalk: {chat_room}")
                else:
                    results["kakao"] = False
                    logger.info("KakaoTalk disabled")
                    
        except Exception as e:
            results[platform] = False
            logger.error(f"Failed to send report to {platform}: {e}")
    
    return results


# ============================
# 메인 라우터 핸들러
# ============================

async def handle_incoming_message(
    platform: str,
    user_id: str,
    user_name: str,
    message_text: str,
    reply_func=None,
) -> Optional[str]:
    """
    수신 메시지를 처리하는 메인 핸들러.
    
    Hermes Agent의 gateway hook으로 등록하여 사용.
    """
    parsed = parse_command(message_text)
    if not parsed:
        return None
    
    command = parsed["command"]
    args = parsed["args"]
    
    # ─── /task: 전체 팀 업무 지시 ───
    if command == "task":
        content = args[0]
        assigned = classify_task(content)
        
        tasks = []
        for agent_key in assigned:
            task = await create_deskrpg_task(
                agent_id=AGENTS[agent_key]["id"],
                title=f"[텔레그램] {content[:50]}",
                content=content,
                assigner=user_name,
            )
            tasks.append(task)
        
        agent_names = ", ".join(AGENTS[a]["name"] for a in assigned)
        response = (
            f"📋 업무가 할당되었습니다.\n"
            f"담당: {agent_names}\n"
            f"내용: {content[:100]}{'...' if len(content) > 100 else ''}\n\n"
            f"작업이 완료되면 자동으로 보고됩니다."
        )
        return response
    
    # ─── /assign: 특정 직원 지정 ───
    elif command == "assign":
        name_hint, content = args
        target = None
        for key, agent in AGENTS.items():
            if name_hint in agent["name"] or name_hint in key:
                target = key
                break
        
        if not target:
            return f"❌ '{name_hint}' 직원을 찾을 수 없습니다. (김대리/박과장/이주임)"
        
        task = await create_deskrpg_task(
            agent_id=AGENTS[target]["id"],
            title=f"[지정] {content[:50]}",
            content=content,
            assigner=user_name,
        )
        return f"📋 {AGENTS[target]['name']}에게 업무를 할당했습니다.\n내용: {content[:100]}"
    
    # ─── /meeting: 회의 소집 ───
    elif command == "meeting":
        topic = args[0]
        config = await trigger_meeting(
            topic=topic,
            participants=list(AGENTS.keys()),
        )
        return (
            f"🏢 회의가 소집되었습니다.\n"
            f"주제: {topic}\n"
            f"참석: 김대리, 박과장, 이주임\n\n"
            f"회의 결과는 완료 후 자동 전송됩니다."
        )
    
    # ─── /debate: 토론 시작 ───
    elif command == "debate":
        topic = args[0]
        config = await trigger_meeting(
            topic=topic,
            participants=list(AGENTS.keys()),
        )
        config["settings"]["initialMode"] = "auto"
        return (
            f"🔥 토론이 시작됩니다.\n"
            f"주제: {topic}\n"
            f"참석: 김대리(GPT) vs 박과장(Claude) vs 이주임(Gemini)\n\n"
            f"각자의 관점에서 논쟁한 뒤 결론을 도출합니다."
        )
    
    # ─── /report: 현재 진행 보고 ───
    elif command == "report":
        return (
            "📊 현재 진행 현황을 수집 중입니다...\n"
            "각 직원에게 보고를 요청합니다."
        )
    
    # ─── /status: 상태 확인 ───
    elif command == "status":
        status_lines = ["📍 직원 현황\n"]
        for key, agent in AGENTS.items():
            status_lines.append(
                f"• {agent['name']} ({agent['role']}): "
                f"모델={agent['model']}"
            )
        return "\n".join(status_lines)
    
    # ─── 자연어 메시지 → 자동 분류 ───
    elif command == "auto":
        content = args[0]
        assigned = classify_task(content)
        
        # 복합 업무면 회의 소집
        if len(assigned) >= 2:
            config = await trigger_meeting(
                topic=content,
                participants=assigned,
            )
            agent_names = ", ".join(AGENTS[a]["name"] for a in assigned)
            return (
                f"🏢 복합 업무로 판단하여 회의를 소집합니다.\n"
                f"참석: {agent_names}\n"
                f"주제: {content[:100]}"
            )
        else:
            task = await create_deskrpg_task(
                agent_id=AGENTS[assigned[0]]["id"],
                title=content[:50],
                content=content,
                assigner=user_name,
            )
            return f"📋 {AGENTS[assigned[0]]['name']}에게 업무를 할당했습니다."
    
    return None


# ============================
# Hermes Gateway Hook 등록
# ============================

HOOK_CONFIG = {
    "name": "multi-agent-router",
    "description": "Routes Telegram messages to 3 AI NPC agents in DeskRPG",
    "events": ["message.incoming"],
    "priority": 100,
}


async def on_message_incoming(event: Dict) -> Optional[Dict]:
    """Hermes Gateway hook: 수신 메시지 처리."""
    platform = event.get("platform", "")
    user_id = event.get("user_id", "")
    user_name = event.get("user_name", "unknown")
    text = event.get("text", "")
    
    if not text:
        return None
    
    response = await handle_incoming_message(
        platform=platform,
        user_id=user_id,
        user_name=user_name,
        message_text=text,
    )
    
    if response:
        return {
            "action": "reply",
            "text": response,
        }
    
    return None
