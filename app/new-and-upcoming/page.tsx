export const dynamic = "force-dynamic";

import BrowseGrid from "@/components/BrowseGrid";
import {
  attachCardContext,
  dedupeTMDBItems,
  getOnTheAirShows,
  getUpcomingMovies,
} from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";

export default async function NewAndUpcomingPage() {
  const [profile, movies, shows] = await Promise.all([
    requireProfile(),
    getUpcomingMovies(4),
    getOnTheAirShows(4),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const all = await attachCardContext(dedupeTMDBItems([...movies, ...shows]));
  const items = all.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel));
  return <BrowseGrid title="New & Upcoming" items={items} mobilePortrait />;
}
