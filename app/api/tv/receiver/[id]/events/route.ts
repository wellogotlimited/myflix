import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectToDatabase, TvReceiverModel } from "@/lib/db";
import type { TvReceiverDoc } from "@/lib/db";
import type { TvReceiverStatusPayload } from "@/lib/tv-remote";

export const dynamic = "force-dynamic";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

type TvReceiverStatusSource = Pick<
  TvReceiverDoc,
  | "statusPath"
  | "statusTitle"
  | "statusRemoteConnected"
  | "statusCaptionsAvailable"
  | "statusCaptionsEnabled"
  | "statusCaptions"
  | "statusActiveCaptionIndex"
  | "statusIsPlaying"
  | "statusCurrentTimeSec"
  | "statusDurationSec"
  | "statusMediaType"
  | "statusTmdbId"
  | "statusSeasonNumber"
  | "statusEpisodeNumber"
  | "statusUpdatedAt"
>;

function buildStatusPayload(
  receiver: TvReceiverStatusSource | null | undefined
): TvReceiverStatusPayload {
  return {
    path: receiver?.statusPath ?? null,
    title: receiver?.statusTitle ?? null,
    remoteConnected: receiver?.statusRemoteConnected ?? false,
    captionsAvailable: receiver?.statusCaptionsAvailable ?? false,
    captionsEnabled: receiver?.statusCaptionsEnabled ?? false,
    captions: receiver?.statusCaptions ?? [],
    activeCaptionIndex: receiver?.statusActiveCaptionIndex ?? -1,
    isPlaying: receiver?.statusIsPlaying ?? false,
    currentTimeSec: receiver?.statusCurrentTimeSec ?? 0,
    durationSec: receiver?.statusDurationSec ?? 0,
    mediaType: receiver?.statusMediaType ?? null,
    tmdbId: receiver?.statusTmdbId ?? null,
    seasonNumber: receiver?.statusSeasonNumber ?? null,
    episodeNumber: receiver?.statusEpisodeNumber ?? null,
    updatedAt:
      receiver?.statusUpdatedAt instanceof Date
        ? receiver.statusUpdatedAt.toISOString()
        : typeof receiver?.statusUpdatedAt === "string"
          ? receiver.statusUpdatedAt
          : null,
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  await connectToDatabase();

  const receiver = await TvReceiverModel.findById(id).lean();
  if (!receiver || receiver.accountId !== session.user.accountId) {
    return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastCommandNonce = receiver.commandNonce ?? null;
      let lastStatusNonce = receiver.statusNonce ?? null;

      controller.enqueue(encoder.encode(encodeSse("status", buildStatusPayload(receiver))));

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15000);

      const watchReceiver = setInterval(async () => {
        if (closed) return;

        const current = await TvReceiverModel.findById(id).lean();
        if (!current || current.accountId !== session.user.accountId) {
          closed = true;
          cleanup();
          controller.close();
          return;
        }

        const nextNonce = current.commandNonce ?? null;
        if (nextNonce && nextNonce !== lastCommandNonce) {
          lastCommandNonce = nextNonce;
          controller.enqueue(
            encoder.encode(
              encodeSse("command", {
                nonce: nextNonce,
                kind: current.commandKind ?? "navigate",
                path: current.commandPath,
                title: current.commandTitle,
                settings:
                  current.commandKind === "navigate"
                    ? {
                        devMode: current.commandDevMode ?? false,
                        proxyEnabled: current.commandProxyEnabled ?? false,
                      }
                    : null,
                action:
                  current.commandKind === "caption"
                    ? current.commandCaptionAction
                    : current.commandAction,
                captionIndex: current.commandCaptionIndex ?? -1,
                positionSec: current.commandPositionSec ?? null,
              })
            )
          );
        }

        const nextStatusNonce = current.statusNonce ?? null;
        if (!nextStatusNonce || nextStatusNonce === lastStatusNonce) {
          return;
        }

        lastStatusNonce = nextStatusNonce;
        controller.enqueue(encoder.encode(encodeSse("status", buildStatusPayload(current))));
      }, 1000);

      const cleanup = () => {
        clearInterval(heartbeat);
        clearInterval(watchReceiver);
      };

      req.signal.addEventListener(
        "abort",
        () => {
          if (closed) return;
          closed = true;
          cleanup();
        },
        { once: true }
      );
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
