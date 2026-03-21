export const dynamic = "force-dynamic";

import { Suspense } from "react";
import Image from "next/image";
import Hero from "@/components/Hero";
import MediaRow from "@/components/MediaRow";
import ContinueWatchingRow from "@/components/ContinueWatchingRow";
import RecommendedRow from "@/components/RecommendedRow";
import MobileHeader from "@/components/mobile/MobileHeader";
import MobileHero from "@/components/mobile/MobileHero";
import FilterPills from "@/components/mobile/FilterPills";
import {
  getTrending,
  getPopularMovies,
  getPopularShows,
  getTopRatedMovies,
  getTopRatedShows,
  getGenreItems,
  getHeroExtras,
  getTop10Trending,
  getNewThisWeek,
  attachCardContext,
  getMediaType,
  posterUrl,
} from "@/lib/tmdb";
import MoodRows from "@/components/MoodRows";
import Top10Row from "@/components/Top10Row";
import BecauseYouWatchedRow from "@/components/BecauseYouWatchedRow";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";
import { applyProfileDiscoveryRules, getHiddenTitles, getParentalRule } from "@/lib/profile-controls";

const GENRE_NAMES: Record<string, string> = {
  "28": "Action",
  "35": "Comedy",
  "18": "Drama",
  "27": "Horror",
  "878": "Sci-Fi",
  "10749": "Romance",
  "16": "Animation",
  "99": "Documentary",
  "53": "Thriller",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; genreId?: string }>;
}) {
  const { filter: urlFilter, genreId } = await searchParams;

  const [
    profile,
    trendingRaw,
    popularMoviesRaw,
    popularShowsRaw,
    topMoviesRaw,
    topShowsRaw,
    top10Raw,
    newThisWeekRaw,
  ] = await Promise.all([
    requireProfile(),
    getTrending(),
    getPopularMovies(),
    getPopularShows(),
    getTopRatedMovies(),
    getTopRatedShows(),
    getTop10Trending(),
    getNewThisWeek(),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const [hiddenTitles, parentalRule] = await Promise.all([
    getHiddenTitles(profile.profileId),
    getParentalRule(profile.profileId),
  ]);

  const [
    trendingAll,
    popularMoviesAll,
    popularShowsAll,
    topMoviesAll,
    topShowsAll,
    top10All,
    newThisWeekAll,
  ] = await Promise.all([
    attachCardContext(trendingRaw),
    attachCardContext(popularMoviesRaw),
    attachCardContext(popularShowsRaw),
    attachCardContext(topMoviesRaw),
    attachCardContext(topShowsRaw),
    attachCardContext(top10Raw),
    attachCardContext(newThisWeekRaw),
  ]);

  const applyMaturity = (items: typeof trendingAll) =>
    applyProfileDiscoveryRules(
      items.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel)),
      hiddenTitles,
      parentalRule
    );

  const trending = applyMaturity(trendingAll);
  const popularMovies = applyMaturity(popularMoviesAll);
  const popularShows = applyMaturity(popularShowsAll);
  const topMovies = applyMaturity(topMoviesAll);
  const topShows = applyMaturity(topShowsAll);
  const top10 = applyMaturity(top10All);
  const newThisWeek = applyMaturity(newThisWeekAll);

  const hero = trending[0];
  const heroExtras = hero ? await getHeroExtras(hero.id, getMediaType(hero)) : null;
  const mobileHeroPoster = hero ? posterUrl(hero.poster_path, "w500") : null;

  // Fetch genre items if filter=genre
  let genreItems: typeof trending = [];
  if (urlFilter === "genre" && genreId) {
    const genreRaw = await getGenreItems(genreId);
    const genreAll = await attachCardContext(genreRaw);
    genreItems = applyMaturity(genreAll);
  }

  return (
    <main className="min-h-screen">
      {/* Desktop hero */}
      {hero && (
        <div className="hidden md:block">
          <Hero
            item={hero}
            logoPath={heroExtras?.logoPath ?? null}
            trailerKey={heroExtras?.trailerKey ?? null}
          />
        </div>
      )}

      {/* Mobile: header → filter pills → hero card */}
      <section className="relative overflow-hidden md:hidden">
        <div className="absolute inset-0">
          {mobileHeroPoster ? (
            <>
              <Image
                src={mobileHeroPoster}
                alt=""
                fill
                sizes="(max-width: 767px) 92vw, 0px"
                className="scale-[1.35] object-cover object-top opacity-45 blur-3xl saturate-150"
                aria-hidden="true"
                priority
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.16),transparent_36%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(229,9,20,0.24),transparent_42%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,180,120,0.18),transparent_34%)]" />
            </>
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-[#141414]/10 via-[#141414]/35 to-[#141414]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-[#141414]" />
        </div>

        <div className="relative">
          <MobileHeader />
          <FilterPills currentFilter={urlFilter} />
          {hero && <MobileHero item={hero} logoPath={heroExtras?.logoPath} />}
        </div>
      </section>

      {/* Desktop rows */}
      <div className="relative z-10 mt-8 hidden space-y-2 pb-16 md:mt-10 md:block">
        <Suspense fallback={null}>
          <ContinueWatchingRow />
        </Suspense>
        <Suspense fallback={null}>
          <BecauseYouWatchedRow />
        </Suspense>
        <Suspense fallback={null}>
          <RecommendedRow />
        </Suspense>
        <Top10Row items={top10} />
        <MediaRow title="New This Week" items={newThisWeek} />
        <MediaRow title="Trending Now" items={trending} />
        <MediaRow title="Popular Movies" items={popularMovies} />
        <MediaRow title="Popular TV Shows" items={popularShows} />
        <MediaRow title="Top Rated Movies" items={topMovies} />
        <MediaRow title="Top Rated TV Shows" items={topShows} />
        <Suspense fallback={null}>
          <MoodRows maturityLevel={maturityLevel} />
        </Suspense>
      </div>

      {/* Mobile rows */}
      <div className="relative z-10 space-y-4 pb-24 md:hidden">
        <Suspense fallback={null}>
          <ContinueWatchingRow />
        </Suspense>
        {urlFilter === "shows" && (
          <>
            <MediaRow title="Popular Shows" items={popularShows} portrait />
            <MediaRow title="Top Rated Shows" items={topShows} portrait />
          </>
        )}
        {urlFilter === "movies" && (
          <>
            <MediaRow title="Popular Movies" items={popularMovies} portrait />
            <MediaRow title="Top Rated Movies" items={topMovies} portrait />
          </>
        )}
        {urlFilter === "genre" && genreId && (
          <MediaRow
            title={GENRE_NAMES[genreId] ?? "Genre"}
            items={genreItems}
            portrait
          />
        )}
        {!urlFilter && (
          <>
            <Top10Row items={top10} />
            <MediaRow title="New This Week" items={newThisWeek} portrait />
            <MediaRow title="Trending Now" items={trending} portrait />
            <MediaRow title="Popular Movies" items={popularMovies} portrait />
            <MediaRow title="Popular Shows" items={popularShows} portrait />
            <MediaRow title="Top Rated Movies" items={topMovies} portrait />
            <MediaRow title="Top Rated Shows" items={topShows} portrait />
            <Suspense fallback={null}>
              <MoodRows maturityLevel={maturityLevel} portrait />
            </Suspense>
          </>
        )}
      </div>
    </main>
  );
}
