import { notFound } from "next/navigation";
import { getMovieDetails, getSeasonEpisodes, getShowDetails, getContentRating } from "@/lib/tmdb";
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
  const sp = await searchParams;

  if (type !== "movie" && type !== "tv") notFound();

  if (type === "movie") {
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

  const [show, profile, rating] = await Promise.all([
    getShowDetails(id),
    requireProfile(),
    getContentRating(id, "tv"),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  if (!passesMaturityFilter(rating, maturityLevel)) {
    return <MaturityBlocked title={show.name} backdropPath={show.backdrop_path} />;
  }

  const year = show.first_air_date ? parseInt(show.first_air_date.substring(0, 4), 10) : 0;
  const seasonNum = sp.season ? parseInt(sp.season, 10) : 1;
  const episodeNum = sp.episode ? parseInt(sp.episode, 10) : 1;

  const validSeasons = show.seasons.filter((season) => season.season_number > 0);
  const currentSeason =
    validSeasons.find((season) => season.season_number === seasonNum) || validSeasons[0];

  const episodes = await getSeasonEpisodes(id, currentSeason.season_number);
  const currentEpisode =
    episodes.find((episode) => episode.episode_number === episodeNum) || episodes[0];

  return (
    <main className="min-h-screen bg-black">
      <WatchClient
        title={`${show.name} - S${currentSeason.season_number} E${currentEpisode.episode_number}`}
        media={{
          type: "show",
          tmdbId: id,
          title: show.name,
          releaseYear: year,
          imdbId: show.external_ids?.imdb_id,
          posterPath: show.poster_path,
          backdropPath: show.backdrop_path,
          season: {
            number: currentSeason.season_number,
            tmdbId: String(currentSeason.id),
            title: currentSeason.name,
          },
          episode: {
            number: currentEpisode.episode_number,
            tmdbId: String(currentEpisode.id),
            title: currentEpisode.name,
            overview: currentEpisode.overview,
          },
        }}
        showNavigation={{
          showId: id,
          type,
          seasons: validSeasons,
          episodes,
          currentSeason: currentSeason.season_number,
          currentEpisode: currentEpisode.episode_number,
        }}
      />
    </main>
  );
}
