import { NextRequest, NextResponse } from "next/server";
import {
  appendNetworkDebug,
  getNetworkDebugFilePath,
  resetNetworkDebugLog,
  type NetworkDebugEntry,
} from "@/lib/network-debug-server";

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as Partial<NetworkDebugEntry> & {
      action?: "append" | "reset";
    };

    if (payload.action === "reset") {
      await resetNetworkDebugLog();
      return NextResponse.json({
        ok: true,
        file: getNetworkDebugFilePath(),
      });
    }

    await appendNetworkDebug({
      ts: payload.ts ?? new Date().toISOString(),
      kind: payload.kind ?? "unknown",
      source: payload.source ?? "client",
      sessionId: payload.sessionId ?? null,
      url: payload.url,
      method: payload.method,
      status: payload.status,
      durationMs: payload.durationMs,
      finalUrl: payload.finalUrl,
      contentType: payload.contentType,
      requestHeaders: payload.requestHeaders,
      responseHeaders: payload.responseHeaders,
      message: payload.message,
      error: payload.error,
      note: payload.note,
      details: payload.details,
      snippet: payload.snippet,
    });

    return NextResponse.json({
      ok: true,
      file: getNetworkDebugFilePath(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to write debug log",
      },
      { status: 500 }
    );
  }
}
