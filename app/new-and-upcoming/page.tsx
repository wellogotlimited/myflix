export const dynamic = "force-dynamic";

import BrowseGrid from "@/components/BrowseGrid";
import {
  attachCardContext,
  getOnTheAirShows,
  getUpcomingMovies,
} from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";

export default async function NewAndUpcomingPage() {
  const [profile, movies, shows] = await Promise.all([
    requireProfile(),
    getUpcomingMovies(),
    getOnTheAirShows(),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const all = await attachCardContext([...movies, ...shows]);
  const items = all.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel));
  return <BrowseGrid title="New & Upcoming" items={items} />;
}
