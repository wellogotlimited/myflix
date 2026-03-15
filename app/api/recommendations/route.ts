import { NextResponse } from "next/server";
import { connectToDatabase, GenreAffinityModel, WatchHistoryModel } from "@/lib/db";
import { requireProfile } from "@/lib/session";
import type { MaturityLevel } from "@/lib/maturity";

const TMDB_BASE = "https://api.themoviedb.org/3";

// TMDB certification ceiling per maturity level, for movies and TV separately.
const MOVIE_CERT: Record<MaturityLevel, string | null> = {
  KIDS: "G",
  TEEN: "PG-13",
  ADULT: null,
};
const TV_CERT: Record<MaturityLevel, string | null> = {
  KIDS: "TV-G",
  TEEN: "TV-14",
  ADULT: null,
};

async function tmdbDiscover(
  type: "movie" | "tv",
  genreId: number,
  maturityLevel: MaturityLevel
): Promise<Array<{ id: number; title?: string; name?: string; poster_path: string | null; backdrop_path: string | null; vote_average: number; genre_ids?: number[]; release_date?: string; first_air_date?: string; overview: string }>> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return [];

  const url = new URL(`${TMDB_BASE}/discover/${type}`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("with_genres", String(genreId));
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("vote_count.gte", "50");

  // Apply TMDB-side certification filter so we never return unsuitable content
  const certCeiling = type === "movie" ? MOVIE_CERT[maturityLevel] : TV_CERT[maturityLevel];
  if (certCeiling) {
    url.searchParams.set("certification_country", "US");
    url.searchParams.set("certification.lte", certCeiling);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const data = await res.json() as { results?: Array<{ id: number; title?: string; name?: string; poster_path: string | null; backdrop_path: string | null; vote_average: number; genre_ids?: number[]; release_date?: string; first_air_date?: string; overview: string }> };
  return data.results ?? [];
}

const GENRE_NAMES: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 53: "Thriller",
  10752: "War", 37: "Western", 10759: "Action & Adventure",
  10762: "Kids", 10763: "News", 10764: "Reality",
  10765: "Sci-Fi & Fantasy", 10766: "Soap", 10767: "Talk",
  10768: "War & Politics",
};

export async function GET() {
  const profile = await requireProfile();
  if (!profile) return NextResponse.json({ error: "No active profile" }, { status: 401 });

  await connectToDatabase();

  const topGenres = await GenreAffinityModel.find({ profileId: profile.profileId })
    .sort({ score: -1 })
    .limit(3)
    .lean();

  if (topGenres.length === 0) {
    return NextResponse.json([]);
  }

  const watched = await WatchHistoryModel.find({ profileId: profile.profileId })
    .select({ tmdbId: 1 })
    .lean();
  const watchedIds = new Set(watched.map((w) => w.tmdbId));

  const rows = await Promise.all(
    topGenres.map(async ({ genreId }) => {
      const [movies, shows] = await Promise.all([
        tmdbDiscover("movie", genreId, profile.maturityLevel),
        tmdbDiscover("tv", genreId, profile.maturityLevel),
      ]);

      const combined = [...movies, ...shows]
        .filter((item) => !watchedIds.has(item.id))
        .sort((a, b) => b.vote_average - a.vote_average)
        .slice(0, 20)
        .map((item) => ({
          ...item,
          media_type: item.title ? "movie" : "tv",
        }));

      return {
        title: `More ${GENRE_NAMES[genreId] ?? "like what you watch"}`,
        items: combined,
      };
    })
  );

  const nonEmpty = rows.filter((r) => r.items.length > 0);
  return NextResponse.json(nonEmpty);
}
