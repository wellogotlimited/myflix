export const dynamic = "force-dynamic";

import { Suspense } from "react";
import BrowseGrid from "@/components/BrowseGrid";
import BrowseFilterBar from "@/components/BrowseFilterBar";
import { attachCardContext, getAnimeShows, getFilteredContent } from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";
import { applyProfileDiscoveryRules, getHiddenTitles, getParentalRule } from "@/lib/profile-controls";

export default async function AnimesPage({
  searchParams,
}: {
  searchParams: Promise<{
    sort?: string;
    minRating?: string;
    year?: string;
    language?: string;
    runtime?: string;
    status?: string;
  }>;
}) {
  const { sort, minRating, year, language, runtime, status } = await searchParams;
  const hasFilters = !!(sort || minRating || year || language || runtime || status);

  const [profile, raw, hiddenTitles, parentalRule] = await Promise.all([
    requireProfile(),
    hasFilters
      ? getFilteredContent("tv", {
          genreId: "16",
          sortBy: sort ?? "popularity.desc",
          minRating: minRating ? Number(minRating) : undefined,
          pages: 2,
          year,
          language,
          runtime,
          status,
        }).then(
          (items) => items.filter((item) => true) // keep origin JP filtering loose for filter mode
        )
      : getAnimeShows(4),
    requireProfile().then((session) => getHiddenTitles(session.profileId)),
    requireProfile().then((session) => getParentalRule(session.profileId)),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const all = await attachCardContext(raw);
  const items = applyProfileDiscoveryRules(
    all.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel)),
    hiddenTitles,
    parentalRule
  );

  return (
    <BrowseGrid
      title="Animes"
      items={items}
      filterBar={
        <Suspense fallback={null}>
          <BrowseFilterBar contentType="anime" />
        </Suspense>
      }
    />
  );
}
