// /api/office/status — 운영 상태 헬스 체크 (포트 + 봇 토큰 설정 여부)

import { NextRequest, NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";

const execAsync = promisify(exec);

async function portUp(port: number): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`lsof -ti :${port}`, { timeout: 3000 });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

function hasEnv(name: string, placeholder: string = ""): boolean {
  const v = process.env[name];
  if (!v) return false;
  if (placeholder && v.startsWith(placeholder)) return false;
  if (v === "" || v.includes("xxxx") || v.includes("123456:ABC")) return false;
  return true;
}

export async function GET(_req: NextRequest) {
  const [deskrpg, trigger, openclaw] = await Promise.all([
    portUp(3000),
    portUp(13000),
    portUp(18789),
  ]);

  const firestore = (() => {
    const p = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    return !!(p && fs.existsSync(p));
  })();

  return NextResponse.json({
    deskrpg,
    trigger,
    openclaw,
    telegram: hasEnv("TELEGRAM_BOT_TOKEN", "123456:"),
    slack: hasEnv("SLACK_BOT_TOKEN", "xoxb-xxxx"),
    discord: hasEnv("DISCORD_BOT_TOKEN", "Discord-Bot-"),
    firestore,
  });
}
