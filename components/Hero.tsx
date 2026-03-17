"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Play, SpeakerSimpleHigh, SpeakerSimpleSlash, X } from "@phosphor-icons/react";
import { TMDBItem, backdropUrl, getMediaType, getTitle, getYear } from "@/lib/tmdb";

export default function Hero({
  item,
  logoPath,
  trailerKey,
}: {
  item: TMDBItem;
  logoPath?: string | null;
  trailerKey?: string | null;
}) {
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [bgVideoVisible, setBgVideoVisible] = useState(false);
  const [muted, setMuted] = useState(true);
  const type = getMediaType(item);
  const title = getTitle(item);
  const bg = backdropUrl(item.backdrop_path, "original");
  const logo = logoPath ? backdropUrl(logoPath, "original") : "";

  useEffect(() => {
    setBgVideoVisible(false);
    setMuted(true);
    if (!trailerKey) return;
    const timer = setTimeout(() => setBgVideoVisible(true), 3500);
    return () => clearTimeout(timer);
  }, [item.id, trailerKey]);

  const bgVideoSrc = trailerKey
    ? `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${trailerKey}&rel=0&modestbranding=1&playsinline=1&fs=0&iv_load_policy=3&disablekb=1`
    : null;

  return (
    <>
      <section className="relative h-[78vh] min-h-[42rem] w-full overflow-hidden">
        {bg && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bg})` }}
          />
        )}

        {bgVideoSrc && (
          <div
            className={`absolute inset-0 transition-opacity duration-1000 ${bgVideoVisible ? "opacity-100" : "opacity-0"}`}
          >
            <iframe
              key={`hero-${trailerKey}-${muted}`}
              src={bgVideoSrc}
              title=""
              aria-hidden
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{
                width: "100%",
                height: "56.25vw",
                minWidth: "177.78vh",
                minHeight: "100%",
              }}
            />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/35 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0d] via-[#141414]/40 to-transparent" />

        <div className="absolute inset-x-6 bottom-24 z-10 md:left-12 md:right-12">
          <div className="max-w-2xl">
            {logo ? (
              <div className="relative mb-6 h-28 w-full max-w-[32rem] md:h-32">
                <Image
                  src={logo}
                  alt={title}
                  fill
                  sizes="(max-width: 768px) 80vw, 32rem"
                  className="object-contain object-left"
                  priority
                />
              </div>
            ) : (
              <h1 className="mb-4 text-5xl font-black text-white drop-shadow-lg md:text-7xl">
                {title}
              </h1>
            )}

            <div className="mb-5 flex items-center gap-3 text-sm text-white/72">
              {getYear(item) && <span>{getYear(item)}</span>}
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs uppercase tracking-[0.16em]">
                {type === "movie" ? "Movie" : "Series"}
              </span>
            </div>

            <p className="max-w-xl text-sm leading-6 text-white/78 md:text-base md:leading-7">
              {item.overview}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={`/watch/${type}/${item.id}`}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                <Play size={18} weight="fill" />
                Play
              </Link>
              {trailerKey && !bgVideoVisible && (
                <button
                  type="button"
                  onClick={() => setTrailerOpen(true)}
                  className="rounded-full border border-white/18 bg-white/8 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/14"
                >
                  Watch Trailer
                </button>
              )}
            </div>
          </div>
        </div>

        {bgVideoSrc && bgVideoVisible && (
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="absolute bottom-24 right-6 z-10 rounded-full border border-white/25 bg-black/40 p-3 text-white backdrop-blur-sm transition hover:bg-black/60 md:right-12"
            title={muted ? "Unmute" : "Mute"}
          >
            {muted
              ? <SpeakerSimpleSlash size={20} weight="bold" />
              : <SpeakerSimpleHigh size={20} weight="bold" />
            }
          </button>
        )}
      </section>

      {trailerOpen && trailerKey && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setTrailerOpen(false)}
            className="absolute right-5 top-5 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
            title="Close trailer"
          >
            <X size={18} weight="bold" />
          </button>

          <div className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-black shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`}
                title={`${title} trailer`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
