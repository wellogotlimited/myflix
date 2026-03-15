import BrowseGrid from "@/components/BrowseGrid";
import { attachCardContext, getPopularShows, getTopRatedShows } from "@/lib/tmdb";

export default async function ShowsPage() {
  const [popular, topRated] = await Promise.all([
    getPopularShows(),
    getTopRatedShows(),
  ]);

  const items = await attachCardContext([...popular, ...topRated]);
  return <BrowseGrid title="Shows" items={items} />;
}
