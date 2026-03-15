import type { TMDBItem } from "@/lib/tmdb";
import MediaCard from "./MediaCard";

export default function BrowseGrid({
  title,
  items,
}: {
  title: string;
  items: TMDBItem[];
}) {
  return (
    <main className="min-h-screen px-6 pb-16 pt-28 md:px-12">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/42">
          Browse
        </p>
        <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">
          {title}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <MediaCard key={`${item.id}-${item.media_type ?? "media"}`} item={item} />
        ))}
      </div>
    </main>
  );
}
