const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.arabic.test",
  version: "1.0.0",
  name: "🧪 المكتبة العربية - تجريبي",
  description: "إضافة تجريبية لاختبار المكتبة العربية",
  resources: ["catalog", "meta"],
  types: ["movie", "series"],
  catalogs: [
    {
      type: "movie",
      id: "arabic_test_movies",
      name: "🧪 أفلام عربية - تجريبي"
    },
    {
      type: "series",
      id: "arabic_test_series",
      name: "🧪 مسلسلات عربية - تجريبي"
    }
  ]
};

const builder = new addonBuilder(manifest);

async function tmdb(path, params = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);

  url.searchParams.set("api_key", process.env.TMDB_API_KEY);
  url.searchParams.set("language", "ar-SA");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`TMDB error: ${response.status}`);
  }

  return response.json();
}

function poster(path) {
  return path
    ? `https://image.tmdb.org/t/p/w500${path}`
    : undefined;
}

function background(path) {
  return path
    ? `https://image.tmdb.org/t/p/original${path}`
    : undefined;
}

builder.defineCatalogHandler(async (args) => {
  try {
    const isMovie = args.type === "movie";
    const page = Math.floor(Number(args.extra?.skip || 0) / 20) + 1;

    const data = await tmdb(
      isMovie ? "/discover/movie" : "/discover/tv",
      {
        with_original_language: "ar",
        sort_by: "popularity.desc",
        include_adult: "false",
        page: String(page)
      }
    );

    const metas = (data.results || []).map((item) => ({
      id: `tmdb:${item.id}`,
      type: args.type,
      name: item.title || item.name || item.original_title || item.original_name,
      poster: poster(item.poster_path),
      background: background(item.backdrop_path),
      description: item.overview || "",
      releaseInfo:
        (item.release_date || item.first_air_date || "").slice(0, 4)
    }));

    return { metas };
  } catch (error) {
    console.error("Catalog error:", error);
    return { metas: [] };
  }
});

builder.defineMetaHandler(async (args) => {
  try {
    const tmdbId = String(args.id).replace("tmdb:", "");
    const isMovie = args.type === "movie";

    const data = await tmdb(
      isMovie ? `/movie/${tmdbId}` : `/tv/${tmdbId}`,
      {
        append_to_response: "credits"
      }
    );

    const cast = (data.credits?.cast || [])
      .slice(0, 8)
      .map((person) => person.name);

    const directors = isMovie
      ? (data.credits?.crew || [])
          .filter((person) => person.job === "Director")
          .map((person) => person.name)
      : (data.created_by || []).map((person) => person.name);

    const meta = {
      id: args.id,
      type: args.type,
      name:
        data.title ||
        data.name ||
        data.original_title ||
        data.original_name,
      poster: poster(data.poster_path),
      background: background(data.backdrop_path),
      description: data.overview || "",
      releaseInfo:
        (data.release_date || data.first_air_date || "").slice(0, 4),
      genres: (data.genres || []).map((genre) => genre.name),
      cast,
      director: directors,
      imdbRating:
        data.vote_average
          ? Number(data.vote_average).toFixed(1)
          : undefined,
      runtime: isMovie
        ? data.runtime
          ? `${data.runtime} دقيقة`
          : undefined
        : data.episode_run_time?.[0]
          ? `${data.episode_run_time[0]} دقيقة`
          : undefined
    };

    return { meta };
  } catch (error) {
    console.error("Meta error:", error);
    return { meta: null };
  }
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
