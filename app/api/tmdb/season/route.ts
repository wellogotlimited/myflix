import { NextRequest, NextResponse } from "next/server";
import { getSeasonEpisodes } from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  const showId = req.nextUrl.searchParams.get("showId");
  const season = req.nextUrl.searchParams.get("season");

  if (!showId || !season) {
    return NextResponse.json(
      { error: "Missing showId or season" },
      { status: 400 }
    );
  }

  const seasonNumber = Number.parseInt(season, 10);
  if (!Number.isFinite(seasonNumber)) {
    return NextResponse.json({ error: "Invalid season" }, { status: 400 });
  }

  try {
    const episodes = await getSeasonEpisodes(showId, seasonNumber);
    return NextResponse.json({ episodes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load season";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
