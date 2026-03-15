import BrowseGrid from "@/components/BrowseGrid";
import {
  attachCardContext,
  getOnTheAirShows,
  getUpcomingMovies,
} from "@/lib/tmdb";

export default async function NewAndUpcomingPage() {
  const [movies, shows] = await Promise.all([
    getUpcomingMovies(),
    getOnTheAirShows(),
  ]);

  const items = await attachCardContext([...movies, ...shows]);
  return <BrowseGrid title="New & Upcoming" items={items} />;
}
