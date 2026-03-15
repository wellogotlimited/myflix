export const dynamic = "force-dynamic";

import BrowseGrid from "@/components/BrowseGrid";
import { attachCardContext, getPopularShows, getTopRatedShows } from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";

export default async function ShowsPage() {
  const [profile, popular, topRated] = await Promise.all([
    requireProfile(),
    getPopularShows(),
    getTopRatedShows(),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const all = await attachCardContext([...popular, ...topRated]);
  const items = all.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel));
  return <BrowseGrid title="Shows" items={items} />;
}
