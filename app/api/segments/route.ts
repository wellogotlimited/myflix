import { NextResponse } from "next/server";

const TIDB_BASE = "https://api.theintrodb.org/v2";
const INTRODB_FALLBACK = "https://api.introdb.app/intro";
const EXTERNAL_FETCH_TIMEOUT_MS = 10_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get("tmdbId");
  const season = searchParams.get("season");
  const episode = searchParams.get("episode");

  if (!tmdbId || !season || !episode) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  // Primary: TheIntroDB
  try {
    const url = `${TIDB_BASE}/media?tmdb_id=${tmdbId}&season=${season}&episode=${episode}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json, text/plain;q=0.9, */*;q=0.1",
        "user-agent": "myflix/segments-fetch",
      },
      signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
    });

    if (res.ok) {
      const data = await readJsonResponse(res);
      if (data && typeof data === "object") {
        return NextResponse.json(data);
      }
    }

    // 404 or 403 = fall through to fallback
    if (res.status !== 404 && res.status !== 403 && res.status !== 204) {
      return NextResponse.json({}, { status: res.status });
    }
  } catch {
    // network error, try fallback
  }

  // Fallback: introdb.app (intro end-time only)
  try {
    const imdbId = searchParams.get("imdbId");
    if (imdbId) {
      const url = `${INTRODB_FALLBACK}?imdb_id=${imdbId}&season=${season}&episode=${episode}`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          accept: "application/json, text/plain;q=0.9, */*;q=0.1",
          "user-agent": "myflix/segments-fetch",
        },
        signal: AbortSignal.timeout(EXTERNAL_FETCH_TIMEOUT_MS),
      });
      if (res.ok) {
        const data = await readJsonResponse(res);
        if (typeof data?.end_ms === "number") {
          // Shape it like a TIDB response so the hook parses it uniformly
          return NextResponse.json({
            intro: [{ start_ms: 0, end_ms: data.end_ms, confidence: null, submission_count: 1 }],
          });
        }
      }
    }
  } catch {
    // nothing
  }

  return NextResponse.json({});
}

async function readJsonResponse(res: Response) {
  const text = await res.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}
