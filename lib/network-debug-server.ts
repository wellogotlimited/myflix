import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type NetworkDebugEntry = {
  ts: string;
  kind: string;
  sessionId?: string | null;
  source: "client" | "proxy" | "player";
  url?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  finalUrl?: string;
  contentType?: string | null;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  message?: string;
  error?: string;
  note?: string;
  details?: Record<string, unknown>;
  snippet?: string;
};

const DEBUG_DIR = path.join(process.cwd(), "debug");
const DEBUG_FILE = path.join(DEBUG_DIR, "network-debug.ndjson");

export async function appendNetworkDebug(entry: NetworkDebugEntry) {
  await mkdir(DEBUG_DIR, { recursive: true });
  await appendFile(DEBUG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
}

export async function resetNetworkDebugLog() {
  await mkdir(DEBUG_DIR, { recursive: true });
  await writeFile(DEBUG_FILE, "", "utf8");
}

export function getNetworkDebugFilePath() {
  return DEBUG_FILE;
}
