export const dynamic = "force-dynamic";

import { attachCardContext, filterMovieItems, searchMulti, getTrending } from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";
import MediaCard from "@/components/MediaCard";
import MobileSearchPage from "@/components/mobile/MobileSearchPage";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, profile] = await Promise.all([searchParams, requireProfile()]);
  const query = q || "";
  const maturityLevel = profile?.maturityLevel ?? "ADULT";

  const applyMaturity = <T extends { maturityRating?: string | null }>(items: T[]) =>
    items.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel));

  // Desktop: always enrich results for hover previews
  // Mobile recommended: raw trending (portrait cards fetch their own details on tap)
  const [searchRaw, trendingRaw] = await Promise.all([
    query ? searchMulti(query) : Promise.resolve([]),
    !query ? getTrending() : Promise.resolve([]),
  ]);

  const results = applyMaturity(await attachCardContext(filterMovieItems(searchRaw)));
  const recommended = applyMaturity(
    await attachCardContext(filterMovieItems(trendingRaw).slice(0, 15))
  );

  return (
    <>
      {/* Mobile search flow */}
      <MobileSearchPage query={query} results={results} recommended={recommended} />

      {/* Desktop */}
      <main className="hidden min-h-screen px-6 pt-20 md:block md:px-12">
        <h1 className="mb-6 text-2xl font-semibold">
          {query ? `Results for "${query}"` : "Search"}
        </h1>
        {results.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {results.map((item) => (
              <MediaCard key={`${item.media_type}-${item.id}`} item={item} layout="grid" />
            ))}
          </div>
        ) : (
          query && <p className="text-gray-400">No results found.</p>
        )}
      </main>
    </>
  );
}
