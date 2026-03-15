import BrowseGrid from "@/components/BrowseGrid";
import { attachCardContext, getPopularMovies, getTopRatedMovies } from "@/lib/tmdb";

export default async function MoviesPage() {
  const [popular, topRated] = await Promise.all([
    getPopularMovies(),
    getTopRatedMovies(),
  ]);

  const items = await attachCardContext([...popular, ...topRated]);
  return <BrowseGrid title="Movies" items={items} />;
}
