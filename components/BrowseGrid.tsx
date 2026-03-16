import { dedupeTMDBItems, type TMDBItem } from "@/lib/tmdb";
import MediaCard from "./MediaCard";

export default function BrowseGrid({
  title,
  items,
  mobilePortrait = false,
}: {
  title: string;
  items: TMDBItem[];
  mobilePortrait?: boolean;
}) {
  const uniqueItems = dedupeTMDBItems(items);
  const rootClassName = mobilePortrait
    ? "min-h-screen px-4 pb-24 pt-24 md:px-12 md:pb-16 md:pt-28"
    : "min-h-screen px-6 pb-16 pt-28 md:px-12";

  return (
    <main className={rootClassName}>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/42">
          Browse
        </p>
        <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">
          {title}
        </h1>
      </div>

      <div
        className={`grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${
          mobilePortrait ? "hidden md:grid" : "grid"
        }`}
      >
        {uniqueItems.map((item) => (
          <MediaCard
            key={`${item.id}-${item.media_type ?? "media"}`}
            item={item}
            layout="grid"
          />
        ))}
      </div>

      {mobilePortrait ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 min-[380px]:grid-cols-3 md:hidden">
          {uniqueItems.map((item) => (
            <MediaCard
              key={`${item.id}-${item.media_type ?? "media"}`}
              item={item}
              layout="grid"
              portrait
            />
          ))}
        </div>
      ) : null}
    </main>
  );
}
