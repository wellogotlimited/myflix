export const dynamic = "force-dynamic";

import { Suspense } from "react";
import BrowseGrid from "@/components/BrowseGrid";
import BrowseFilterBar from "@/components/BrowseFilterBar";
import {
  attachCardContext,
  dedupeTMDBItems,
  getPopularMovies,
  getTopRatedMovies,
  getFilteredContent,
} from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";
import { applyProfileDiscoveryRules, getHiddenTitles, getParentalRule } from "@/lib/profile-controls";

export default async function MoviesPage({
  searchParams,
}: {
  searchParams: Promise<{
    genre?: string;
    sort?: string;
    minRating?: string;
    year?: string;
    language?: string;
    runtime?: string;
  }>;
}) {
  const { genre, sort, minRating, year, language, runtime } = await searchParams;
  const hasFilters = !!(genre || sort || minRating || year || language || runtime);

  const [profile, rawItems, hiddenTitles, parentalRule] = await Promise.all([
    requireProfile(),
    hasFilters
      ? getFilteredContent("movie", {
          genreId: genre,
          sortBy: sort ?? "popularity.desc",
          minRating: minRating ? Number(minRating) : undefined,
          pages: 2,
          year,
          language,
          runtime,
        })
      : Promise.all([getPopularMovies(4), getTopRatedMovies(4)]).then(
          ([popular, topRated]) => dedupeTMDBItems([...popular, ...topRated])
        ),
    requireProfile().then((session) => getHiddenTitles(session.profileId)),
    requireProfile().then((session) => getParentalRule(session.profileId)),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const all = await attachCardContext(rawItems);
  const items = applyProfileDiscoveryRules(
    all.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel)),
    hiddenTitles,
    parentalRule
  );

  return (
    <BrowseGrid
      title="Movies"
      items={items}
      filterBar={
        <Suspense fallback={null}>
          <BrowseFilterBar contentType="movie" />
        </Suspense>
      }
    />
  );
}
