"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import type { TMDBSeason, TMDBEpisode } from "@/lib/tmdb";
import { backdropUrl } from "@/lib/tmdb";

export default function EpisodePicker({
  showId,
  type,
  seasons,
  episodes,
  currentSeason,
  currentEpisode,
}: {
  showId: string;
  type: string;
  seasons: TMDBSeason[];
  episodes: TMDBEpisode[];
  currentSeason: number;
  currentEpisode: number;
}) {
  const router = useRouter();

  return (
    <div>
      {/* Season selector */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {seasons.map((s) => (
          <button
            key={s.season_number}
            onClick={() =>
              router.push(`/watch/${type}/${showId}?season=${s.season_number}&episode=1`)
            }
            className={`px-4 py-1.5 rounded text-sm whitespace-nowrap transition-colors ${
              s.season_number === currentSeason
                ? "bg-white text-black font-medium"
                : "bg-white/10 text-gray-300 hover:bg-white/20"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Episode list */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {episodes.map((ep) => (
          <button
            key={ep.episode_number}
            onClick={() =>
              router.push(
                `/watch/${type}/${showId}?season=${currentSeason}&episode=${ep.episode_number}`
              )
            }
            className={`text-left rounded-md overflow-hidden transition-colors ${
              ep.episode_number === currentEpisode
                ? "ring-2 ring-white bg-white/10"
                : "bg-white/5 hover:bg-white/10"
            }`}
          >
            {ep.still_path && (
              <div className="relative aspect-video">
                <Image
                  src={backdropUrl(ep.still_path, "w300")}
                  alt={ep.name}
                  fill
                  sizes="300px"
                  className="object-cover"
                />
              </div>
            )}
            <div className="p-2">
              <p className="text-sm font-medium truncate">
                {ep.episode_number}. {ep.name}
              </p>
              {ep.runtime && (
                <p className="text-xs text-gray-500">{ep.runtime} min</p>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
