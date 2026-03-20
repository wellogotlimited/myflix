"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { detectTvMode } from "@/lib/tv-mode";
import {
  TV_RECEIVER_COMMAND_EVENT,
  TV_RECEIVER_STATUS_EVENT,
  TV_RECEIVER_STORAGE_KEY,
  type TvReceiverCommand,
  type TvReceiverStatusPayload,
  readStorageValue,
  writeStorageValue,
} from "@/lib/tv-remote";

function buildCurrentPath(pathname: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export default function TvReceiverBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [isTv, setIsTv] = useState(false);
  const [registeredReceiverId, setRegisteredReceiverId] = useState<string | null>(null);
  const currentPathRef = useRef("");
  const receiverId = useMemo(() => {
    if (!isTv || typeof window === "undefined") return null;

    return (
      searchParams.get("receiver") ||
      registeredReceiverId ||
      readStorageValue(TV_RECEIVER_STORAGE_KEY)
    );
  }, [isTv, registeredReceiverId, searchParams]);

  useEffect(() => {
    let cancelled = false;

    void detectTvMode()
      .then((result) => {
        if (!cancelled) {
          setIsTv(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsTv(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    currentPathRef.current = buildCurrentPath(pathname, new URLSearchParams(searchParams.toString()));
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!isTv || status !== "authenticated" || receiverId) return;

    let cancelled = false;
    const existingReceiverId =
      typeof window !== "undefined" ? readStorageValue(TV_RECEIVER_STORAGE_KEY) : null;

    void fetch("/api/tv/receiver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiverId: existingReceiverId,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Receiver registration failed");
        }

        const data = (await response.json()) as {
          receiver?: { id: string } | null;
        };

        if (cancelled || !data.receiver?.id) return;

        writeStorageValue(TV_RECEIVER_STORAGE_KEY, data.receiver.id);
        setRegisteredReceiverId(data.receiver.id);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isTv, receiverId, status]);

  useEffect(() => {
    if (!receiverId) return;
    writeStorageValue(TV_RECEIVER_STORAGE_KEY, receiverId);
  }, [receiverId]);

  useEffect(() => {
    if (!isTv || !receiverId || status !== "authenticated") return;

    const heartbeat = () => {
      void fetch(`/api/tv/receiver/${receiverId}/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    };

    heartbeat();
    const heartbeatTimer = setInterval(heartbeat, 20_000);
    const eventSource = new EventSource(`/api/tv/receiver/${receiverId}/events`);

    eventSource.addEventListener("command", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as TvReceiverCommand;
      if (payload.kind === "navigate") {
        if (payload.settings) {
          writeStorageValue("myflix-dev-mode", String(payload.settings.devMode));
          writeStorageValue(
            "myflix-proxy-enabled",
            String(payload.settings.proxyEnabled)
          );
        }

        if (!payload.path || payload.path === currentPathRef.current) {
          return;
        }

        startTransition(() => {
          router.replace(payload.path, { scroll: false });
        });
        return;
      }

      window.dispatchEvent(
        new CustomEvent<TvReceiverCommand>(TV_RECEIVER_COMMAND_EVENT, {
          detail: payload,
        })
      );
    });

    eventSource.addEventListener("status", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as TvReceiverStatusPayload;
      window.dispatchEvent(
        new CustomEvent<TvReceiverStatusPayload>(TV_RECEIVER_STATUS_EVENT, {
          detail: payload,
        })
      );
    });

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSource.close();
      }
    };

    return () => {
      clearInterval(heartbeatTimer);
      eventSource.close();
    };
  }, [isTv, receiverId, router, status]);

  return null;
}
