// /api/reports/config?channelId=... — per-channel scheduled-report config
// GET  → ReportConfig
// POST → update (partial)

import { NextRequest, NextResponse } from "next/server";
import { readConfig, writeConfig } from "@/lib/scheduled-reports";

function getUserId(req: NextRequest): string | null {
  return req.headers.get("x-user-id");
}

export async function GET(req: NextRequest) {
  if (!getUserId(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });
  return NextResponse.json(readConfig(channelId));
}

export async function POST(req: NextRequest) {
  if (!getUserId(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ error: "channelId required" }, { status: 400 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
  if (typeof body.time === "string" && /^\d{2}:\d{2}$/.test(body.time)) updates.time = body.time;
  if (typeof body.timezone === "string" && body.timezone.length < 64) updates.timezone = body.timezone;

  const merged = writeConfig(channelId, updates);
  return NextResponse.json(merged);
}
