import BrowseGrid from "@/components/BrowseGrid";
import { attachCardContext, getAnimeShows } from "@/lib/tmdb";

export default async function AnimesPage() {
  const items = await attachCardContext(await getAnimeShows());
  return <BrowseGrid title="Animes" items={items} />;
}
