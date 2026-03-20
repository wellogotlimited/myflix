import { NextRequest, NextResponse } from "next/server";
import { getMediaDetails } from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const type = req.nextUrl.searchParams.get("type");

  if (!id || type !== "movie") {
    return NextResponse.json({ error: "Missing or invalid id/type" }, { status: 400 });
  }

  try {
    const details = await getMediaDetails(id, type);
    return NextResponse.json(details);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load details";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
