"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, Play, Plus } from "@phosphor-icons/react";
import { TMDBItem, posterUrl, getMediaType, getTitle } from "@/lib/tmdb";
import { useMyList } from "@/lib/my-list";

export default function MobileHero({
  item,
}: {
  item: TMDBItem;
  logoPath?: string | null;
}) {
  const type = getMediaType(item);
  const title = getTitle(item);
  const poster = posterUrl(item.poster_path, "w500");
  const { isSaved, toggle } = useMyList(item);

  if (!poster) return null;

  return (
    <div className="relative z-10 px-4 pb-4 md:hidden">
      <div className="relative w-full aspect-[2/3] overflow-hidden rounded-xl">
        <Image
          src={poster}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw"
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/65 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex gap-3">
          <Link
            href={`/watch/${type}/${item.id}`}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white py-3 text-sm font-semibold text-black"
          >
            <Play size={17} weight="fill" />
            Play
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-white/15 py-3 text-sm font-semibold text-white backdrop-blur-sm"
          >
            {isSaved ? <Check size={17} weight="bold" /> : <Plus size={17} />}
            My List
          </button>
        </div>
      </div>
    </div>
  );
}
