import { Suspense } from "react";
import Hero from "@/components/Hero";
import MediaRow from "@/components/MediaRow";
import ContinueWatchingRow from "@/components/ContinueWatchingRow";
import RecommendedRow from "@/components/RecommendedRow";
import {
  getTrending,
  getPopularMovies,
  getPopularShows,
  getTopRatedMovies,
  getTopRatedShows,
  getHeroExtras,
  attachCardContext,
  getMediaType,
} from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";

export default async function Home() {
  const [
    profile,
    trendingRaw,
    popularMoviesRaw,
    popularShowsRaw,
    topMoviesRaw,
    topShowsRaw,
  ] =
    await Promise.all([
      requireProfile(),
      getTrending(),
      getPopularMovies(),
      getPopularShows(),
      getTopRatedMovies(),
      getTopRatedShows(),
    ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";

  const [
    trendingAll,
    popularMoviesAll,
    popularShowsAll,
    topMoviesAll,
    topShowsAll,
  ] = await Promise.all([
    attachCardContext(trendingRaw),
    attachCardContext(popularMoviesRaw),
    attachCardContext(popularShowsRaw),
    attachCardContext(topMoviesRaw),
    attachCardContext(topShowsRaw),
  ]);

  const filter = (items: typeof trendingAll) =>
    items.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel));

  const trending = filter(trendingAll);
  const popularMovies = filter(popularMoviesAll);
  const popularShows = filter(popularShowsAll);
  const topMovies = filter(topMoviesAll);
  const topShows = filter(topShowsAll);

  const hero = trending[0];
  const heroExtras = hero ? await getHeroExtras(hero.id, getMediaType(hero)) : null;

  return (
    <main className="min-h-screen">
      {hero && (
        <Hero
          item={hero}
          logoPath={heroExtras?.logoPath ?? null}
          trailerKey={heroExtras?.trailerKey ?? null}
        />
      )}
      <div className="relative z-10 mt-8 space-y-2 pb-16 md:mt-10">
        <Suspense fallback={null}>
          <ContinueWatchingRow />
        </Suspense>
        <Suspense fallback={null}>
          <RecommendedRow />
        </Suspense>
        <MediaRow title="Trending Now" items={trending} />
        <MediaRow title="Popular Movies" items={popularMovies} />
        <MediaRow title="Popular TV Shows" items={popularShows} />
        <MediaRow title="Top Rated Movies" items={topMovies} />
        <MediaRow title="Top Rated TV Shows" items={topShows} />
      </div>
    </main>
  );
}
