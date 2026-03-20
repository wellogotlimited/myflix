import { notFound } from "next/navigation";
import { getMovieDetails, getContentRating } from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";
import WatchClient from "@/components/WatchClient";
import MaturityBlocked from "@/components/MaturityBlocked";

interface WatchPageProps {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ season?: string; episode?: string }>;
}

export default async function WatchPage({ params, searchParams }: WatchPageProps) {
  const { type, id } = await params;
  await searchParams;

  if (type !== "movie") notFound();

  const [movie, profile, rating] = await Promise.all([
    getMovieDetails(id),
    requireProfile(),
    getContentRating(id, "movie"),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  if (!passesMaturityFilter(rating, maturityLevel)) {
    return <MaturityBlocked title={movie.title} backdropPath={movie.backdrop_path} />;
  }

  const year = movie.release_date ? parseInt(movie.release_date.substring(0, 4), 10) : 0;

  return (
    <main className="min-h-screen bg-black">
      <WatchClient
        title={movie.title}
        media={{
          type: "movie",
          tmdbId: id,
          title: movie.title,
          releaseYear: year,
          imdbId: movie.imdb_id,
          posterPath: movie.poster_path,
          backdropPath: movie.backdrop_path,
        }}
      />
    </main>
  );
}
