import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { connectToDatabase, TvReceiverModel } from "@/lib/db";
import { TV_RECEIVER_ONLINE_WINDOW_MS } from "@/lib/tv-remote";

const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("navigate"),
    path: z.string().min(1),
    title: z.string().max(200).nullable().optional(),
    settings: z
      .object({
        devMode: z.boolean(),
        proxyEnabled: z.boolean(),
      })
      .nullable()
      .optional(),
  }),
  z.object({
    kind: z.literal("playback"),
    action: z.enum(["play", "pause", "toggle", "seek"]),
    positionSec: z.number().min(0).nullable().optional(),
  }),
  z.object({
    kind: z.literal("caption"),
    action: z.literal("set"),
    captionIndex: z.number().int().min(-1),
  }),
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.accountId || !session.user.profileId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const { id } = await params;
  await connectToDatabase();

  const receiver = await TvReceiverModel.findById(id);
  if (!receiver || receiver.accountId !== session.user.accountId) {
    return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
  }
  if (receiver.lastSeenAt.getTime() < Date.now() - TV_RECEIVER_ONLINE_WINDOW_MS) {
    return NextResponse.json({ error: "Receiver offline" }, { status: 409 });
  }

  receiver.commandNonce = crypto.randomUUID();
  receiver.commandKind = parsed.data.kind;
  receiver.commandPath = parsed.data.kind === "navigate" ? parsed.data.path : null;
  receiver.commandTitle = parsed.data.kind === "navigate" ? parsed.data.title ?? null : null;
  receiver.commandDevMode =
    parsed.data.kind === "navigate" ? parsed.data.settings?.devMode ?? null : null;
  receiver.commandProxyEnabled =
    parsed.data.kind === "navigate" ? parsed.data.settings?.proxyEnabled ?? null : null;
  receiver.commandAction = parsed.data.kind === "playback" ? parsed.data.action : null;
  receiver.commandCaptionAction =
    parsed.data.kind === "caption" ? parsed.data.action : null;
  receiver.commandCaptionIndex =
    parsed.data.kind === "caption" ? parsed.data.captionIndex : null;
  receiver.commandPositionSec =
    parsed.data.kind === "playback" ? parsed.data.positionSec ?? null : null;
  receiver.commandSentAt = new Date();
  await receiver.save();

  return NextResponse.json({ ok: true });
}
