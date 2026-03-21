const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY not set");

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json() as Promise<T>;
}

export interface TMDBItem {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  media_type?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
  genre_ids?: number[];
  logo_backdrop_path?: string | null;
  runtime?: number | null;
  episodeCount?: number | null;
  maturityRating?: string | null;
  genres?: string[];
}

export interface TMDBHeroExtras {
  logoPath: string | null;
  trailerKey: string | null;
}

export interface TMDBMediaDetails {
  id: number;
  type: "movie" | "tv";
  title: string;
  overview: string;
  logoPath: string | null;
  backdropPath: string | null;
  posterPath: string | null;
  year: string;
  runtime: number | null;
  episodeCount: number | null;
  genres: string[];
  cast: string[];
  castTotal: number;
  directors: string[];
  writers: string[];
  creators: string[];
  maturityRating: string | null;
  seasons: TMDBSeason[];
  trailers: Array<{ key: string; name: string }>;
  similar: TMDBItem[];
}

interface TMDBList {
  results: TMDBItem[];
}

function normalizeListResult(item: TMDBItem, mediaType?: "movie" | "tv") {
  return mediaType ? { ...item, media_type: mediaType } : item;
}

async function tmdbFetchList(
  path: string,
  params: Record<string, string> = {},
  pages = 1,
  mediaType?: "movie" | "tv"
): Promise<TMDBItem[]> {
  const pageCount = Math.max(1, pages);
  const responses = await Promise.all(
    Array.from({ length: pageCount }, (_, index) =>
      tmdbFetch<TMDBList>(path, { ...params, page: String(index + 1) })
    )
  );

  return responses
    .flatMap((data) => data.results)
    .filter((item) => item.backdrop_path)
    .map((item) => normalizeListResult(item, mediaType));
}

export interface TMDBMovieDetails {
  id: number;
  title: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  runtime: number;
  imdb_id?: string;
  genres: { id: number; name: string }[];
}

export interface TMDBShowDetails {
  id: number;
  name: string;
  overview: string;
  backdrop_path: string | null;
  poster_path: string | null;
  first_air_date: string;
  vote_average: number;
  number_of_seasons: number;
  seasons: TMDBSeason[];
  genres: { id: number; name: string }[];
  external_ids?: { imdb_id?: string };
}

export interface TMDBSeason {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  air_date: string | null;
}

export interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date: string | null;
  runtime: number | null;
}

interface TMDBSeasonDetails {
  id: number;
  season_number: number;
  name: string;
  episodes: TMDBEpisode[];
}

