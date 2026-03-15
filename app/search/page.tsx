export const dynamic = "force-dynamic";

import { attachCardContext, searchMulti } from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";
import MediaCard from "@/components/MediaCard";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, profile] = await Promise.all([searchParams, requireProfile()]);
  const query = q || "";
  const maturityLevel = profile?.maturityLevel ?? "ADULT";

  const all = query ? await attachCardContext(await searchMulti(query)) : [];
  const results = all.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel));

  return (
    <main className="min-h-screen pt-20 px-6 md:px-12">
      <h1 className="text-2xl font-semibold mb-6">
        {query ? `Results for "${query}"` : "Search"}
      </h1>
      {results.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {results.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        query && <p className="text-gray-400">No results found.</p>
      )}
    </main>
  );
}
