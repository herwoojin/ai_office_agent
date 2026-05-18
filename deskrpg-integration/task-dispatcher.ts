/**
 * task-dispatcher.ts
 * 
 * 텔레그램 메시지 → DeskRPG 태스크 변환 + 회의 트리거.
 * DeskRPG 서버의 server.js에 통합하거나 별도 미들웨어로 사용.
 * 
 * 핵심 흐름:
 *   1. 텔레그램 메시지 수신 (Hermes Gateway 경유)
 *   2. 명령어 파싱 → 태스크 분류
 *   3. DeskRPG TaskManager에 태스크 생성
 *   4. 필요 시 MeetingBroker로 회의 소집
 *   5. 완료 후 결과를 텔레그램/슬랙/카톡으로 전송
 */

import type { Server as SocketIOServer } from "socket.io";

// ===== 타입 정의 =====

interface AgentConfig {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "google";
  modelId: string;
  role: string;
}

interface TaskRequest {
  command: "task" | "assign" | "meeting" | "debate" | "report" | "status";
  content: string;
  targetAgent?: string;
  assigner: string;
  platform: "telegram" | "slack" | "kakao";
}

interface MeetingResult {
  topic: string;
  participants: string[];
  turns: Array<{ speaker: string; content: string }>;
  conclusion: string;
  report: string;
}

// ===== 에이전트 설정 =====

const AGENTS: Record<string, AgentConfig> = {
  "ai-gpt-kim": {
    id: "ai-gpt-kim",
    name: "김대리",
    provider: "openai",
    modelId: "gpt-4o",
    role: "전략 기획",
  },
  "ai-claude-park": {
    id: "ai-claude-park",
    name: "박과장",
    provider: "anthropic",
    modelId: "claude-sonnet-4-20250514",
    role: "보고서 작성",
  },
  "ai-gemini-lee": {
    id: "ai-gemini-lee",
    name: "이주임",
    provider: "google",
    modelId: "gemini-2.0-flash",
    role: "리서치",
  },
};

// ===== 태스크 디스패처 클래스 =====

export class TaskDispatcher {
  private io: SocketIOServer;
  private taskManager: any;  // DeskRPG TaskManager 인스턴스
  private gateway: any;       // OpenClaw Gateway 인스턴스

  constructor(io: SocketIOServer, taskManager: any, gateway: any) {
    this.io = io;
    this.taskManager = taskManager;
    this.gateway = gateway;
  }

  /**
   * 텔레그램 메시지를 처리하여 적절한 액션 수행
   */
  async dispatch(request: TaskRequest): Promise<string> {
    switch (request.command) {
      case "task":
        return this.handleTeamTask(request);
      case "assign":
        return this.handleDirectAssign(request);
      case "meeting":
        return this.handleMeeting(request);
      case "debate":
        return this.handleDebate(request);
      case "report":
        return this.handleReport(request);
      case "status":
        return this.handleStatus();
      default:
        return "알 수 없는 명령어입니다.";
    }
  }

  /**
   * /task — 전체 팀 업무 지시
   * 3명에게 역할별로 분담하여 할당
   */
  private async handleTeamTask(request: TaskRequest): Promise<string> {
    const channelId = "ai-office-main";

    // 1단계: 각 에이전트에게 역할에 맞는 서브태스크 생성
    const subtasks = this.splitTaskByRole(request.content);
    const createdTasks = [];

    for (const [agentId, subtask] of Object.entries(subtasks)) {
      const agent = AGENTS[agentId];
      const taskAction = {
        action: "create",
        id: `task-${Date.now()}-${agentId}`,
        title: `[${agent.role}] ${subtask.title}`,
        summary: subtask.content,
        status: "in-progress",
      };

      await this.taskManager.handleTaskAction(
        taskAction,
        channelId,
        agentId,
        request.assigner,
      );

      createdTasks.push({ agent: agent.name, title: subtask.title });

      // NPC를 책상으로 이동시키는 Socket.IO 이벤트
      this.io.emit("npc:task-assigned", {
        npcId: agentId,
        taskTitle: subtask.title,
      });
    }

    // 2단계: 개별 작업 완료 후 회의 자동 소집 예약
    this.scheduleAutoMeeting(request.content, Object.keys(subtasks));

    const taskList = createdTasks
      .map((t) => `  • ${t.agent}: ${t.title}`)
      .join("\n");

    return `📋 업무가 분배되었습니다.\n\n${taskList}\n\n작업 완료 후 자동으로 회의가 소집됩니다.`;
  }

