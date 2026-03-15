"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BookmarkSimple,
  CaretDown,
  CaretLeft,
  CaretRight,
  Play,
  X,
} from "@phosphor-icons/react";
import { useMyList } from "@/lib/my-list";
import { useMediaDetails } from "@/lib/use-media-details";
import {
  backdropUrl,
  getMediaType,
  getTitle,
  type TMDBEpisode,
  type TMDBItem,
} from "@/lib/tmdb";

function formatRuntime(minutes: number | null | undefined) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function castSummary(cast: string[], total: number) {
  const shown = cast.slice(0, 4);
  const extra = Math.max(0, total - shown.length);
  return extra > 0 ? `${shown.join(", ")} +${extra} more` : shown.join(", ");
}

export default function MediaDetailsModal({
  item,
  open,
  onClose,
}: {
  item: TMDBItem;
  open: boolean;
  onClose: () => void;
}) {
  const [activeItem, setActiveItem] = useState(item);
  const [selectedTrailer, setSelectedTrailer] = useState<string | null>(null);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<TMDBEpisode[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [episodePage, setEpisodePage] = useState(0);
  const episodeCacheRef = useRef<Record<number, TMDBEpisode[]>>({});

  const type = getMediaType(activeItem);
  const { data, loading } = useMediaDetails(activeItem, open);
  const { isSaved, toggle } = useMyList(activeItem);

  useEffect(() => {
    setActiveItem(item);
  }, [item]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedTrailer) setSelectedTrailer(null);
        else onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open, selectedTrailer]);

  const title = data?.title || getTitle(activeItem);
  const logo = data?.logoPath ? backdropUrl(data.logoPath, "original") : "";
  const heroImage = backdropUrl(
    data?.backdropPath || activeItem.backdrop_path,
    "w1280"
  );

  const metaItems = useMemo(() => {
    if (!data) return [];

    return [
      data.year,
      data.maturityRating,
      data.type === "movie"
        ? formatRuntime(data.runtime) || ""
        : data.episodeCount
          ? `${data.episodeCount} Episodes`
          : "",
    ].filter(Boolean) as string[];
  }, [data]);

  const playHref =
    type === "tv"
      ? `/watch/${type}/${activeItem.id}?season=${selectedSeasonNumber}&episode=1`
      : `/watch/${type}/${activeItem.id}`;

  const totalEpisodePages = Math.max(1, Math.ceil(seasonEpisodes.length / 10));
  const visibleEpisodes = useMemo(
    () => seasonEpisodes.slice(episodePage * 10, episodePage * 10 + 10),
    [episodePage, seasonEpisodes]
  );

  useEffect(() => {
    if (type !== "tv" || !data) {
      setSelectedSeasonNumber(1);
      setSeasonEpisodes([]);
      setEpisodesLoading(false);
      setEpisodesError(null);
      episodeCacheRef.current = {};
      return;
    }

    const initialSeason = data.seasons[0]?.season_number ?? 1;
    setSelectedSeasonNumber(initialSeason);
    setSeasonEpisodes([]);
    setEpisodesLoading(false);
    setEpisodesError(null);
    setEpisodePage(0);
    episodeCacheRef.current = {};
  }, [activeItem.id, data, type]);

  useEffect(() => {
    if (type !== "tv" || !open || !data) return;

    const cachedEpisodes = episodeCacheRef.current[selectedSeasonNumber];
    if (cachedEpisodes) {
      setSeasonEpisodes(cachedEpisodes);
      setEpisodesError(null);
      setEpisodePage(0);
      return;
    }

    let cancelled = false;
    setEpisodesLoading(true);
    setEpisodesError(null);

    fetch(`/api/tmdb/season?showId=${activeItem.id}&season=${selectedSeasonNumber}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load episodes");
        }

        return (await response.json()) as { episodes: TMDBEpisode[] };
      })
      .then((payload) => {
        if (cancelled) return;
        episodeCacheRef.current[selectedSeasonNumber] = payload.episodes;
        setSeasonEpisodes(payload.episodes);
        setEpisodePage(0);
      })
      .catch((error) => {
        if (cancelled) return;
        setSeasonEpisodes([]);
        setEpisodesError(
          error instanceof Error ? error.message : "Failed to load episodes"
        );
      })
      .finally(() => {
        if (!cancelled) {
          setEpisodesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeItem.id, data, open, selectedSeasonNumber, type]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[120] bg-black/78 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-[121] overflow-y-auto p-4 md:p-8">
        <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#181818] shadow-[0_32px_120px_rgba(0,0,0,0.55)]">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-8 top-8 z-20 rounded-full bg-black/55 p-2.5 text-white transition hover:bg-black/75"
            title="Close"
          >
            <X size={18} weight="bold" />
          </button>

          <div className="relative aspect-[16/6] w-full overflow-hidden">
            {heroImage && (
              <Image
                src={heroImage}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 80rem"
                className="object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#181818] via-[#181818]/28 to-transparent" />

            <div className="absolute inset-x-0 bottom-0 px-6 pb-6 md:px-8 md:pb-7">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#181818] via-[#181818]/78 to-transparent" />
              <div className="relative">
                {logo ? (
                  <div className="relative h-20 w-full max-w-[26rem] md:h-24">
                    <Image
                      src={logo}
                      alt={title}
                      fill
                      sizes="26rem"
                      className="object-contain object-left"
                    />
                  </div>
                ) : (
                  <h2 className="max-w-2xl text-3xl font-black text-white md:text-5xl">
                    {title}
                  </h2>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href={playHref}
                    onClick={onClose}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/92"
                  >
                    <Play size={18} weight="fill" />
                    Play
                  </Link>
                  <button
                    type="button"
                    onClick={toggle}
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-full ring-1 backdrop-blur-sm transition ${
                      isSaved
                        ? "bg-white text-black ring-white"
                        : "bg-black/45 text-white ring-white/18 hover:bg-black/60"
                    }`}
                    title={isSaved ? "Remove from My List" : "Add to My List"}
                  >
                    <BookmarkSimple
                      size={20}
                      weight={isSaved ? "fill" : "regular"}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-10 px-6 py-7 md:px-8 md:py-8">
            <section>
              {metaItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-white/74">
                  {metaItems.map((value, index) =>
                    value === data?.maturityRating ? (
                      <span
                        key={`${value}-${index}`}
                        className="rounded-md border border-white/28 px-2.5 py-1 text-xs font-semibold tracking-[0.08em] text-white/82"
                      >
                        {value}
                      </span>
                    ) : (
                      <span key={`${value}-${index}`}>{value}</span>
                    )
                  )}
                </div>
              )}

              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/74 md:text-base">
                {data?.overview ||
                  activeItem.overview ||
                  "No synopsis is available for this title yet."}
              </p>
            </section>

            {type === "tv" && (
              <section>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-xl font-semibold text-white">Episodes</h3>
                  <div className="relative">
                    <select
                      value={selectedSeasonNumber}
                      onChange={(event) => {
                        setSelectedSeasonNumber(Number(event.target.value));
                      }}
                      className="appearance-none rounded-md border border-white/22 bg-white/[0.04] py-2.5 pl-4 pr-10 text-sm font-medium text-white outline-none transition hover:bg-white/[0.06] focus:border-white/40"
                    >
                      {data?.seasons.map((season) => (
                        <option
                          key={season.id}
                          value={season.season_number}
                          className="bg-[#181818] text-white"
                        >
                          {season.name || `Season ${season.season_number}`}
                        </option>
                      ))}
                    </select>
                    <CaretDown
                      size={16}
                      weight="bold"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/55"
                    />
                  </div>
                </div>

                {episodesError ? (
                  <div className="mt-4 rounded-[20px] bg-white/[0.03] p-5 text-sm text-red-300">
                    {episodesError}
                  </div>
                ) : episodesLoading ? (
                  <div className="mt-4 rounded-[20px] bg-white/[0.03] p-5 text-sm text-white/55">
                    Loading episodes...
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="space-y-1 rounded-[22px] bg-white/[0.03] p-2">
                      {visibleEpisodes.map((episode) => (
                      <Link
                        key={episode.id}
                        href={`/watch/tv/${activeItem.id}?season=${selectedSeasonNumber}&episode=${episode.episode_number}`}
                        onClick={onClose}
                        className="grid grid-cols-[2rem_8rem_minmax(0,1fr)] items-start gap-4 rounded-[18px] px-3 py-3 text-left transition hover:bg-white/[0.06]"
                      >
                        <div className="pt-1 text-sm font-semibold text-white/48">
                          {episode.episode_number}
                        </div>

                        <div className="relative aspect-video overflow-hidden rounded-md bg-white/[0.04]">
                          {episode.still_path ? (
                            <Image
                              src={backdropUrl(episode.still_path, "w500")}
                              alt={episode.name}
                              fill
                              sizes="160px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-white/30">
                              Episode
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <p className="line-clamp-1 text-sm font-medium text-white">
                              {episode.name}
                            </p>
                            {episode.runtime ? (
                              <span className="flex-shrink-0 pt-0.5 text-xs text-white/48">
                                {formatRuntime(episode.runtime)}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-white/56">
                            {episode.overview || "No episode description available."}
                          </p>
                        </div>
                      </Link>
                      ))}
                    </div>

                    {!episodesLoading && seasonEpisodes.length === 0 && (
                      <div className="rounded-[20px] bg-white/[0.03] p-5 text-sm text-white/55">
                        No episodes available for this season yet.
                      </div>
                    )}

                    {seasonEpisodes.length > 10 && (
                      <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEpisodePage((page) => Math.max(0, page - 1))}
                          disabled={episodePage === 0}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-35"
                          title="Previous episodes"
                        >
                          <CaretLeft size={18} weight="bold" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setEpisodePage((page) =>
                              Math.min(totalEpisodePages - 1, page + 1)
                            )
                          }
                          disabled={episodePage >= totalEpisodePages - 1}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] text-white transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-35"
                          title="More episodes"
                        >
                          <CaretRight size={18} weight="bold" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            <section>
              <h3 className="text-xl font-semibold text-white">More Like This</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(data?.similar ?? []).slice(0, 6).map((similar) => (
                  <button
                    key={`${similar.media_type}-${similar.id}`}
                    type="button"
                    onClick={() => {
                      setActiveItem(similar);
                      setSelectedTrailer(null);
                    }}
                    className="text-left"
                  >
                    <SimilarCard item={similar} />
                  </button>
                ))}
                {!loading && !(data?.similar?.length) && (
                  <div className="rounded-2xl bg-white/[0.03] p-5 text-sm text-white/55">
                    No similar titles available yet.
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-white">Trailers & More</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {(data?.trailers ?? []).slice(0, 4).map((trailer) => (
                  <button
                    key={trailer.key}
                    type="button"
                    onClick={() => setSelectedTrailer(trailer.key)}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-left transition hover:bg-white/[0.05]"
                  >
                    <div className="relative aspect-video">
                      <Image
                        src={`https://img.youtube.com/vi/${trailer.key}/hqdefault.jpg`}
                        alt={trailer.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 24rem"
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-black/25" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="rounded-full bg-black/65 p-4 text-white">
                          <Play size={22} weight="fill" />
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-medium text-white">{trailer.name}</p>
                    </div>
                  </button>
                ))}
                {!loading && !(data?.trailers?.length) && (
                  <div className="rounded-2xl bg-white/[0.03] p-5 text-sm text-white/55">
                    No trailers available.
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xl font-semibold text-white">About</h3>
              <div className="mt-5 grid gap-4 text-sm text-white/68 md:grid-cols-2">
                <InfoRow label="Title" value={title} />
                <InfoRow
                  label={type === "movie" ? "Director" : "Creator"}
                  value={
                    type === "movie"
                      ? data?.directors?.join(", ")
                      : data?.creators?.join(", ")
                  }
                />
                <InfoRow
                  label="Cast"
                  value={data ? castSummary(data.cast, data.castTotal) : ""}
                />
                <InfoRow label="Writer" value={data?.writers?.join(", ")} />
                <InfoRow label="Genres" value={data?.genres?.join(", ")} />
                <InfoRow label="Maturity Rating" value={data?.maturityRating} />
              </div>
            </section>
          </div>
        </div>
      </div>

      {selectedTrailer && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/88 p-6 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setSelectedTrailer(null)}
            className="absolute right-5 top-5 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
            title="Close trailer"
          >
            <X size={18} weight="bold" />
          </button>

          <div className="w-full max-w-5xl overflow-hidden rounded-[24px] border border-white/10 bg-black shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${selectedTrailer}?autoplay=1&rel=0`}
                title={`${title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.03] px-4 py-4">
      <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-white/35">
        {label}
      </p>
      <p className="leading-6 text-white/74">{value || "Not available"}</p>
    </div>
  );
}

function SimilarCard({ item }: { item: TMDBItem }) {
  const title = getTitle(item);
  const image = backdropUrl(item.logo_backdrop_path || item.backdrop_path, "w780");

  if (!image) return null;

  return (
    <div className="overflow-hidden rounded-xl bg-white/[0.03] text-left transition hover:bg-white/[0.06]">
      <div className="relative aspect-video">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(max-width: 768px) 100vw, 18rem"
          className="object-cover"
        />
      </div>
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-medium text-white">{title}</p>
      </div>
    </div>
  );
}
