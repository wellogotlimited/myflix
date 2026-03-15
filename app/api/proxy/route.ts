import { NextRequest, NextResponse } from "next/server";

const HEADER_MAP: Record<string, string> = {
  "x-cookie": "cookie",
  "x-referer": "referer",
  "x-origin": "origin",
  "x-user-agent": "user-agent",
  "x-x-real-ip": "x-real-ip",
};

export async function GET(req: NextRequest) {
  return handleProxy(req);
}

export async function POST(req: NextRequest) {
  return handleProxy(req);
}

async function handleProxy(req: NextRequest) {
  const destination = req.nextUrl.searchParams.get("destination");
  if (!destination) {
    return NextResponse.json({ error: "Missing destination" }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      const mapped = HEADER_MAP[key.toLowerCase()];
      if (mapped) {
        headers[mapped] = value;
      }
    });

    const body = req.method === "POST" ? await req.text() : undefined;

    const response = await fetch(destination, {
      method: req.method,
      headers,
      body,
      redirect: "follow",
    });

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const responseBody = await response.arrayBuffer();

    const resHeaders = new Headers({
      "content-type": contentType,
      "X-Final-Destination": response.url,
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      resHeaders.set("X-Set-Cookie", setCookie);
    }

    return new NextResponse(responseBody, {
      status: response.status,
      headers: resHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
