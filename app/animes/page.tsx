export const dynamic = "force-dynamic";

import { Suspense } from "react";
import BrowseGrid from "@/components/BrowseGrid";
import BrowseFilterBar from "@/components/BrowseFilterBar";
import { attachCardContext, getAnimeShows, getFilteredContent } from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";

export default async function AnimesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; minRating?: string }>;
}) {
  const { sort, minRating } = await searchParams;
  const hasFilters = !!(sort || minRating);

  const [profile, raw] = await Promise.all([
    requireProfile(),
    hasFilters
      ? getFilteredContent("tv", "16", sort ?? "popularity.desc", minRating ? Number(minRating) : undefined, 2).then(
          (items) => items.filter((item) => true) // keep origin JP filtering loose for filter mode
        )
      : getAnimeShows(4),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const all = await attachCardContext(raw);
  const items = all.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel));

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
