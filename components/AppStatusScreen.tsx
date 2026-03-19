"use client";

import Link from "next/link";
import BrandWordmark from "@/components/BrandWordmark";
import {
  ArrowClockwise,
  House,
  MagnifyingGlass,
  WarningDiamond,
} from "@phosphor-icons/react";

type Action =
  | {
      kind: "link";
      href: string;
      label: string;
      icon?: "home" | "search";
    }
  | {
      kind: "button";
      onClick: () => void;
      label: string;
      icon?: "retry";
    };

function ActionIcon({ icon }: { icon?: "home" | "search" | "retry" }) {
  if (icon === "home") return <House size={18} weight="fill" />;
  if (icon === "search") return <MagnifyingGlass size={18} weight="bold" />;
  if (icon === "retry") return <ArrowClockwise size={18} weight="bold" />;
  return null;
}

export default function AppStatusScreen({
  eyebrow,
  code,
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  eyebrow: string;
  code: string;
  title: string;
  description: string;
  primaryAction: Action;
  secondaryAction?: Action;
}) {
  const actionClass =
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition";

  return (
    <section className="relative isolate min-h-screen overflow-hidden bg-[#090909] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(229,9,20,0.28),transparent_28%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.12),transparent_24%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.02)_0%,transparent_42%,rgba(255,255,255,0.03)_100%)]" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-4 pb-24 pt-20 md:px-8 md:pb-12 md:pt-24">
        <div className="grid items-center gap-10 md:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] md:gap-14">
          <div className="order-2 space-y-6 md:order-1 md:max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/68">
              <span className="inline-flex h-2 w-2 rounded-full bg-[#e50914]" />
              {eyebrow}
            </div>

            <div className="space-y-4">
              <p className="text-sm font-medium text-white/44 md:text-base">{code}</p>
              <h1 className="max-w-3xl text-4xl font-black leading-none tracking-[-0.04em] text-white md:text-7xl">
                {title}
              </h1>
              <p className="max-w-xl text-sm leading-6 text-white/68 md:text-lg md:leading-8">
                {description}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {primaryAction.kind === "link" ? (
                <Link
                  href={primaryAction.href}
                  className={`${actionClass} bg-white text-black hover:bg-white/88`}
                >
                  <ActionIcon icon={primaryAction.icon} />
                  {primaryAction.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  className={`${actionClass} bg-white text-black hover:bg-white/88`}
                >
                  <ActionIcon icon={primaryAction.icon} />
                  {primaryAction.label}
                </button>
              )}

              {secondaryAction ? (
                secondaryAction.kind === "link" ? (
                  <Link
                    href={secondaryAction.href}
                    className={`${actionClass} border border-white/14 bg-white/6 text-white hover:border-white/24 hover:bg-white/10`}
                  >
                    <ActionIcon icon={secondaryAction.icon} />
                    {secondaryAction.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={secondaryAction.onClick}
                    className={`${actionClass} border border-white/14 bg-white/6 text-white hover:border-white/24 hover:bg-white/10`}
                  >
                    <ActionIcon icon={secondaryAction.icon} />
                    {secondaryAction.label}
                  </button>
                )
              ) : null}
            </div>
          </div>

          <div className="order-1 md:order-2">
            <div className="relative mx-auto flex aspect-[4/5] w-full max-w-[320px] items-end overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_100%)] p-5 shadow-[0_30px_90px_rgba(0,0,0,0.45)] md:max-w-[420px] md:p-7">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_42%)]" />
              <div className="absolute left-6 top-6 rounded-full border border-white/12 bg-black/25 p-3 text-white/80 backdrop-blur-sm md:left-7 md:top-7">
                <WarningDiamond size={28} weight="fill" />
              </div>

              <div className="absolute inset-x-5 bottom-5 top-24 rounded-[24px] border border-dashed border-white/12 bg-[linear-gradient(180deg,rgba(229,9,20,0.18),rgba(255,255,255,0.02))] md:inset-x-7 md:bottom-7">
                <div className="absolute left-5 right-5 top-5 space-y-3 md:left-6 md:right-6 md:top-6">
                  <div className="h-2.5 w-20 rounded-full bg-white/18" />
                  <div className="h-2.5 w-36 rounded-full bg-white/12" />
                </div>
              </div>

              <div className="relative z-10 w-full rounded-[24px] border border-white/10 bg-black/36 p-5 backdrop-blur-md md:p-6">
                <BrandWordmark
                  size={24}
                  textClassName="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60"
                />
                <div className="mt-4 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-5xl font-black tracking-[-0.06em] text-white md:text-6xl">
                      {code}
                    </p>
                    <p className="mt-2 text-sm text-white/56">
                      {eyebrow.toLowerCase()}
                    </p>
                  </div>
                  <div className="h-14 w-14 rounded-2xl bg-[#e50914] shadow-[0_14px_30px_rgba(229,9,20,0.36)]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
