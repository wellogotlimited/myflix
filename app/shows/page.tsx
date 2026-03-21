export const dynamic = "force-dynamic";

import { Suspense } from "react";
import BrowseGrid from "@/components/BrowseGrid";
import BrowseFilterBar from "@/components/BrowseFilterBar";
import {
  attachCardContext,
  dedupeTMDBItems,
  getPopularShows,
  getTopRatedShows,
  getFilteredContent,
} from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";
import { applyProfileDiscoveryRules, getHiddenTitles, getParentalRule } from "@/lib/profile-controls";

export default async function ShowsPage({
  searchParams,
}: {
  searchParams: Promise<{
    genre?: string;
    sort?: string;
    minRating?: string;
    year?: string;
    language?: string;
    runtime?: string;
    network?: string;
    status?: string;
  }>;
}) {
  const { genre, sort, minRating, year, language, runtime, network, status } = await searchParams;
  const hasFilters = !!(genre || sort || minRating || year || language || runtime || network || status);

  const [profile, rawItems, hiddenTitles, parentalRule] = await Promise.all([
    requireProfile(),
    hasFilters
      ? getFilteredContent("tv", {
          genreId: genre,
          sortBy: sort ?? "popularity.desc",
          minRating: minRating ? Number(minRating) : undefined,
          pages: 2,
          year,
          language,
          runtime,
          network,
          status,
        })
      : Promise.all([getPopularShows(4), getTopRatedShows(4)]).then(
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
      title="Shows"
      items={items}
      filterBar={
        <Suspense fallback={null}>
          <BrowseFilterBar contentType="tv" />
        </Suspense>
      }
    />
  );
}
