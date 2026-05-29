// /api/reports/files?channelId=... — list past report files
import { NextRequest, NextResponse } from "next/server";
import { listReportFiles } from "@/lib/scheduled-reports";

export async function GET(req: NextRequest) {
  if (!req.headers.get("x-user-id")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
  return NextResponse.json({ files: listReportFiles(channelId) });
}
