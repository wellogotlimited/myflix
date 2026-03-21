"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookmarkSimple, CaretRight, Play } from "@phosphor-icons/react";
import MediaDetailsModal from "./MediaDetailsModal";
import RatingButtons from "./RatingButtons";
import { useMyList } from "@/lib/my-list";
import { useResumeProgress } from "@/lib/use-resume-progress";
import { useMediaDetails } from "@/lib/use-media-details";
import { TMDBItem, backdropUrl, posterUrl, getMediaType } from "@/lib/tmdb";

function isNewRelease(item: TMDBItem): boolean {
  const dateStr = item.release_date || item.first_air_date;
  if (!dateStr) return false;
  const daysAgo = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  return daysAgo <= 45;
}

type MediaCardLayout = "rail" | "grid";

function formatRuntime(minutes: number | null | undefined) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function MediaCard({
  item,
  layout = "rail",
  portrait = false,
}: {
  item: TMDBItem;
  layout?: MediaCardLayout;
  portrait?: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [previewRect, setPreviewRect] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const type = getMediaType(item);
  const cardImage = portrait
    ? posterUrl(item.poster_path, "w342")
    : backdropUrl(item.logo_backdrop_path || item.backdrop_path, "w780");
  const isGrid = layout === "grid";
  const { isSaved, toggle } = useMyList(item);
  const resumeProgress = useResumeProgress(item, previewOpen);
  const { data: previewData } = useMediaDetails(item, previewOpen);
  const previewTrailerKey = previewData?.trailers?.[0]?.key ?? null;
  const previewWatchHref =
    type === "tv" && resumeProgress?.seasonNumber && resumeProgress?.episodeNumber
      ? `/watch/${type}/${item.id}?season=${resumeProgress.seasonNumber}&episode=${resumeProgress.episodeNumber}`
      : `/watch/${type}/${item.id}`;

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const positionPreview = () => {
    if (!cardRef.current || typeof window === "undefined") return;

    const rect = cardRef.current.getBoundingClientRect();
    const width = 332;
    const height = 250;
    const left = Math.min(
      Math.max(16, rect.left - 10),
      window.innerWidth - width - 16
    );
    const top = Math.min(
      Math.max(88, rect.top - 12),
      window.innerHeight - height - 16
    );

    setPreviewRect({ top, left });
  };

  const openPreview = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

    hoverTimerRef.current = setTimeout(() => {
      positionPreview();
      setPreviewOpen(true);
    }, 420);
  };

  const closePreviewNow = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    hoverTimerRef.current = null;
    closeTimerRef.current = null;
    setPreviewOpen(false);
  };

  const scheduleClosePreview = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setPreviewOpen(false);
    }, 160);
  };

  if (!cardImage) return null;

  if (portrait) {
    const portraitSizes = isGrid
      ? "(max-width: 379px) 44vw, (max-width: 767px) 29vw, 220px"
      : "112px";
    const showNewBadge = isNewRelease(item);

    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={`overflow-hidden rounded-md shadow-[0_10px_24px_rgba(0,0,0,0.2)] ${
            isGrid ? "w-full min-w-0" : "w-28 flex-shrink-0"
          }`}
        >
          <div className="relative aspect-[2/3]">
            <Image
              src={cardImage}
              alt=""
              fill
              sizes={portraitSizes}
              className="object-cover"
            />
            {showNewBadge && (
              <div className="absolute bottom-0 left-2 rounded-t-md bg-[#e50914] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white shadow-md">
                New
              </div>
            )}
          </div>
        </button>
        {modalOpen ? (
          <MediaDetailsModal
            item={item}
            open={modalOpen}
            onClose={() => setModalOpen(false)}
          />
        ) : null}
      </>
    );
  }

  const metaLabel =
    type === "movie"
      ? formatRuntime(item.runtime)
      : item.episodeCount
        ? `${item.episodeCount} Episodes`
        : null;

  return (
    <>
      <div
        ref={cardRef}
        className={`relative ${isGrid ? "w-full min-w-0" : "flex-shrink-0"}`}
        onMouseEnter={openPreview}
        onMouseLeave={scheduleClosePreview}
      >
        <button
          type="button"
          onClick={() => {
            closePreviewNow();
            setModalOpen(true);
          }}
          className={`group relative block overflow-hidden rounded-lg shadow-[0_10px_24px_rgba(0,0,0,0.2)] ${
            isGrid ? "w-full" : "w-[280px]"
          }`}
        >
          <div className="relative aspect-video">
            <Image
              src={cardImage}
              alt=""
              fill
              sizes={isGrid ? "(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw" : "280px"}
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {isNewRelease(item) && (
              <div className="absolute bottom-0 left-2 rounded-t-md bg-[#e50914] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-white shadow-md">
                New
              </div>
            )}
          </div>
        </button>
      </div>

      {previewOpen &&
        previewRect &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed z-[80] w-[332px] overflow-hidden rounded-lg border border-white/10 bg-[#181818] shadow-[0_24px_80px_rgba(0,0,0,0.45)]"
            style={{ top: previewRect.top, left: previewRect.left }}
            onMouseEnter={openPreview}
            onMouseLeave={scheduleClosePreview}
          >
            <button
              type="button"
              onClick={() => {
                closePreviewNow();
                setModalOpen(true);
              }}
              className="block w-full text-left"
            >
              <div className="relative aspect-video overflow-hidden">
                {previewTrailerKey ? (
                  <iframe
                    key={`preview-${item.id}`}
                    src={`https://www.youtube-nocookie.com/embed/${previewTrailerKey}?autoplay=1&mute=1&controls=0&loop=1&playlist=${previewTrailerKey}&rel=0&modestbranding=1&playsinline=1&fs=0&iv_load_policy=3&disablekb=1`}
                    title=""
                    aria-hidden
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  />
                ) : (
                  <Image
                    src={cardImage}
                    alt=""
                    fill
                    sizes="332px"
                    className="object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>
            </button>

            <div className="space-y-3 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Link
                    href={previewWatchHref}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/92"
                    title="Resume playback"
                  >
                    <Play size={16} weight="fill" />
                  </Link>
                  <button
                    type="button"
                    onClick={toggle}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/16"
                    title={isSaved ? "Remove from My List" : "Add to My List"}
                  >
                    <BookmarkSimple
                      size={16}
                      weight={isSaved ? "fill" : "regular"}
                    />
                  </button>
                  <RatingButtons item={item} />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    closePreviewNow();
                    setModalOpen(true);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/16"
                  title="More info"
                >
                  <CaretRight size={16} weight="bold" />
                </button>
              </div>

              <div className="space-y-2 text-sm text-white/78">
                <div className="flex flex-wrap items-center gap-2">
                  {metaLabel ? (
                    <p className="font-medium text-white">{metaLabel}</p>
                  ) : null}
                  {item.maturityRating ? (
                    <span className="border border-white/28 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-white/78">
                      {item.maturityRating}
                    </span>
                  ) : null}
                </div>
                {item.genres?.length ? (
                  <p className="line-clamp-1 text-xs text-white/58">
                    {item.genres.slice(0, 3).join(", ")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>,
          document.body
        )}

      {modalOpen ? (
        <MediaDetailsModal
          item={item}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}
