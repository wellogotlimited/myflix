import { NextResponse } from "next/server";
import { z } from "zod";
import { getPlaybackPreferences, upsertPlaybackPreferences } from "@/lib/preferences";
import { requireProfile } from "@/lib/session";

const schema = z.object({
  proxyEnabled: z.boolean().optional(),
  devMode: z.boolean().optional(),
  autoplayNextEpisode: z.boolean().optional(),
  preferredQuality: z.string().min(1).optional(),
  subtitleLanguage: z.string().min(1).optional(),
  audioLanguage: z.string().min(1).optional(),
  captionsEnabled: z.boolean().optional(),
  subtitleDelay: z.number().optional(),
  subtitleFontScale: z.number().min(50).max(200).optional(),
  reducedMotion: z.boolean().optional(),
  largerControls: z.boolean().optional(),
  highContrast: z.boolean().optional(),
  keyboardShortcuts: z.boolean().optional(),
});

export async function GET() {
  const session = await requireProfile();
  const preferences = await getPlaybackPreferences(session.accountId, session.profileId);
  return NextResponse.json(preferences);
}

export async function PUT(req: Request) {
  const session = await requireProfile();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const preferences = await upsertPlaybackPreferences(
    session.accountId,
    session.profileId,
    parsed.data
  );
  return NextResponse.json(preferences);
}
