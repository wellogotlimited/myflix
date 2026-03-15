"use client";

import { useMemo } from "react";
import MediaCard from "./MediaCard";
import { useMyList } from "@/lib/my-list";

export default function MyListPage() {
  const { items } = useMyList();
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.savedAt - a.savedAt),
    [items]
  );

  return (
    <main className="min-h-screen px-6 pb-16 pt-28 md:px-12">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/42">
          Personal
        </p>
        <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">
          My List
        </h1>
      </div>

      {sortedItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedItems.map((item) => (
            <MediaCard key={`${item.media_type}-${item.id}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-8 text-white/66">
          Add titles from any poster or popup and they will show up here.
        </div>
      )}
    </main>
  );
}
