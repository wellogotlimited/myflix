export const dynamic = "force-dynamic";

import { attachCardContext, searchMulti, getTrending, type TMDBItem } from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";
import SearchClient from "@/components/SearchClient";
import MobileSearchPage from "@/components/mobile/MobileSearchPage";
import { applyProfileDiscoveryRules, getHiddenTitles, getParentalRule } from "@/lib/profile-controls";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, profile] = await Promise.all([searchParams, requireProfile()]);
  const query = q || "";
  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const [hiddenTitles, parentalRule] = await Promise.all([
    getHiddenTitles(profile.profileId),
    getParentalRule(profile.profileId),
  ]);

  const applyMaturity = (items: TMDBItem[]) =>
    applyProfileDiscoveryRules(
      items.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel)),
      hiddenTitles,
      parentalRule
    );

  // Desktop: always enrich results for hover previews
  // Mobile recommended: raw trending (portrait cards fetch their own details on tap)
  const [searchRaw, trendingRaw] = await Promise.all([
    query ? searchMulti(query) : Promise.resolve([]),
    !query ? getTrending() : Promise.resolve([]),
  ]);

  const results = applyMaturity(await attachCardContext(searchRaw));
  const recommended = applyMaturity(await attachCardContext(trendingRaw.slice(0, 15)));

  return (
    <>
      {/* Mobile search flow */}
      <MobileSearchPage query={query} results={results} recommended={recommended} />

      {/* Desktop */}
      <main className="hidden min-h-screen px-6 pt-20 md:block md:px-12">
        <h1 className="mb-6 text-2xl font-semibold">
          {query ? `Results for "${query}"` : "Search"}
        </h1>
        <SearchClient query={query} results={results} />
      </main>
    </>
  );
}
