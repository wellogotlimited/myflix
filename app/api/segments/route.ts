import { NextResponse } from "next/server";

const TIDB_BASE = "https://api.theintrodb.org/v2";
const INTRODB_FALLBACK = "https://api.introdb.app/intro";
const EXTERNAL_FETCH_TIMEOUT_MS = 10_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get("tmdbId");
  const season = searchParams.get("season");
  const episode = searchParams.get("episode");
  const imdbId = searchParams.get("imdbId");
  const tidbApiKey = process.env.TIDB_API_KEY?.trim();

  console.log("[segments] inbound request", {
    method: request.method,
    path: requestUrl.pathname,
    search: requestUrl.search,
    query: {
      tmdbId,
      season,
      episode,
      imdbId,
      hasTidbApiKey: Boolean(tidbApiKey),
    },
    requestHeaders: pickHeaders(request.headers, [
      "host",
      "user-agent",
      "x-forwarded-for",
      "x-forwarded-host",
      "x-forwarded-proto",
      "x-real-ip",
    ]),
  });

  if (!tmdbId || !season || !episode) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Primary: TheIntroDB
  try {
    const url = `${TIDB_BASE}/media?tmdb_id=${tmdbId}&season=${season}&episode=${episode}`;
    const headers: HeadersInit = {
      accept: "application/json, text/plain;q=0.9, */*;q=0.1",
      "user-agent": "myflix/segments-fetch",
      ...(tidbApiKey ? { authorization: `Bearer ${tidbApiKey}` } : {}),
    };

    console.log("[segments] outbound request", {
      target: "theintrodb",
      url,
      method: "GET",
      cache: "no-store",
      timeoutMs: EXTERNAL_FETCH_TIMEOUT_MS,
      headers: redactAuthHeader(headers),
    });

    const res = await fetch(url, {
      cache: "no-store",
      headers,
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    });

    if (res.ok) {
      const { data, bodyPreview } = await readJsonResponse(res);
      if (data && typeof data === "object") {
        console.log("[segments] outbound response", {
          target: "theintrodb",
          url,
          status: res.status,
          responseHeaders: pickHeaders(res.headers, [
            "content-type",
            "cache-control",
            "server",
            "cf-ray",
            "cf-cache-status",
          ]),
          parsedKeys: Object.keys(data),
        });
        return NextResponse.json(data);
      }

      console.warn("[segments] TheIntroDB returned empty or invalid JSON", {
        tmdbId,
        season,
        episode,
        url,
        status: res.status,
        responseHeaders: pickHeaders(res.headers, [
          "content-type",
          "cache-control",
          "server",
          "cf-ray",
          "cf-cache-status",
        ]),
        bodyPreview,
      });
    } else {
      const bodyPreview = await res.text().then((text) => text.slice(0, 500));
      console.warn("[segments] TheIntroDB returned non-ok status", {
        tmdbId,
        season,
        episode,
        url,
        status: res.status,
        responseHeaders: pickHeaders(res.headers, [
          "content-type",
          "cache-control",
          "server",
          "cf-ray",
          "cf-cache-status",
        ]),
        bodyPreview,
      });
    }

    // 404 or 403 = fall through to fallback
    if (res.status !== 404 && res.status !== 403 && res.status !== 204) {
      return NextResponse.json({}, { status: res.status });
    }
  } catch {
    console.warn("[segments] TheIntroDB fetch threw", {
      tmdbId,
      season,
      episode,
      url: `${TIDB_BASE}/media?tmdb_id=${tmdbId}&season=${season}&episode=${episode}`,
    });
  }

  // Fallback: introdb.app (intro end-time only)
  try {
    if (imdbId) {
      const url = `${INTRODB_FALLBACK}?imdb_id=${imdbId}&season=${season}&episode=${episode}`;
      const headers = {
        accept: "application/json, text/plain;q=0.9, */*;q=0.1",
        "user-agent": "myflix/segments-fetch",
      };

      console.log("[segments] outbound request", {
        target: "introdb-fallback",
        url,
        method: "GET",
        cache: "no-store",
        timeoutMs: EXTERNAL_FETCH_TIMEOUT_MS,
        headers,
      });

      const res = await fetch(url, {
        cache: "no-store",
        headers,
        signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
      });
      if (res.ok) {
        const { data, bodyPreview } = await readJsonResponse(res);
        if (typeof data?.end_ms === "number") {
          console.log("[segments] outbound response", {
            target: "introdb-fallback",
            url,
            status: res.status,
            responseHeaders: pickHeaders(res.headers, [
              "content-type",
              "cache-control",
              "server",
              "cf-ray",
              "cf-cache-status",
            ]),
            parsedKeys: Object.keys(data),
          });
          // Shape it like a TIDB response so the hook parses it uniformly
          return NextResponse.json({
            intro: [{ start_ms: 0, end_ms: data.end_ms, confidence: null, submission_count: 1 }],
          });
        }

        console.warn("[segments] IntroDB fallback returned no usable end_ms", {
          imdbId,
          season,
          episode,
          url,
          status: res.status,
          responseHeaders: pickHeaders(res.headers, [
            "content-type",
            "cache-control",
            "server",
            "cf-ray",
            "cf-cache-status",
          ]),
          bodyPreview,
        });
      } else {
        const bodyPreview = await res.text().then((text) => text.slice(0, 500));
        console.warn("[segments] IntroDB fallback returned non-ok status", {
          imdbId,
          season,
          episode,
          url,
          status: res.status,
          responseHeaders: pickHeaders(res.headers, [
            "content-type",
            "cache-control",
            "server",
            "cf-ray",
            "cf-cache-status",
          ]),
          bodyPreview,
        });
      }
    }
  } catch {
    console.warn("[segments] IntroDB fallback fetch threw", {
      imdbId,
      season,
      episode,
      url: imdbId
        ? `${INTRODB_FALLBACK}?imdb_id=${imdbId}&season=${season}&episode=${episode}`
        : null,
    });
  }

  return NextResponse.json({});
}

function pickHeaders(headers: Headers, names: string[]) {
  const selected: Record<string, string> = {};
  for (const name of names) {
    const value = headers.get(name);
    if (value) selected[name] = value;
  }
  return selected;
}

function redactAuthHeader(headers: HeadersInit) {
  const entries = new Headers(headers);
  const redacted: Record<string, string> = {};
  for (const [key, value] of entries.entries()) {
    redacted[key] = key === "authorization" ? "Bearer [redacted]" : value;
  }
  return redacted;
}

async function readJsonResponse(res: Response) {
  const text = await res.text();
  const bodyPreview = text.slice(0, 500);
  if (!text.trim()) return { data: null, bodyPreview };

  try {
    return {
      data: JSON.parse(text) as Record<string, unknown>,
      bodyPreview,
    };
  } catch {
    return {
      data: null,
      bodyPreview,
    };
  }
}
