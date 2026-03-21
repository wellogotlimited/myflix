import {
  BookmarkModel,
  GenreAffinityModel,
  HiddenTitleModel,
  RatingModel,
  WatchProgressModel,
  connectToDatabase,
} from "@/lib/db";
import { getFilteredContent, getTitleSimilar, type TMDBItem } from "@/lib/tmdb";
import { filterHiddenTitles } from "@/lib/profile-controls";

export interface RecommendationRow {
  id: string;
  title: string;
  items: TMDBItem[];
}

const GENRE_LABELS: Record<number, string> = {
  12: "Adventure",
  14: "Fantasy",
  16: "Animation",
  18: "Drama",
  27: "Horror",
  28: "Action",
  35: "Comedy",
  36: "History",
  37: "Western",
  53: "Thriller",
  80: "Crime",
  99: "Documentary",
  878: "Sci-Fi",
  9648: "Mystery",
  10402: "Music",
  10749: "Romance",
  10751: "Family",
  10752: "War",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  10770: "TV Movie",
};

function getGenreLabel(genreId: number) {
  return GENRE_LABELS[genreId] ?? "For You";
}

function dedupe(items: TMDBItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const mediaType = item.media_type ?? (item.title ? "movie" : "tv");
    const key = `${mediaType}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function buildRecommendationRows(profileId: string) {
  await connectToDatabase();

  const [topGenres, recentProgress, likedRatings, hiddenTitles, bookmarks] = await Promise.all([
    GenreAffinityModel.find({ profileId }).sort({ score: -1 }).limit(3).lean(),
    WatchProgressModel.find({ profileId }).sort({ updatedAt: -1 }).limit(6).lean(),
    RatingModel.find({ profileId, rating: { $in: ["up", "love"] } })
      .sort({ ratedAt: -1 })
      .limit(4)
      .lean(),
    HiddenTitleModel.find({ profileId }).lean(),
    BookmarkModel.find({ profileId }).sort({ savedAt: -1 }).limit(12).lean(),
  ]);

  const rows: RecommendationRow[] = [];

  for (const genre of topGenres) {
    const [movies, shows] = await Promise.all([
      getFilteredContent("movie", {
        genreId: String(genre.genreId),
        sortBy: "popularity.desc",
        minRating: 6,
        pages: 1,
      }),
      getFilteredContent("tv", {
        genreId: String(genre.genreId),
        sortBy: "popularity.desc",
        minRating: 6,
        pages: 1,
      }),
    ]);
    const items = filterHiddenTitles(dedupe([...movies, ...shows]).slice(0, 20), hiddenTitles);
    if (items.length > 0) {
      rows.push({
        id: `genre-${genre.genreId}`,
        title: getGenreLabel(genre.genreId),
        items,
      });
    }
  }

  const forYouItems = filterHiddenTitles(
    dedupe(
      (
        await Promise.all(
          likedRatings.map((rating) => getTitleSimilar(rating.tmdbId, rating.mediaType))
        )
      ).flat()
    ).slice(0, 20),
    hiddenTitles
  );
  if (forYouItems.length > 0) {
    rows.push({
      id: "for-you",
      title: "For You",
      items: forYouItems,
    });
  }

  if (bookmarks.length > 0) {
    const genreIds = recentProgress.flatMap((item) => item.genreIds ?? []).slice(0, 3);
    if (genreIds.length > 0) {
      const [movies, shows] = await Promise.all([
        getFilteredContent("movie", {
          genreId: String(genreIds[0]),
          sortBy: "release_date.desc",
          minRating: 6,
          pages: 1,
        }),
        getFilteredContent("tv", {
          genreId: String(genreIds[0]),
          sortBy: "vote_average.desc",
          minRating: 6,
          pages: 1,
        }),
      ]);
      const items = filterHiddenTitles(dedupe([...movies, ...shows]).slice(0, 20), hiddenTitles);
      if (items.length > 0) {
        rows.push({
          id: "saved-titles",
          title: "Your List",
          items,
        });
      }
    }
  }

  return rows.slice(0, 6);
}

export function getTasteOverlapScore(left: number[], right: number[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}
