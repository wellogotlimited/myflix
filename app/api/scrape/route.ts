import { NextRequest } from "next/server";
import {
  makeProviders,
  makeStandardFetcher,
  targets,
} from "@p-stream/providers";

function getServerProviders() {
  return makeProviders({
    fetcher: makeStandardFetcher(fetch),
    target: targets.ANY,
    consistentIpForRequests: false,
  });
}

export async function POST(req: NextRequest) {
  const media = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        const providers = getServerProviders();

        const result = await providers.runAll({
          media,
          events: {
            init(evt) {
              send("init", evt);
            },
            start(id) {
              send("start", { id });
            },
            update(evt) {
              send("update", {
                id: evt.id,
                percentage: evt.percentage,
                status: evt.status,
                reason: evt.reason,
              });
            },
            discoverEmbeds(evt) {
              send("discoverEmbeds", evt);
            },
          },
        });

        if (result?.stream) {
          send("result", result);
        } else {
          send("error", { message: "No working sources found." });
        }
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Scraping failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
