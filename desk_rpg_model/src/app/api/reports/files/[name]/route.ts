// /api/reports/files/{name}?channelId=... — download a specific report file
import { NextRequest, NextResponse } from "next/server";
import { readReportFile } from "@/lib/scheduled-reports";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  if (!req.headers.get("x-user-id")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
  const { name } = await params;
  const body = readReportFile(channelId, name);
  if (body == null) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
    },
  });
}
