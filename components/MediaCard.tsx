"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookmarkSimple, CaretRight, Play } from "@phosphor-icons/react";
import MediaDetailsModal from "./MediaDetailsModal";
import { useMyList } from "@/lib/my-list";
import { TMDBItem, backdropUrl, getMediaType } from "@/lib/tmdb";

function formatRuntime(minutes: number | null | undefined) {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function MediaCard({ item }: { item: TMDBItem }) {
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
  const cardImage = backdropUrl(
    item.logo_backdrop_path || item.backdrop_path,
    "w780"
  );
  const { isSaved, toggle } = useMyList(item);

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
        className="relative flex-shrink-0"
        onMouseEnter={openPreview}
        onMouseLeave={scheduleClosePreview}
      >
        <button
          type="button"
          onClick={() => {
            closePreviewNow();
            setModalOpen(true);
          }}
          className="group relative block w-[280px] overflow-hidden rounded-lg shadow-[0_10px_24px_rgba(0,0,0,0.2)]"
        >
          <div className="relative aspect-video">
            <Image
              src={cardImage}
              alt=""
              fill
              sizes="280px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
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
              <div className="relative aspect-video">
                <Image
                  src={cardImage}
                  alt=""
                  fill
                  sizes="332px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>
            </button>

            <div className="space-y-3 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/watch/${type}/${item.id}`}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/92"
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
