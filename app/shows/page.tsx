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

export default async function ShowsPage({
  searchParams,
}: {
  searchParams: Promise<{ genre?: string; sort?: string; minRating?: string }>;
}) {
  const { genre, sort, minRating } = await searchParams;
  const hasFilters = !!(genre || sort || minRating);

  const [profile, rawItems] = await Promise.all([
    requireProfile(),
    hasFilters
      ? getFilteredContent("tv", genre, sort ?? "popularity.desc", minRating ? Number(minRating) : undefined, 2)
      : Promise.all([getPopularShows(4), getTopRatedShows(4)]).then(
          ([popular, topRated]) => dedupeTMDBItems([...popular, ...topRated])
        ),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const all = await attachCardContext(rawItems);
  const items = all.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel));

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
