export const dynamic = "force-dynamic";

import BrowseGrid from "@/components/BrowseGrid";
import {
  attachCardContext,
  dedupeTMDBItems,
  getPopularShows,
  getTopRatedShows,
} from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";

export default async function ShowsPage() {
  const [profile, popular, topRated] = await Promise.all([
    requireProfile(),
    getPopularShows(4),
    getTopRatedShows(4),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const all = await attachCardContext(dedupeTMDBItems([...popular, ...topRated]));
  const items = all.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel));
  return <BrowseGrid title="Shows" items={items} />;
}
