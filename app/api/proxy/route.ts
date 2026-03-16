import { NextRequest, NextResponse } from "next/server";
import { appendNetworkDebug } from "@/lib/network-debug-server";

const HEADER_MAP: Record<string, string> = {
  "x-cookie": "cookie",
  "x-referer": "referer",
  "x-origin": "origin",
  "x-user-agent": "user-agent",
  "user-agent": "user-agent",
  "x-x-real-ip": "x-real-ip",
  range: "range",
  accept: "accept",
  "accept-language": "accept-language",
  "cache-control": "cache-control",
  "if-none-match": "if-none-match",
  "if-modified-since": "if-modified-since",
};

const RESPONSE_HEADER_ALLOWLIST = [
  "accept-ranges",
  "cache-control",
  "content-disposition",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "expires",
  "last-modified",
] as const;

export async function GET(req: NextRequest) {
  return handleProxy(req);
}

export async function HEAD(req: NextRequest) {
  return handleProxy(req);
}

export async function POST(req: NextRequest) {
  return handleProxy(req);
}

async function handleProxy(req: NextRequest) {
  const payloadParam = req.nextUrl.searchParams.get("payload");
  const payload = decodePayload(payloadParam);
  const destination = payload?.url ?? req.nextUrl.searchParams.get("destination");
  const debugSessionId = payload?.debugSessionId ?? null;
  if (!destination) {
    return NextResponse.json({ error: "Missing destination" }, { status: 400 });
  }

  try {
    const startedAt = Date.now();
    const headers: Record<string, string> = normalizeHeaderRecord(payload?.headers ?? {});
    req.headers.forEach((value, key) => {
      const mapped = HEADER_MAP[key.toLowerCase()];
      if (mapped) {
        headers[mapped] = value;
      }
    });

    const method = req.method === "HEAD" ? "HEAD" : req.method;
    const body = method === "POST" ? await req.text() : undefined;

    const response = await fetch(destination, {
      method,
      headers,
      body,
      redirect: "follow",
      cache: "no-store",
    });

    if (payload?.type === "hls" || shouldRewriteHls(response, destination)) {
      const buffer = await response.arrayBuffer().catch(() => null);
      if (buffer !== null) {
        const text = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
        if (looksLikeHlsPlaylist(text, response, destination)) {
          const playlistBaseUrl = response.url || destination;
          const playlist = rewriteHlsPlaylist(
            text,
            playlistBaseUrl,
            payload?.headers ?? {},
            payload?.debugSessionId
          );
          await logProxyRequest({
            sessionId: debugSessionId,
            method,
            destination,
            finalUrl: response.url,
            status: response.status,
            durationMs: Date.now() - startedAt,
            requestHeaders: sanitizeHeaders(headers),
            responseHeaders: pickResponseHeaders(response.headers),
            contentType: response.headers.get("content-type"),
            note: "rewrote-hls-playlist",
            snippet: text.slice(0, 1200),
          });
          const resHeaders = new Headers({
            "content-type":
              response.headers.get("content-type") || "application/vnd.apple.mpegurl",
            "cache-control": "no-store, no-cache, must-revalidate",
            pragma: "no-cache",
            expires: "0",
            "X-Final-Destination": response.url,
          });
          return new NextResponse(playlist, {
            status: response.status,
            headers: resHeaders,
          });
        }
        // Body already consumed — return buffer directly
        await logProxyRequest({
          sessionId: debugSessionId,
          method,
          destination,
          finalUrl: response.url,
          status: response.status,
          durationMs: Date.now() - startedAt,
          requestHeaders: sanitizeHeaders(headers),
          responseHeaders: pickResponseHeaders(response.headers),
          contentType: response.headers.get("content-type"),
          note: "returned-buffer-body",
        });
        const resHeaders = new Headers({
          "cache-control": "no-store, no-cache, must-revalidate",
          pragma: "no-cache",
          expires: "0",
          "X-Final-Destination": response.url,
        });
        for (const header of RESPONSE_HEADER_ALLOWLIST) {
          const value = response.headers.get(header);
          if (value) resHeaders.set(header, value);
        }
        return new NextResponse(buffer, { status: response.status, headers: resHeaders });
      }
    }

    await logProxyRequest({
      sessionId: debugSessionId,
      method,
      destination,
      finalUrl: response.url,
      status: response.status,
      durationMs: Date.now() - startedAt,
      requestHeaders: sanitizeHeaders(headers),
      responseHeaders: pickResponseHeaders(response.headers),
      contentType: response.headers.get("content-type"),
    });
    const resHeaders = new Headers({
      "cache-control": "no-store, no-cache, must-revalidate",
      pragma: "no-cache",
      expires: "0",
      "X-Final-Destination": response.url,
    });
    for (const header of RESPONSE_HEADER_ALLOWLIST) {
      const value = response.headers.get(header);
      if (value) {
        resHeaders.set(header, value);
      }
    }

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      resHeaders.set("X-Set-Cookie", setCookie);
    }

    return new NextResponse(method === "HEAD" ? null : response.body, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy error";
    await logProxyRequest({
      sessionId: debugSessionId,
      method: req.method,
      destination,
      durationMs: 0,
      requestHeaders: sanitizeHeaders(payload?.headers ?? {}),
      error: message,
      note: "proxy-exception",
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type ProxyPayload = {
  url: string;
  type?: "hls" | "mp4";
  headers?: Record<string, string>;
  debugSessionId?: string;
  options?: {
    depth?: number;
  };
};

function decodePayload(payloadParam: string | null): ProxyPayload | null {
  if (!payloadParam) return null;

  try {
    const decoded = Buffer.from(payloadParam, "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as ProxyPayload;
    if (!payload?.url) return null;
    return payload;
  } catch {
    return null;
  }
}

function shouldRewriteHls(response: Response, destination: string) {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  return (
    contentType.includes("mpegurl") ||
    contentType.includes("application/x-mpegurl") ||
    contentType.includes("audio/mpegurl") ||
    destination.toLowerCase().includes(".m3u8")
  );
}

function looksLikeHlsPlaylist(
  body: string,
  response: Response,
  destination: string
) {
  const trimmed = body.trim();
  // Body content check ALWAYS takes priority — if it starts with HTML tags it's not HLS
  if (trimmed.startsWith("<") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return false;
  }
  const bodyLooksLikeHls =
    trimmed.startsWith("#EXTM3U") ||
    trimmed.includes("#EXT-X-") ||
    trimmed.includes("#EXTINF:");
  if (!bodyLooksLikeHls) return false;
  return shouldRewriteHls(response, destination) || bodyLooksLikeHls;
}

function rewriteHlsPlaylist(
  playlist: string,
  destination: string,
  headers: Record<string, string>,
  debugSessionId?: string
) {
  const lines = playlist.split(/\r?\n/);
  const rewritten: string[] = [];
  let expectVariantPlaylist = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const rewrittenLine = rewriteHlsLine(
      line,
      destination,
      headers,
      expectVariantPlaylist,
      debugSessionId
    );
    rewritten.push(rewrittenLine);

    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith("#EXT-X-STREAM-INF")) {
      expectVariantPlaylist = true;
      continue;
    }

    if (!trimmed.startsWith("#")) {
      expectVariantPlaylist = false;
    }
  }

  return rewritten.join("\n");
}

function rewriteHlsLine(
  line: string,
  destination: string,
  headers: Record<string, string>,
  expectVariantPlaylist = false,
  debugSessionId?: string
) {
  const trimmed = line.trim();
  if (!trimmed) return line;

  if (!trimmed.startsWith("#")) {
    const resolved = resolvePlaylistUrl(destination, trimmed);
    const entryType = expectVariantPlaylist ? "hls" : inferPlaylistEntryType(resolved);
    const effectiveHeaders = getForwardedHeadersForPlaylistEntry(resolved, headers);
    const shouldForceProxy = shouldForceProxyPlaylistEntry(resolved);
    if (
      shouldForceProxy ||
      Object.keys(effectiveHeaders).length > 0 ||
      entryType === "hls"
    ) {
      return createPayloadProxyUrl(
        resolved,
        effectiveHeaders,
        entryType,
        debugSessionId
      );
    }
    return resolved;
  }

  if (trimmed.includes('URI="')) {
    return line.replace(/URI="([^"]+)"/g, (_match, url) => {
      const resolved = resolvePlaylistUrl(destination, url);
      const effectiveHeaders = getForwardedHeadersForPlaylistEntry(resolved, headers);
      const shouldForceProxy = shouldForceProxyPlaylistEntry(resolved);
      if (isLikelyHlsPlaylistUrl(resolved)) {
        return `URI="${createPayloadProxyUrl(
          resolved,
          effectiveHeaders,
          "hls",
          debugSessionId
        )}"`;
      }
      if (shouldForceProxy || Object.keys(effectiveHeaders).length > 0) {
        return `URI="${createPayloadProxyUrl(
          resolved,
          effectiveHeaders,
          undefined,
          debugSessionId
        )}"`;
      }
      return `URI="${resolved}"`;
    });
  }

  return line;
}

