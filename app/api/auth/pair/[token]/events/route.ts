import { NextResponse } from "next/server";
import { connectToDatabase, DevicePairingModel } from "@/lib/db";
import { isPairingExpired } from "@/lib/pairing";

export const dynamic = "force-dynamic";

function encodeSse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  await connectToDatabase();

  const pairing = await DevicePairingModel.findOne({ token }).lean();
  if (!pairing || isPairingExpired(pairing.expiresAt)) {
    return NextResponse.json({ error: "Pairing session expired" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let lastStatus = pairing.status;
      let lastExchangeToken = pairing.exchangeToken ?? null;

      const sendState = () => {
        const initialPayload =
          lastStatus === "approved" && lastExchangeToken
            ? { status: "approved", exchangeToken: lastExchangeToken }
            : { status: lastStatus };

        controller.enqueue(encoder.encode(encodeSse("state", initialPayload)));
      };

      sendState();

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15000);

      const watchPairing = setInterval(async () => {
        if (closed) return;

        const current = await DevicePairingModel.findOne({ token }).lean();
        if (!current || isPairingExpired(current.expiresAt)) {
          controller.enqueue(encoder.encode(encodeSse("expired", {})));
          closed = true;
          cleanup();
          controller.close();
          return;
        }

        if (
          current.status === lastStatus &&
          (current.exchangeToken ?? null) === lastExchangeToken
        ) {
          return;
        }

        lastStatus = current.status;
        lastExchangeToken = current.exchangeToken ?? null;

        if (lastStatus === "approved" && lastExchangeToken) {
          controller.enqueue(
            encoder.encode(
              encodeSse("approved", {
                exchangeToken: lastExchangeToken,
              })
            )
          );
          return;
        }

        controller.enqueue(encoder.encode(encodeSse("state", { status: lastStatus })));

        if (lastStatus === "consumed") {
          controller.enqueue(encoder.encode(encodeSse("consumed", {})));
          closed = true;
          cleanup();
          controller.close();
        }
      }, 1000);

      const cleanup = () => {
        clearInterval(heartbeat);
        clearInterval(watchPairing);
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
