/**
 * report-pipeline.ts
 * 
 * 회의 결과 → 보고서 생성 → 멀티 플랫폼 전송 파이프라인.
 * DeskRPG의 MeetingBroker 완료 이벤트를 받아서:
 *   1. 회의록을 기반으로 종합 보고서 생성 (박과장/Claude가 담당)
 *   2. 텔레그램 + 슬랙 + 카카오톡으로 전송
 * 
 * server.js에서 import하여 meeting:end 이벤트에 연결.
 */

import type { Server as SocketIOServer } from "socket.io";

// ===== 타입 =====

interface MeetingTurn {
  seq: number;
  displayName: string;
  content: string;
  timestamp: number;
  agentId?: string;
}

interface MeetingParticipant {
  agentId: string;
  displayName: string;
  role: string;
}

interface MeetingEndPayload {
  channelId: string;
  meetingId: string;
  topic: string;
  participants: MeetingParticipant[];
  turns: MeetingTurn[];
  transcript: string;
  summary?: {
    keyTopics: string[];
    conclusions: string | null;
  };
}

interface ReportDeliveryResult {
  telegram: boolean;
  slack: boolean;
  kakao: boolean;
}

// ===== 보고서 생성 =====

/**
 * 회의록을 기반으로 최종 보고서를 생성.
 * 실제 운영에서는 Claude API를 호출하여 보고서를 작성하도록 함.
 */
function generateReport(payload: MeetingEndPayload): string {
  const date = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const participantList = payload.participants
    .map((p) => `${p.displayName}(${p.role})`)
    .join(", ");

  // 화자별 발언 요약
  const speakerSummaries = new Map<string, string[]>();
  for (const turn of payload.turns) {
    if (turn.displayName === "system") continue;
    const existing = speakerSummaries.get(turn.displayName) || [];
    existing.push(turn.content.slice(0, 200));
    speakerSummaries.set(turn.displayName, existing);
  }

  let summarySection = "";
  for (const [speaker, contents] of speakerSummaries) {
    summarySection += `\n【${speaker}】\n`;
    for (const c of contents) {
      summarySection += `  ${c}\n`;
    }
  }

  // 결론 추출 (마지막 2~3턴에서)
  const lastTurns = payload.turns.slice(-3);
  const conclusionText = lastTurns
    .map((t) => `${t.displayName}: ${t.content.slice(0, 150)}`)
    .join("\n");

  const report = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 회의 보고서
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 일시: ${date}
🏷️ 주제: ${payload.topic}
👥 참석자: ${participantList}
💬 총 발언: ${payload.turns.length}회

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 주요 논의 내용
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${summarySection}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 결론 및 합의사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${conclusionText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 후속 조치
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
회의 결과에 따른 후속 태스크가 자동 생성됩니다.
전체 회의록은 DeskRPG에서 확인 가능합니다.
`.trim();

  return report;
}

/**
 * Claude API를 사용하여 고품질 보고서 생성 (옵션).
 * 실제 운영 시 이 함수를 사용.
 */
async function generateReportWithClaude(
  payload: MeetingEndPayload,
  apiKey: string,
): Promise<string> {
  const prompt = `당신은 "박과장"입니다. 7년차 과장으로 보고서 작성 전문가입니다.
아래 회의록을 바탕으로 간결하고 구조적인 보고서를 한국어로 작성하세요.

주제: ${payload.topic}
참석자: ${payload.participants.map((p) => `${p.displayName}(${p.role})`).join(", ")}

회의록:
${payload.turns.map((t) => `[${t.displayName}] ${t.content}`).join("\n\n")}

---
보고서 형식:
1. 핵심 요약 (3줄 이내)
2. 주요 논의 사항
3. 합의 사항 및 결론
4. 후속 액션 아이템

보고서를 작성하세요:`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json() as { content: Array<{ text: string }> };
    return data.content[0]?.text || generateReport(payload);
  } catch (error) {
    console.error("[ReportPipeline] Claude API error:", error);
    return generateReport(payload); // fallback
  }
}

// ===== 멀티 플랫폼 전송 =====

/**
 * 텔레그램으로 보고서 전송.
 * Hermes Agent Gateway의 send_message_tool을 통해 전송.
 */
async function sendToTelegram(
  report: string,
  botToken: string,
  chatId: string,
): Promise<boolean> {
  try {
    // 텔레그램 메시지 길이 제한 (4096자)
    const chunks = splitMessage(report, 4000);

    for (const chunk of chunks) {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: chunk,
            parse_mode: "Markdown",
          }),
        },
      );

      if (!response.ok) {
        console.error("[Telegram] Send failed:", await response.text());
        return false;
      }
    }

    console.log("[ReportPipeline] Telegram 전송 성공");
    return true;
  } catch (error) {
    console.error("[ReportPipeline] Telegram error:", error);
    return false;
  }
}

/**
 * 슬랙으로 보고서 전송.
 */
async function sendToSlack(
  report: string,
  botToken: string,
  channel: string,
): Promise<boolean> {
  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${botToken}`,
      },
      body: JSON.stringify({
        channel,
        text: report,
        unfurl_links: false,
      }),
    });

    const data = await response.json() as { ok: boolean; error?: string };
    if (!data.ok) {
      console.error("[Slack] Send failed:", data.error);
      return false;
    }

    console.log("[ReportPipeline] Slack 전송 성공");
    return true;
  } catch (error) {
    console.error("[ReportPipeline] Slack error:", error);
    return false;
  }
}