function resolvePlaylistUrl(base: string, value: string) {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

function createPayloadProxyUrl(
  url: string,
  headers: Record<string, string>,
  type?: "hls" | "mp4",
  debugSessionId?: string
) {
  const payload: ProxyPayload = {
    url,
    headers,
    debugSessionId,
  };
  if (type) {
    payload.type = type;
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `/api/proxy?payload=${encoded}`;
}

function shouldForceProxyPlaylistEntry(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.has("headers") ||
      parsed.searchParams.has("preferredHeaders")
    );
  } catch {
    return false;
  }
}

function getForwardedHeadersForPlaylistEntry(
  url: string,
  inheritedHeaders: Record<string, string>
) {
  return normalizeHeaderRecord(inheritedHeaders);
}

function isLikelyHlsPlaylistUrl(url: string) {
  return /\.m3u8($|[?#])/i.test(url);
}

function inferPlaylistEntryType(url: string): "hls" | undefined {
  if (isLikelyHlsPlaylistUrl(url)) return "hls";

  const path = getPathname(url).toLowerCase();
  const mediaSegmentPattern =
    /\.(ts|m4s|m4v|mp4|m4a|aac|mp3|vtt|webvtt|jpg|jpeg|png|gif|webp|key)($|[?#])/i;

  if (mediaSegmentPattern.test(path)) {
    return undefined;
  }

  const extensionMatch = path.match(/\.([a-z0-9]+)($|[?#])/i);
  if (!extensionMatch) {
    return "hls";
  }

  return undefined;
}

function getPathname(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

async function logProxyRequest({
  sessionId,
  method,
  destination,
  finalUrl,
  status,
  durationMs,
  requestHeaders,
  responseHeaders,
  contentType,
  note,
  error,
  snippet,
}: {
  sessionId: string | null;
  method: string;
  destination: string;
  finalUrl?: string;
  status?: number;
  durationMs: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  contentType?: string | null;
  note?: string;
  error?: string;
  snippet?: string;
}) {
  if (!sessionId) return;

  await appendNetworkDebug({
    ts: new Date().toISOString(),
    kind: "proxy-request",
    source: "proxy",
    sessionId,
    method,
    url: destination,
    finalUrl,
    status,
    durationMs,
    requestHeaders,
    responseHeaders,
    contentType,
    note,
    error,
    snippet,
  });
}

function sanitizeHeaders(headers: Record<string, string>) {
  const output = { ...headers };
  if (output.cookie) output.cookie = "[redacted]";
  return Object.keys(output).length > 0 ? output : undefined;
}

function normalizeHeaderRecord(headers: Record<string, string>) {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!value) continue;
    normalized[key.toLowerCase()] = value;
  }
  return normalized;
}

function pickResponseHeaders(headers: Headers) {
  const picked: Record<string, string> = {};
  for (const name of [
    "content-type",
    "content-length",
    "cache-control",
    "content-range",
    "accept-ranges",
  ]) {
    const value = headers.get(name);
    if (value) picked[name] = value;
  }
  return Object.keys(picked).length > 0 ? picked : undefined;
}
