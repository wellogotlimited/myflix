export const dynamic = "force-dynamic";

import BrowseGrid from "@/components/BrowseGrid";
import { attachCardContext, getAnimeShows } from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";

export default async function AnimesPage() {
  const [profile, raw] = await Promise.all([requireProfile(), getAnimeShows(4)]);
  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const all = await attachCardContext(raw);
  const items = all.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel));
  return <BrowseGrid title="Animes" items={items} />;
}
