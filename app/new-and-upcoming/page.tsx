export const dynamic = "force-dynamic";

import BrowseGrid from "@/components/BrowseGrid";
import {
  attachCardContext,
  getUpcomingMovies,
} from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";

export default async function NewAndUpcomingPage() {
  const [profile, movies] = await Promise.all([
    requireProfile(),
    getUpcomingMovies(4),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const all = await attachCardContext(movies);
  const items = all.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel));
  return <BrowseGrid title="New & Upcoming" items={items} mobilePortrait />;
}
