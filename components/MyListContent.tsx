"use client";

import { useMemo } from "react";
import MediaCard from "./MediaCard";
import { useMyList } from "@/lib/my-list";

export default function MyListContent({
  variant = "page",
}: {
  variant?: "page" | "sheet";
}) {
  const { items } = useMyList();
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.savedAt - a.savedAt),
    [items]
  );

  const isSheet = variant === "sheet";
  const emptyState = isSheet
    ? "Save titles from any poster or details popup and they will show up here."
    : "Add titles from any poster or popup and they will show up here.";

  return (
    <div className={isSheet ? "" : "min-h-screen px-4 pb-24 pt-24 md:px-12 md:pb-16 md:pt-28"}>
      {!isSheet ? (
        <div className="mb-8">
          <h1 className="mt-3 text-3xl font-black text-white md:text-5xl">
            My List
          </h1>
        </div>
      ) : null}

      {sortedItems.length > 0 ? (
        <>
          <div className="hidden grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 md:grid">
            {sortedItems.map((item) => (
              <MediaCard
                key={`${item.media_type}-${item.id}`}
                item={item}
                layout="grid"
              />
            ))}
          </div>

          <div className={`grid grid-cols-2 gap-x-3 gap-y-5 min-[380px]:grid-cols-3 md:hidden ${isSheet ? "pb-4" : ""}`}>
            {sortedItems.map((item) => (
              <MediaCard
                key={`${item.media_type}-${item.id}`}
                item={item}
                layout="grid"
                portrait
              />
            ))}
          </div>
        </>
      ) : (
        <div
          className={`rounded-[24px] border border-white/10 bg-white/[0.03] text-white/66 ${
            isSheet ? "p-6 text-sm leading-6" : "p-8"
          }`}
        >
          {emptyState}
        </div>
      )}
    </div>
  );
}
