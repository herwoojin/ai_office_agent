// /api/reports/run-now — manually trigger a scheduled report for a channel
import { NextRequest, NextResponse } from "next/server";
import { runScheduledReport } from "@/lib/scheduled-reports";

export async function POST(req: NextRequest) {
  if (!req.headers.get("x-user-id")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const channelId = (body as { channelId?: string }).channelId
    || req.nextUrl.searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });

  const result = await runScheduledReport(channelId);
  return NextResponse.json(result);
}
