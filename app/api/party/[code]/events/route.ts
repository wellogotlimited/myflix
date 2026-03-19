import { NextResponse } from "next/server";
import { connectToDatabase, WatchPartyModel } from "@/lib/db";
import { subscribeToParty } from "@/lib/party-events";
import { requireProfile } from "@/lib/session";
import { serializePartyState } from "@/lib/party";

export const dynamic = "force-dynamic";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const session = await requireProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { code } = await params;
  await connectToDatabase();

  const party = await WatchPartyModel.findOne({ code }).lean();
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSse("state", serializePartyState(party))));

      let closed = false;
      const unsubscribe = subscribeToParty(code, (event) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeSse(event.type, event)));
        if (event.type === "ended") {
          closed = true;
          cleanup();
          controller.close();
        }
      });

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
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
    cancel() {
      return;
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