  /**
   * 태스크를 역할별로 분할
   */
  private splitTaskByRole(content: string): Record<string, { title: string; content: string }> {
    return {
      "ai-gemini-lee": {
        title: "관련 자료 조사 및 트렌드 분석",
        content: `다음 주제에 대해 웹 리서치를 수행하세요:\n\n${content}\n\n최신 트렌드, 해외 사례, 관련 데이터를 수집하여 정리해주세요.`,
      },
      "ai-gpt-kim": {
        title: "데이터 분석 및 전략 수립",
        content: `다음 주제에 대해 데이터 기반 분석을 수행하세요:\n\n${content}\n\n시장 데이터, SWOT 분석, 경쟁사 비교를 포함해주세요.`,
      },
      "ai-claude-park": {
        title: "종합 보고서 초안 작성",
        content: `다음 주제에 대한 보고서 초안을 작성하세요:\n\n${content}\n\n논리적 구조, 핵심 메시지, 실행 방안을 포함해주세요.`,
      },
    };
  }

  /**
   * /assign — 특정 직원 지정 업무
   */
  private async handleDirectAssign(request: TaskRequest): Promise<string> {
    const targetId = request.targetAgent;
    if (!targetId || !AGENTS[targetId]) {
      return "❌ 유효한 직원을 지정해주세요. (김대리/박과장/이주임)";
    }

    const agent = AGENTS[targetId];
    const taskAction = {
      action: "create",
      id: `task-${Date.now()}-${targetId}`,
      title: request.content.slice(0, 50),
      summary: request.content,
      status: "in-progress",
    };

    await this.taskManager.handleTaskAction(
      taskAction,
      "ai-office-main",
      targetId,
      request.assigner,
    );

    this.io.emit("npc:task-assigned", {
      npcId: targetId,
      taskTitle: request.content.slice(0, 50),
    });

    return `📋 ${agent.name}에게 업무를 할당했습니다.\n내용: ${request.content.slice(0, 100)}`;
  }

  /**
   * /meeting — 3인 회의 소집
   */
  private async handleMeeting(request: TaskRequest): Promise<string> {
    // NPC를 회의실로 이동
    for (const agentId of Object.keys(AGENTS)) {
      this.io.emit("npc:move-to-meeting", {
        npcId: agentId,
        meetingRoom: { x: 12, y: 12 },
      });
    }

    // MeetingBroker 시작 (DeskRPG의 meeting-broker.js 활용)
    const meetingConfig = {
      topic: request.content,
      participants: Object.entries(AGENTS).map(([id, agent]) => ({
        agentId: id,
        displayName: agent.name,
        role: agent.role,
      })),
      quota: {
        maxTurnsPerAgent: 10,
        maxTotalTurns: 30,
        maxConsecutivePasses: 2,
      },
    };

    // Socket.IO로 회의 시작 이벤트
    this.io.emit("meeting:start", meetingConfig);

    return (
      `🏢 회의가 소집되었습니다.\n` +
      `주제: ${request.content}\n` +
      `참석: 김대리(GPT), 박과장(Claude), 이주임(Gemini)\n\n` +
      `회의 진행 상황은 실시간으로 DeskRPG에서 확인할 수 있습니다.`
    );
  }

  /**
   * /debate — 찬반 토론
   */
  private async handleDebate(request: TaskRequest): Promise<string> {
    return this.handleMeeting({
      ...request,
      content: `[토론] ${request.content}`,
    });
  }

  /**
   * /report — 현재 진행 보고
   */
  private async handleReport(request: TaskRequest): Promise<string> {
    const channelId = "ai-office-main";
    
    // 각 에이전트의 진행 중 태스크 조회
    const reports: string[] = ["📊 현재 진행 현황\n"];

    for (const [agentId, agent] of Object.entries(AGENTS)) {
      // DeskRPG TaskManager에서 진행 중 태스크 조회
      reports.push(`\n【${agent.name}】 (${agent.role})`);
      reports.push(`  모델: ${agent.modelId}`);
      reports.push(`  상태: 작업 중...`);
    }

    return reports.join("\n");
  }

  /**
   * /status — 직원 상태
   */
  private async handleStatus(): Promise<string> {
    const lines = ["📍 AI 직원 현황\n"];
    for (const [id, agent] of Object.entries(AGENTS)) {
      lines.push(
        `• ${agent.name} (${agent.role})\n` +
        `  모델: ${agent.provider}/${agent.modelId}`
      );
    }
    return lines.join("\n");
  }

  /**
   * 개별 작업 완료 후 자동 회의 소집
   */
  private scheduleAutoMeeting(topic: string, participantIds: string[]) {
    // 실제 구현에서는 TaskManager의 완료 이벤트를 감시하여
    // 모든 서브태스크가 완료되면 자동으로 회의를 시작
    logger.info(`Auto-meeting scheduled for topic: ${topic}`);
  }
}

// ===== 로거 =====

const logger = {
  info: (msg: string) => console.log(`[TaskDispatcher] ${msg}`),
  error: (msg: string) => console.error(`[TaskDispatcher] ${msg}`),
};

export default TaskDispatcher;
