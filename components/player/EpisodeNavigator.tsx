"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { backdropUrl, type TMDBEpisode, type TMDBSeason } from "@/lib/tmdb";

interface ShowNavigation {
  showId: string;
  type: string;
  seasons: TMDBSeason[];
  episodes: TMDBEpisode[];
  currentSeason: number;
  currentEpisode: number;
}

type EpisodeNavigatorView = "episodes" | "seasons";

export default function EpisodeNavigator({
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
  const [view, setView] = useState<EpisodeNavigatorView>("episodes");
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(
    showNavigation.currentSeason
  );
  const [seasonEpisodes, setSeasonEpisodes] = useState<TMDBEpisode[]>(
    showNavigation.episodes
  );
  const [isLoadingSeason, setIsLoadingSeason] = useState(false);
  const [seasonError, setSeasonError] = useState<string | null>(null);
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<number | null>(null);
  const episodeCacheRef = useRef<Record<number, TMDBEpisode[]>>({
    [showNavigation.currentSeason]: showNavigation.episodes,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedSeason = useMemo(
    () =>
      showNavigation.seasons.find(
        (season) => season.season_number === selectedSeasonNumber
      ) ?? null,
    [showNavigation.seasons, selectedSeasonNumber]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    episodeCacheRef.current[showNavigation.currentSeason] = showNavigation.episodes;
    setSelectedSeasonNumber(showNavigation.currentSeason);
    setSeasonEpisodes(showNavigation.episodes);
    setIsLoadingSeason(false);
    setSeasonError(null);
    setExpandedEpisodeId(null);
  }, [
    showNavigation.currentSeason,
    showNavigation.currentEpisode,
    showNavigation.episodes,
  ]);

  const loadSeasonEpisodes = async (seasonNumber: number) => {
    setSelectedSeasonNumber(seasonNumber);
    setView("episodes");
    setSeasonError(null);

    const cachedEpisodes = episodeCacheRef.current[seasonNumber];
    if (cachedEpisodes) {
      setSeasonEpisodes(cachedEpisodes);
      return;
    }

    setIsLoadingSeason(true);

    try {
      const response = await fetch(
        `/api/tmdb/season?showId=${showNavigation.showId}&season=${seasonNumber}`
      );
      if (!response.ok) {
        throw new Error("Failed to load episodes");
      }

      const data = (await response.json()) as { episodes: TMDBEpisode[] };
      episodeCacheRef.current[seasonNumber] = data.episodes;
      setSeasonEpisodes(data.episodes);
    } catch (error) {
      setSeasonError(
        error instanceof Error ? error.message : "Failed to load episodes"
      );
      setSeasonEpisodes([]);
    } finally {
      setIsLoadingSeason(false);
    }
  };

  const scrollEpisodes = (direction: "left" | "right") => {
    if (!scrollRef.current) return;

    const amount = Math.max(scrollRef.current.clientWidth * 0.75, 320);
    scrollRef.current.scrollBy({
      left: direction === "right" ? amount : -amount,
      behavior: "smooth",
    });
  };

  return (
    <>
      <div className="absolute inset-0 z-20" onClick={onClose} />
      <div
        className={`pointer-events-none absolute inset-x-4 bottom-24 z-30 md:bottom-28 ${
          view === "episodes"
            ? "md:left-6 md:right-6"
            : "md:left-auto md:right-6 md:w-[24rem]"
        }`}
      >
        <div
          className="pointer-events-auto overflow-hidden rounded-[24px] border border-white/10 bg-neutral-950/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              {view === "episodes" ? (
                <button
                  type="button"
                  onClick={() => setView("seasons")}
                  className="truncate text-sm font-medium text-white transition hover:text-white"
                  title="Open seasons"
                >
                  {selectedSeason?.name || `Season ${selectedSeasonNumber}`}
                </button>
              ) : (
                <p className="truncate text-sm font-medium text-white">Seasons</p>
              )}

              {view === "episodes" ? (
                <button
                  type="button"
                  onClick={() => setView("seasons")}
                  className="rounded-full bg-black/85 p-2 text-white shadow-lg transition hover:bg-white/12 hover:text-white"
                  title="Open seasons"
                >
                  <CaretRight size={16} weight="bold" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setView("episodes")}
                  className="rounded-full bg-black/85 p-2 text-white shadow-lg transition hover:bg-white/12 hover:text-white"
                  title="Back to episodes"
                >
                  <CaretLeft size={16} weight="bold" />
                </button>
              )}
            </div>
          </div>

          {view === "episodes" ? (
            <div className="px-3 pb-4 pt-3">
              {seasonError ? (
                <div className="rounded-2xl border border-red-400/15 bg-red-500/8 px-4 py-6 text-sm text-red-100/85">
                  {seasonError}
                </div>
              ) : isLoadingSeason ? (
                <div className="flex h-40 items-center justify-center rounded-2xl bg-white/[0.04] text-sm text-white/55">
                  Loading episodes...
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => scrollEpisodes("left")}
                    className="absolute left-1 top-[6rem] z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/90 p-2 text-white shadow-lg transition hover:bg-white/12 hover:text-white md:block"
                    title="Scroll left"
                  >
                    <CaretLeft size={16} weight="bold" />
                  </button>

                  <div
                    ref={scrollRef}
                    className="scrollbar-hide flex gap-3 overflow-x-auto pb-3 pr-2 scroll-smooth"
                  >
                  {seasonEpisodes.map((episode) => {
                    const isActive =
                      selectedSeasonNumber === showNavigation.currentSeason &&
                      episode.episode_number === showNavigation.currentEpisode;
                    const hasOverview = episode.overview.trim().length > 0;
                    const isExpanded = expandedEpisodeId === episode.id;

                    return (
                      <div
                        key={episode.id}
                        className={`w-[18rem] flex-shrink-0 overflow-hidden rounded-[20px] border border-white/8 bg-white/[0.03] transition ${
                          isActive
                            ? "ring-1 ring-rose-400/40"
                            : "hover:-translate-y-0.5"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (isActive) {
                              onClose();
                              return;
                            }

                            onClose();
                            onEpisodeSelect?.({
                              seasonNumber: selectedSeasonNumber,
                              episode,
                              episodes: seasonEpisodes,
                            });
                          }}
                          className="w-full text-left"
                        >
                          {!isExpanded && (
                            <div className="relative aspect-video overflow-hidden bg-white/[0.04]">
                              {episode.still_path ? (
                                <Image
                                  src={backdropUrl(episode.still_path, "w300")}
                                  alt={episode.name}
                                  fill
                                  sizes="288px"
                                  className="object-cover transition duration-300"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-white/30">
                                  Episode
                                </div>
                              )}

                              <div className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                                E{episode.episode_number}
                              </div>
                            </div>
                          )}

                          <div className="p-3">
                            <p className="text-sm font-medium text-white">
                              {episode.name}
                            </p>
                            <p
                              className={`mt-1.5 text-xs leading-[1.35rem] text-white/56 ${
                                isExpanded ? "" : "line-clamp-2"
                              }`}
                            >
                              {isExpanded
                                ? episode.overview || "No episode description available."
                                : episode.overview || "No episode description available."}
                            </p>
                          </div>
                        </button>

                        {(hasOverview || isExpanded) && (
                          <div className="px-3 pb-3">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedEpisodeId((current) =>
                                  current === episode.id ? null : episode.id
                                );
                              }}
                              className="text-xs font-medium text-white/58 transition hover:text-white"
                            >
                              {isExpanded ? "Show less" : "Show more"}
                            </button>
                          </div>
                        )}

                        {isActive && (
                          <div className="px-3 pb-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-300">
                              Current
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>

                  <button
                    type="button"
                    onClick={() => scrollEpisodes("right")}
                    className="absolute right-1 top-[6rem] z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/90 p-2 text-white shadow-lg transition hover:bg-white/12 hover:text-white md:block"
                    title="Scroll right"
                  >
                    <CaretRight size={16} weight="bold" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="scrollbar-hide max-h-[18.5rem] overflow-y-auto p-2">
              {showNavigation.seasons.map((season) => {
                const isActive =
                  season.season_number === showNavigation.currentSeason;

                return (
                  <button
                    key={season.id}
                    type="button"
                    onClick={() => loadSeasonEpisodes(season.season_number)}
                    className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition ${
                      isActive
                        ? "bg-white/8 text-white"
                        : "text-white/75 hover:bg-white/6 hover:text-white"
                    }`}
                  >
                    <span className="line-clamp-1 text-sm font-medium">
                      {season.name || `Season ${season.season_number}`}
                    </span>

                    <CaretRight size={14} weight="bold" className="text-white/40" />
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
