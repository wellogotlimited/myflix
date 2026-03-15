export const dynamic = "force-dynamic";

import BrowseGrid from "@/components/BrowseGrid";
import { attachCardContext, getPopularMovies, getTopRatedMovies } from "@/lib/tmdb";
import { requireProfile } from "@/lib/session";
import { passesMaturityFilter } from "@/lib/maturity";

export default async function MoviesPage() {
  const [profile, popular, topRated] = await Promise.all([
    requireProfile(),
    getPopularMovies(),
    getTopRatedMovies(),
  ]);

  const maturityLevel = profile?.maturityLevel ?? "ADULT";
  const all = await attachCardContext([...popular, ...topRated]);
  const items = all.filter((item) => passesMaturityFilter(item.maturityRating, maturityLevel));
  return <BrowseGrid title="Movies" items={items} />;
}