/**
 * 카카오톡으로 보고서 전송 (macOS, kmsg CLI).
 */
async function sendToKakao(
  report: string,
  chatRoom: string,
): Promise<boolean> {
  if (process.platform !== "darwin") {
    console.log("[ReportPipeline] 카카오톡은 macOS에서만 지원됩니다.");
    return false;
  }

  try {
    const { execSync } = await import("child_process");

    // 긴 메시지는 분할
    const chunks = splitMessage(report, 3000);

    for (const chunk of chunks) {
      execSync(`kmsg send "${chatRoom}" "${chunk.replace(/"/g, '\\"')}"`, {
        timeout: 30000,
      });
    }

    console.log("[ReportPipeline] 카카오톡 전송 성공");
    return true;
  } catch (error) {
    console.error("[ReportPipeline] KakaoTalk error:", error);
    return false;
  }
}

// ===== 유틸 =====

function splitMessage(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // 줄바꿈 기준으로 자르기
    let splitAt = remaining.lastIndexOf("\n", maxLength);
    if (splitAt === -1 || splitAt < maxLength * 0.5) {
      splitAt = maxLength;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}

// ===== 파이프라인 메인 =====

export class ReportPipeline {
  private io: SocketIOServer;

  constructor(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * DeskRPG server.js에서 호출.
   * meeting:end 이벤트에 연결하여 자동 보고서 생성 + 전송.
   */
  async onMeetingEnd(payload: MeetingEndPayload): Promise<ReportDeliveryResult> {
    console.log(`[ReportPipeline] 회의 종료: ${payload.topic}`);
    console.log(`[ReportPipeline] 총 ${payload.turns.length}턴 기록됨`);

    // 1단계: 보고서 생성
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    let report: string;

    if (anthropicKey) {
      console.log("[ReportPipeline] Claude를 사용하여 보고서 생성 중...");
      report = await generateReportWithClaude(payload, anthropicKey);
    } else {
      report = generateReport(payload);
    }

    // DeskRPG UI에 보고서 표시
    this.io.to(payload.channelId).emit("report:ready", {
      meetingId: payload.meetingId,
      topic: payload.topic,
      report,
      timestamp: Date.now(),
    });

    // 2단계: 멀티 플랫폼 전송
    const results: ReportDeliveryResult = {
      telegram: false,
      slack: false,
      kakao: false,
    };

    // 텔레그램
    const tgToken = process.env.TELEGRAM_BOT_TOKEN;
    const tgChat = process.env.TELEGRAM_ALLOWED_USERS;
    if (tgToken && tgChat) {
      results.telegram = await sendToTelegram(report, tgToken, tgChat);
    }

    // 슬랙
    const slackToken = process.env.SLACK_BOT_TOKEN;
    const slackChannel = process.env.SLACK_REPORT_CHANNEL;
    if (slackToken && slackChannel) {
      results.slack = await sendToSlack(report, slackToken, slackChannel);
    }

    // 카카오톡
    const kakaoEnabled = process.env.KAKAO_ENABLED === "true";
    const kakaoChatRoom = process.env.KAKAO_CHAT_ROOM;
    if (kakaoEnabled && kakaoChatRoom) {
      results.kakao = await sendToKakao(report, kakaoChatRoom);
    }

    // 전송 결과 로깅
    console.log("[ReportPipeline] 전송 결과:", results);

    // DeskRPG UI에 전송 결과 알림
    this.io.to(payload.channelId).emit("report:delivered", {
      meetingId: payload.meetingId,
      results,
      timestamp: Date.now(),
    });

    return results;
  }
}

export default ReportPipeline;

// ===== 독립 실행용 (commonjs export) =====
// server.js에서 require()로 사용 시:
// const { ReportPipeline } = require("./report-pipeline");
