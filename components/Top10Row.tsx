"use client";

import Image from "next/image";
import { useState } from "react";
import { TMDBItem, posterUrl, getMediaType } from "@/lib/tmdb";
import MediaDetailsModal from "./MediaDetailsModal";

function Top10Card({ item, rank }: { item: TMDBItem; rank: number }) {
  const [modalOpen, setModalOpen] = useState(false);
  const poster = posterUrl(item.poster_path, "w342");
  if (!poster) return null;

  return (
    <>
      <div className="relative flex flex-shrink-0 items-end">
        <span
          className="select-none text-[6.5rem] font-black leading-none text-transparent md:text-[8.5rem]"
          style={{ WebkitTextStroke: "2.5px rgba(255,255,255,0.55)" }}
        >
          {rank}
        </span>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="-ml-5 relative w-[88px] flex-shrink-0 overflow-hidden rounded-md shadow-[0_10px_28px_rgba(0,0,0,0.45)] transition-transform duration-300 hover:scale-105 md:w-28"
        >
          <div className="relative aspect-[2/3]">
            <Image
              src={poster}
              alt=""
              fill
              sizes="(max-width: 767px) 88px, 112px"
              className="object-cover"
            />
          </div>
        </button>
      </div>

      {modalOpen && (
        <MediaDetailsModal
          item={item}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

export default function Top10Row({ items }: { items: TMDBItem[] }) {
  const top10 = items.slice(0, 10);
  if (!top10.length) return null;

  return (
    <section>
      <h2 className="mb-3 px-4 text-lg font-semibold text-white md:px-8 md:text-xl">
        Top 10 Today
      </h2>
      <div className="-my-6 flex gap-1 overflow-x-auto overflow-y-visible px-4 py-6 scrollbar-hide md:px-8">
        {top10.map((item, i) => (
          <Top10Card key={item.id} item={item} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
