"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { CaretDown, X } from "@phosphor-icons/react";
import { backdropUrl, type TMDBEpisode, type TMDBSeason } from "@/lib/tmdb";

interface ShowNavigation {
  showId: string;
  seasons: TMDBSeason[];
  episodes: TMDBEpisode[];
  currentSeason: number;
  currentEpisode: number;
}

export default function MobileEpisodeDrawer({
  showNavigation,
  onClose,
  onEpisodeSelect,
}: {
  showNavigation: ShowNavigation;
  onClose: () => void;
  onEpisodeSelect?: (payload: {
    seasonNumber: number;
    episode: TMDBEpisode;
    episodes: TMDBEpisode[];
  }) => void;
}) {
  const [selectedSeason, setSelectedSeason] = useState(showNavigation.currentSeason);
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>(showNavigation.episodes);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Record<number, TMDBEpisode[]>>({
    [showNavigation.currentSeason]: showNavigation.episodes,
  });

  async function loadSeason(seasonNum: number) {
    setSelectedSeason(seasonNum);
    if (cacheRef.current[seasonNum]) {
      setEpisodes(cacheRef.current[seasonNum]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tmdb/season?showId=${showNavigation.showId}&season=${seasonNum}`
      );
      const data = (await res.json()) as { episodes: TMDBEpisode[] };
      cacheRef.current[seasonNum] = data.episodes;
      setEpisodes(data.episodes);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div
        data-player-ui
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      <div
        data-player-ui
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[72vh] flex-col rounded-t-2xl bg-neutral-950"
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="relative">
            <select
              value={selectedSeason}
              onChange={(e) => loadSeason(Number(e.target.value))}
              className="appearance-none rounded-md border border-white/20 bg-white/[0.06] py-1.5 pl-3 pr-7 text-sm text-white outline-none"
            >
              {showNavigation.seasons.map((s) => (
                <option key={s.id} value={s.season_number} className="bg-neutral-900">
                  {s.name || `Season ${s.season_number}`}
                </option>
              ))}
            </select>
            <CaretDown
              size={14}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/50"
            />
          </div>
          <button onClick={onClose} className="text-white/60">
            <X size={22} />
          </button>
        </div>

        {/* Episode list */}
        <div className="scrollbar-hide overflow-y-auto">
          {loading ? (
            <p className="py-10 text-center text-sm text-white/40">Loading...</p>
          ) : (
            <div className="divide-y divide-white/5 px-4 pb-[env(safe-area-inset-bottom)]">
              {episodes.map((ep) => {
                const isActive =
                  selectedSeason === showNavigation.currentSeason &&
                  ep.episode_number === showNavigation.currentEpisode;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => {
                      if (!isActive) {
                        onEpisodeSelect?.({
                          seasonNumber: selectedSeason,
                          episode: ep,
                          episodes,
                        });
                      }
                      onClose();
                    }}
                    className="flex w-full gap-3 py-3 text-left"
                  >
                    <div className="relative h-[3.5rem] w-24 flex-shrink-0 overflow-hidden rounded-md bg-white/[0.04]">
                      {ep.still_path && (
                        <Image
                          src={backdropUrl(ep.still_path, "w300")}
                          alt={ep.name}
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`line-clamp-1 text-sm font-medium ${
                          isActive ? "text-rose-300" : "text-white"
                        }`}
                      >
                        {ep.episode_number}. {ep.name}
                        {isActive && (
                          <span className="ml-2 text-xs font-normal text-rose-400/70">
                            Playing
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-white/45">
                        {ep.overview || "No description available."}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
