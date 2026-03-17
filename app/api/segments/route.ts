import { NextResponse } from "next/server";

const TIDB_BASE = "https://api.theintrodb.org/v2";
const INTRODB_FALLBACK = "https://api.introdb.app/intro";

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
    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (res.ok) {
      const data = await res.json();
      return NextResponse.json(data);
    }

    // 404 or 403 = fall through to fallback
    if (res.status !== 404 && res.status !== 403) {
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
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (res.ok) {
        const data = await res.json();
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