export function backdropUrl(path: string | null, size: string = "w1280"): string {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function posterUrl(path: string | null, size: string = "w342"): string {
  if (!path) return "";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function getTitle(item: TMDBItem): string {
  return item.title || item.name || "Untitled";
}

export function getYear(item: TMDBItem): string {
  const date = item.release_date || item.first_air_date;
  return date ? date.substring(0, 4) : "";
}

export function getMediaType(item: TMDBItem): "movie" | "tv" {
  if (item.media_type) return item.media_type as "movie" | "tv";
  return item.title ? "movie" : "tv";
}

export function dedupeTMDBItems(items: TMDBItem[]): TMDBItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${getMediaType(item)}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getTrending(pages = 1): Promise<TMDBItem[]> {
  return tmdbFetchList("/trending/all/week", {}, pages);
}

export async function getPopularMovies(pages = 1): Promise<TMDBItem[]> {
  return tmdbFetchList("/movie/popular", {}, pages, "movie");
}

export async function getPopularShows(pages = 1): Promise<TMDBItem[]> {
  return tmdbFetchList("/tv/popular", {}, pages, "tv");
}

export async function getTopRatedMovies(pages = 1): Promise<TMDBItem[]> {
  return tmdbFetchList("/movie/top_rated", {}, pages, "movie");
}

export async function getTopRatedShows(pages = 1): Promise<TMDBItem[]> {
  return tmdbFetchList("/tv/top_rated", {}, pages, "tv");
}

export async function getUpcomingMovies(pages = 1): Promise<TMDBItem[]> {
  return tmdbFetchList("/movie/upcoming", {}, pages, "movie");
}

export async function getOnTheAirShows(pages = 1): Promise<TMDBItem[]> {
  return tmdbFetchList("/tv/on_the_air", {}, pages, "tv");
}

export async function getAnimeShows(pages = 1): Promise<TMDBItem[]> {
  return tmdbFetchList(
    "/discover/tv",
    {
      with_genres: "16",
      with_origin_country: "JP",
      sort_by: "popularity.desc",
    },
    pages,
    "tv"
  );
}

export async function getGenreItems(genreId: string, type: "movie" | "tv" = "movie"): Promise<TMDBItem[]> {
  return tmdbFetchList(
    `/discover/${type}`,
    { with_genres: genreId, sort_by: "popularity.desc" },
    1,
    type
  );
}

export async function searchMulti(query: string): Promise<TMDBItem[]> {
  const data = await tmdbFetch<TMDBList>("/search/multi", { query });
  return data.results.filter(
    (r) => (r.media_type === "movie" || r.media_type === "tv") && r.backdrop_path
  );
}

export async function getMovieDetails(id: string): Promise<TMDBMovieDetails> {
  return tmdbFetch<TMDBMovieDetails>(`/movie/${id}`, { append_to_response: "external_ids" });
}

export async function getShowDetails(id: string): Promise<TMDBShowDetails> {
  return tmdbFetch<TMDBShowDetails>(`/tv/${id}`, { append_to_response: "external_ids" });
}

export async function getSeasonEpisodes(showId: string, seasonNum: number): Promise<TMDBEpisode[]> {
  const data = await tmdbFetch<TMDBSeasonDetails>(`/tv/${showId}/season/${seasonNum}`);
  return data.episodes;
}

function getBestLogoPath(logos: TMDBLogoImage[] | undefined): string | null {
  const logo = (logos ?? [])
    .filter((item) => item.iso_639_1 === "en" || item.iso_639_1 === null)
    .sort((a, b) => b.vote_average - a.vote_average || b.width - a.width)[0];

  return logo?.file_path ?? null;
}

function getTrailerList(videos: TMDBVideo[] | undefined) {
  return (videos ?? [])
    .filter(
      (video) =>
        video.site === "YouTube" &&
        (video.type === "Trailer" || video.type === "Teaser") &&
        (video.iso_639_1 === "en" || video.iso_639_1 === null)
    )
    .slice(0, 8)
    .map((video) => ({
      key: video.key,
      name: video.name || video.type,
    }));
}

function uniqueNames(values: Array<string | undefined | null>) {
  const seen = new Set<string>();
  return values.filter((value): value is string => {
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function pickMovieCertification(releaseDates: TMDBReleaseDatesResponse | undefined) {
  const us = releaseDates?.results?.find((item) => item.iso_3166_1 === "US");
  const any = releaseDates?.results?.[0];
  const source = us ?? any;
  return source?.release_dates?.find((item) => item.certification)?.certification || null;
}

function pickTVRating(contentRatings: TMDBContentRatingsResponse | undefined) {
  const us = contentRatings?.results?.find((item) => item.iso_3166_1 === "US");
  return us?.rating || contentRatings?.results?.[0]?.rating || null;
}

export async function getMediaDetails(
  id: string | number,
  type: "movie" | "tv"
): Promise<TMDBMediaDetails> {
  if (type === "movie") {
    const data = await tmdbFetch<TMDBMovieDetailsExpanded>(`/movie/${id}`, {
      append_to_response: "credits,images,videos,similar,release_dates",
      include_image_language: "en,null",
    });

    return {
      id: data.id,
      type,
      title: data.title,
      overview: data.overview,
      logoPath: getBestLogoPath(data.images?.logos),
      backdropPath: data.backdrop_path,
      posterPath: data.poster_path,
      year: data.release_date?.slice(0, 4) ?? "",
      runtime: data.runtime ?? null,
      episodeCount: null,
      genres: data.genres?.map((genre) => genre.name) ?? [],
      cast: (data.credits?.cast ?? []).slice(0, 8).map((person) => person.name),
      castTotal: data.credits?.cast?.length ?? 0,
      directors: uniqueNames(
        (data.credits?.crew ?? [])
          .filter((person) => person.job === "Director")
          .map((person) => person.name)
      ),
      writers: uniqueNames(
        (data.credits?.crew ?? [])
          .filter((person) => ["Writer", "Screenplay", "Story"].includes(person.job ?? ""))
          .map((person) => person.name)
      ),
      creators: [],
      maturityRating: pickMovieCertification(data.release_dates),
      seasons: [],
      trailers: getTrailerList(data.videos?.results),
      similar: (data.similar?.results ?? [])
        .filter((item) => item.backdrop_path)
        .map((item) => ({ ...item, media_type: "movie" }))
        .slice(0, 12),
    };
  }

  const data = await tmdbFetch<TMDBTVDetailsExpanded>(`/tv/${id}`, {
    append_to_response: "aggregate_credits,images,videos,similar,content_ratings",
    include_image_language: "en,null",
  });

  return {
    id: data.id,
    type,
    title: data.name,
    overview: data.overview,
    logoPath: getBestLogoPath(data.images?.logos),
    backdropPath: data.backdrop_path,
    posterPath: data.poster_path,
    year: data.first_air_date?.slice(0, 4) ?? "",
    runtime: data.episode_run_time?.[0] ?? null,
    episodeCount: data.number_of_episodes ?? null,
    genres: data.genres?.map((genre) => genre.name) ?? [],
    cast: (data.aggregate_credits?.cast ?? []).slice(0, 8).map((person) => person.name),
    castTotal: data.aggregate_credits?.cast?.length ?? 0,
    directors: [],
    writers: uniqueNames(
      (data.aggregate_credits?.crew ?? [])
        .filter((person) =>
          (person.jobs ?? []).some((job) =>
            ["Writer", "Screenplay", "Story", "Teleplay"].includes(job.job)
          )
        )
        .map((person) => person.name)
    ),
    creators: uniqueNames((data.created_by ?? []).map((person) => person.name)),
    maturityRating: pickTVRating(data.content_ratings),
    seasons: (data.seasons ?? []).filter((season) => season.season_number > 0),
    trailers: getTrailerList(data.videos?.results),
    similar: (data.similar?.results ?? [])
      .filter((item) => item.backdrop_path)
      .map((item) => ({ ...item, media_type: "tv" }))
      .slice(0, 12),
  };
}

export async function getHeroExtras(
  id: number,
  type: "movie" | "tv"
): Promise<TMDBHeroExtras> {
  try {
    const data = await tmdbFetch<TMDBHeroDetailsResponse>(`/${type}/${id}`, {
      append_to_response: "images,videos",
      include_image_language: "en,null",
    });

    const trailer = getTrailerList(data.videos?.results)[0];

    return {
      logoPath: getBestLogoPath(data.images?.logos),
      trailerKey: trailer?.key ?? null,
    };
  } catch {
    return {
      logoPath: null,
      trailerKey: null,
    };
  }
}

// --- Logo backdrops ---

interface TMDBImage {
  file_path: string;
  iso_639_1: string | null;
  width: number;
  height: number;
  vote_average: number;
}

interface TMDBImagesResponse {
  backdrops: TMDBImage[];
}

interface TMDBMovieHoverDetails {
  runtime?: number | null;
  genres?: Array<{ id: number; name: string }>;
  release_dates?: TMDBReleaseDatesResponse;
}

interface TMDBTVHoverDetails {
  number_of_episodes?: number | null;
  genres?: Array<{ id: number; name: string }>;
  content_ratings?: TMDBContentRatingsResponse;
}

interface TMDBLogoImage {
  file_path: string;
  iso_639_1: string | null;
  width: number;
  height: number;
  vote_average: number;
}

interface TMDBVideo {
  key: string;
  name?: string;
  site: string;
  type: string;
  official?: boolean;
  iso_639_1?: string | null;
}

interface TMDBHeroDetailsResponse {
  images?: {
    logos?: TMDBLogoImage[];
  };
  videos?: {
    results?: TMDBVideo[];
  };
}

interface TMDBMovieCreditPerson {
  name: string;
  job?: string;
}

interface TMDBMovieCredits {
  cast?: Array<{ name: string }>;
  crew?: TMDBMovieCreditPerson[];
}

interface TMDBReleaseDatesResponse {
  results?: Array<{
    iso_3166_1: string;
    release_dates?: Array<{
      certification?: string;
    }>;
  }>;
}

interface TMDBTVAggregateCreditsResponse {
  cast?: Array<{ name: string }>;
  crew?: Array<{
    name: string;
    jobs?: Array<{ job: string }>;
  }>;
}

interface TMDBContentRatingsResponse {
  results?: Array<{
    iso_3166_1: string;
    rating: string;
  }>;
}

interface TMDBMovieDetailsExpanded extends TMDBMovieDetails {
  images?: {
    logos?: TMDBLogoImage[];
  };
  videos?: {
    results?: TMDBVideo[];
  };
  similar?: TMDBList;
  credits?: TMDBMovieCredits;
  release_dates?: TMDBReleaseDatesResponse;
}

interface TMDBTVDetailsExpanded extends TMDBShowDetails {
  images?: {
    logos?: TMDBLogoImage[];
  };
  videos?: {
    results?: TMDBVideo[];
  };
  similar?: TMDBList;
  aggregate_credits?: TMDBTVAggregateCreditsResponse;
  content_ratings?: TMDBContentRatingsResponse;
  created_by?: Array<{ name: string }>;
  episode_run_time?: number[];
  number_of_episodes?: number;
}

/**
 * Get the best English-language backdrop (has logo/title burned in)
 * for a movie or TV show. Returns null if none found.
 */
export async function getLogoBadrop(
  id: number,
  type: "movie" | "tv"
): Promise<string | null> {
  try {
    const data = await tmdbFetch<TMDBImagesResponse>(
      `/${type}/${id}/images`,
      { include_image_language: "en,null" }
    );

    const ranked = [...data.backdrops].sort((a, b) => {
      const languageScore = (image: TMDBImage) => {
        if (image.iso_639_1 === "en") return 2;
        if (image.iso_639_1 === null) return 1;
        return 0;
      };

      return (
        languageScore(b) - languageScore(a) ||
        b.vote_average - a.vote_average ||
        b.width - a.width
      );
    });

    return ranked[0]?.file_path ?? null;
  } catch {
    return null;
  }
}

/**
 * For a list of TMDBItems, fetch logo backdrops in parallel
 * and attach them as `logo_backdrop_path`.
 */
export async function attachLogoBackdrops(items: TMDBItem[]): Promise<TMDBItem[]> {
  const results = await Promise.all(
    items.map(async (item) => {
      const type = getMediaType(item);
      const logoPath = await getLogoBadrop(item.id, type);
      return { ...item, logo_backdrop_path: logoPath };
    })
  );
  return results;
}

export async function getContentRating(id: string | number, type: "movie" | "tv"): Promise<string | null> {
  if (type === "movie") {
    const data = await tmdbFetch<TMDBMovieHoverDetails>(`/movie/${id}`, {
      append_to_response: "release_dates",
    });
    return pickMovieCertification(data.release_dates);
  }
  const data = await tmdbFetch<TMDBTVHoverDetails>(`/tv/${id}`, {
    append_to_response: "content_ratings",
  });
  return pickTVRating(data.content_ratings);
}

async function getMediaHoverData(id: number, type: "movie" | "tv") {
  if (type === "movie") {
    const data = await tmdbFetch<TMDBMovieHoverDetails>(`/movie/${id}`, {
      append_to_response: "release_dates",
    });

    return {
      runtime: data.runtime ?? null,
      episodeCount: null,
      maturityRating: pickMovieCertification(data.release_dates),
      genres: data.genres?.map((genre) => genre.name) ?? [],
    };
  }

  const data = await tmdbFetch<TMDBTVHoverDetails>(`/tv/${id}`, {
    append_to_response: "content_ratings",
  });

  return {
    runtime: null,
    episodeCount: data.number_of_episodes ?? null,
    maturityRating: pickTVRating(data.content_ratings),
    genres: data.genres?.map((genre) => genre.name) ?? [],
  };
}

type Mood = "feel-good" | "intense-thrillers" | "action-packed" | "mind-bending" | "critically-acclaimed";

interface MoodConfig {
  label: string;
  movieParams: Record<string, string>;
  tvParams: Record<string, string>;
}

const MOOD_CONFIGS: Record<Mood, MoodConfig> = {
  "feel-good": {
    label: "Feel-Good Picks",
    movieParams: { with_genres: "35,10751", "vote_average.gte": "7", sort_by: "popularity.desc" },
    tvParams: { with_genres: "35,10751", "vote_average.gte": "7", sort_by: "popularity.desc" },
  },
  "intense-thrillers": {
    label: "Intense Thrillers",
    movieParams: { with_genres: "53,80", "vote_average.gte": "7", sort_by: "popularity.desc" },
    tvParams: { with_genres: "53,80", "vote_average.gte": "7", sort_by: "popularity.desc" },
  },
  "action-packed": {
    label: "Action-Packed",
    movieParams: { with_genres: "28,12", sort_by: "popularity.desc" },
    tvParams: { with_genres: "10759", sort_by: "popularity.desc" },
  },
  "mind-bending": {
    label: "Mind-Bending",
    movieParams: { with_genres: "878,9648", sort_by: "popularity.desc" },
    tvParams: { with_genres: "10765,9648", sort_by: "popularity.desc" },
  },
  "critically-acclaimed": {
    label: "Critically Acclaimed",
    movieParams: { sort_by: "vote_average.desc", "vote_count.gte": "1000" },
    tvParams: { sort_by: "vote_average.desc", "vote_count.gte": "1000" },
  },
};

export async function getMoodItems(mood: Mood): Promise<{ label: string; items: TMDBItem[] }> {
  const config = MOOD_CONFIGS[mood];

  const [movies, shows] = await Promise.all([
    tmdbFetchList("/discover/movie", config.movieParams, 1, "movie"),
    tmdbFetchList("/discover/tv", config.tvParams, 1, "tv"),
  ]);

  // Interleave movies and shows, deduplicate by id+type
  const seen = new Set<string>();
  const combined: TMDBItem[] = [];
  const maxLen = Math.max(movies.length, shows.length);
  for (let i = 0; i < maxLen && combined.length < 20; i++) {
    if (i < movies.length) {
      const key = `movie-${movies[i].id}`;
      if (!seen.has(key)) { seen.add(key); combined.push(movies[i]); }
    }
    if (i < shows.length && combined.length < 20) {
      const key = `tv-${shows[i].id}`;
      if (!seen.has(key)) { seen.add(key); combined.push(shows[i]); }
    }
  }

  return { label: config.label, items: combined };
}

export async function getTop10Trending(): Promise<TMDBItem[]> {
  const items = await getTrending(1);
  return items.slice(0, 10);
}

export async function getNewThisWeek(): Promise<TMDBItem[]> {
  const [movies, shows] = await Promise.all([
    tmdbFetchList("/movie/now_playing", {}, 1, "movie"),
    tmdbFetchList("/tv/on_the_air", {}, 1, "tv"),
  ]);

  const seen = new Set<string>();
  const combined: TMDBItem[] = [];
  const maxLen = Math.max(movies.length, shows.length);
  for (let i = 0; i < maxLen && combined.length < 20; i++) {
    if (i < movies.length) {
      const k = `movie-${movies[i].id}`;
      if (!seen.has(k)) { seen.add(k); combined.push(movies[i]); }
    }
    if (i < shows.length && combined.length < 20) {
      const k = `tv-${shows[i].id}`;
      if (!seen.has(k)) { seen.add(k); combined.push(shows[i]); }
    }
  }
  return combined;
}

export async function getFilteredContent(
  type: "movie" | "tv",
  genreId?: string,
  sortBy: string = "popularity.desc",
  minRating?: number,
  pages = 2
): Promise<TMDBItem[]> {
  const params: Record<string, string> = { sort_by: sortBy };
  if (genreId) params.with_genres = genreId;
  if (minRating) params["vote_average.gte"] = String(minRating);
  if (sortBy === "vote_average.desc") params["vote_count.gte"] = "200";
  return tmdbFetchList(`/discover/${type}`, params, pages, type);
}

export async function getTitleSimilar(id: number, type: "movie" | "tv"): Promise<TMDBItem[]> {
  return tmdbFetchList(`/${type}/${id}/similar`, {}, 1, type);
}

export async function attachCardContext(items: TMDBItem[]): Promise<TMDBItem[]> {
  const results = await Promise.all(
    items.map(async (item) => {
      const type = getMediaType(item);
      const [logoPath, hoverData] = await Promise.all([
        getLogoBadrop(item.id, type),
        getMediaHoverData(item.id, type),
      ]);

      return {
        ...item,
        logo_backdrop_path: logoPath,
        runtime: hoverData.runtime,
        episodeCount: hoverData.episodeCount,
        maturityRating: hoverData.maturityRating,
        genres: hoverData.genres,
      };
    })
  );

  return results;
}
