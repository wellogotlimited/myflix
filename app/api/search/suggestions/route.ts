import { NextRequest, NextResponse } from "next/server";
import { RecentSearchModel, connectToDatabase } from "@/lib/db";
import { requireProfile } from "@/lib/session";

const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdbSearch(path: string, params: Record<string, string>) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return [];
  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: Array<Record<string, unknown>> };
  return data.results ?? [];
}

export async function GET(request: NextRequest) {
  const session = await requireProfile();
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  await connectToDatabase();
  const recent = await RecentSearchModel.find({ profileId: session.profileId })
    .sort({ lastUsedAt: -1 })
    .limit(6)
    .lean();

  const trending = ["Sci-Fi thrillers", "Anime action", "Mystery series", "Award winners"];

  if (!query) {
    return NextResponse.json({
      recent: recent.map((item) => item.query),
      trending,
      titles: [],
      collections: [],
    });
  }

  const [multiResults, collectionResults] = await Promise.all([
    tmdbSearch("/search/multi", { query }),
    tmdbSearch("/search/collection", { query }),
  ]);

  return NextResponse.json({
    recent: recent
      .map((item) => item.query)
      .filter((item) => item.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 4),
    trending,
    titles: multiResults
      .filter((item) => item.media_type === "movie" || item.media_type === "tv")
      .slice(0, 6),
    collections: collectionResults.slice(0, 5),
  });
}
