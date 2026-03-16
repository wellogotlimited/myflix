"use client";

type NetworkDebugSource = "client" | "player";

type NetworkDebugPayload = {
  ts?: string;
  kind: string;
  source: NetworkDebugSource;
  sessionId?: string | null;
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
  action?: "append" | "reset";
};

type DebugState = {
  refCount: number;
  originalFetch: typeof window.fetch;
  originalXhrOpen: typeof XMLHttpRequest.prototype.open;
  originalXhrSend: typeof XMLHttpRequest.prototype.send;
  originalXhrSetRequestHeader: typeof XMLHttpRequest.prototype.setRequestHeader;
};

declare global {
  interface Window {
    __MYFLIX_NETWORK_DEBUG__?: DebugState;
  }

  interface XMLHttpRequest {
    __myflixDebugMeta__?: {
      method?: string;
      url?: string;
      requestHeaders?: Record<string, string>;
      startedAt?: number;
    };
  }
}

const DEBUG_ROUTE = "/api/debug/network";

export function createDebugSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `debug-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function resetNetworkDebug(sessionId: string) {
  await postDebugPayload({
    action: "reset",
    kind: "session-reset",
    source: "client",
    sessionId,
  });

  await postDebugPayload({
    kind: "session-start",
    source: "client",
    sessionId,
    message: "Developer-mode network capture started",
  });
}

export function enableNetworkDebugCapture(sessionId: string) {
  if (typeof window === "undefined") return () => {};

  const existing = window.__MYFLIX_NETWORK_DEBUG__;
  if (existing) {
    existing.refCount += 1;
    return () => releaseNetworkDebugCapture();
  }

  const originalFetch = window.fetch.bind(window);
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;
  const originalXhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const url = getFetchUrl(input);
    if (shouldIgnoreUrl(url)) {
      return originalFetch(input, init);
    }

    const startedAt = performance.now();
    try {
      const response = await originalFetch(input, init);
      queueDebugPayload(originalFetch, {
        kind: "fetch",
        source: "client",
        sessionId,
        method,
        url,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
        finalUrl: response.url,
        contentType: response.headers.get("content-type"),
        requestHeaders: serializeHeaders(init?.headers ?? (input instanceof Request ? input.headers : undefined)),
        responseHeaders: pickHeaders(response.headers),
      });
      return response;
    } catch (error) {
      queueDebugPayload(originalFetch, {
        kind: "fetch-error",
        source: "client",
        sessionId,
        method,
        url,
        durationMs: Math.round(performance.now() - startedAt),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  XMLHttpRequest.prototype.open = function patchedOpen(
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    this.__myflixDebugMeta__ = {
      method,
      url: String(url),
      requestHeaders: {},
    };
    return originalXhrOpen.call(this, method, url, async ?? true, username, password);
  };

  XMLHttpRequest.prototype.setRequestHeader = function patchedSetRequestHeader(name: string, value: string) {
    if (this.__myflixDebugMeta__) {
      this.__myflixDebugMeta__.requestHeaders ??= {};
      this.__myflixDebugMeta__.requestHeaders[name] = value;
    }
    return originalXhrSetRequestHeader.call(this, name, value);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null) {
    const meta = this.__myflixDebugMeta__;
    if (!meta || shouldIgnoreUrl(meta.url)) {
      return originalXhrSend.call(this, body);
    }

    meta.startedAt = performance.now();

    const finalize = (kind: "xhr" | "xhr-error") => {
      const durationMs = Math.round(performance.now() - (meta.startedAt ?? performance.now()));
      queueDebugPayload(originalFetch, {
        kind,
        source: "client",
        sessionId,
        method: meta.method,
        url: meta.url,
        status: kind === "xhr" ? this.status : undefined,
        durationMs,
        finalUrl: this.responseURL,
        contentType: this.getResponseHeader("content-type"),
        requestHeaders: meta.requestHeaders,
        responseHeaders: parseRawHeaders(this.getAllResponseHeaders()),
        note:
          body && typeof body !== "string"
            ? `body:${body.constructor?.name ?? "unknown"}`
            : typeof body === "string"
              ? `body-length:${body.length}`
              : undefined,
      });
    };

    this.addEventListener("loadend", () => finalize("xhr"), { once: true });
    this.addEventListener("error", () => finalize("xhr-error"), { once: true });

    return originalXhrSend.call(this, body);
  };

  window.__MYFLIX_NETWORK_DEBUG__ = {
    refCount: 1,
    originalFetch,
    originalXhrOpen,
    originalXhrSend,
    originalXhrSetRequestHeader,
  };

  return () => releaseNetworkDebugCapture();
}

export function sendDebugEvent(sessionId: string | undefined, payload: Omit<NetworkDebugPayload, "sessionId">) {
  if (!sessionId || typeof window === "undefined") return;
  const originalFetch =
    window.__MYFLIX_NETWORK_DEBUG__?.originalFetch ?? window.fetch.bind(window);

  queueDebugPayload(originalFetch, {
    ...payload,
    sessionId,
  });
}

function releaseNetworkDebugCapture() {
  if (typeof window === "undefined") return;
  const state = window.__MYFLIX_NETWORK_DEBUG__;
  if (!state) return;

  state.refCount -= 1;
  if (state.refCount > 0) return;

  window.fetch = state.originalFetch;
  XMLHttpRequest.prototype.open = state.originalXhrOpen;
  XMLHttpRequest.prototype.send = state.originalXhrSend;
  XMLHttpRequest.prototype.setRequestHeader = state.originalXhrSetRequestHeader;
  delete window.__MYFLIX_NETWORK_DEBUG__;
}

function queueDebugPayload(originalFetch: typeof window.fetch, payload: NetworkDebugPayload) {
  void postDebugPayload(payload, originalFetch);
}

async function postDebugPayload(
  payload: NetworkDebugPayload,
  originalFetch?: typeof window.fetch
) {
  const fetchImpl =
    originalFetch ??
    (typeof window !== "undefined"
      ? window.__MYFLIX_NETWORK_DEBUG__?.originalFetch ?? window.fetch.bind(window)
      : fetch);

  try {
    await fetchImpl(DEBUG_ROUTE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ts: payload.ts ?? new Date().toISOString(),
        ...payload,
      }),
      keepalive: true,
    });
  } catch {
    // Best-effort debug logging only.
  }
}

function shouldIgnoreUrl(url?: string) {
  return !url || url.includes(DEBUG_ROUTE);
}

function getFetchUrl(input: RequestInfo | URL) {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function serializeHeaders(headers?: HeadersInit | undefined) {
  if (!headers) return undefined;
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return headers;
}

function pickHeaders(headers: Headers) {
  const picked: Record<string, string> = {};
  for (const name of ["content-type", "content-length", "cache-control", "x-final-destination"]) {
    const value = headers.get(name);
    if (value) picked[name] = value;
  }
  return Object.keys(picked).length > 0 ? picked : undefined;
}

function parseRawHeaders(raw: string) {
  const headers: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}
