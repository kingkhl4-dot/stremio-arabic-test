const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.sa.finaltest",
  version: "3.0.0",
  name: "🧪 Netflix السعودية",
  description: "Netflix Saudi catalog via JustWatch + TMDB",
  resources: ["catalog", "meta"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "netflix_sa",
      name: "Netflix السعودية"
    }
  ]
};

const builder = new addonBuilder(manifest);

const JUSTWATCH_URL = "https://apis.justwatch.com/graphql";
const TMDB_KEY = process.env.TMDB_API_KEY;

const CACHE_TIME = 6 * 60 * 60 * 1000;

let cache = {
  time: 0,
  metas: []
};


// ===========================
// JUSTWATCH
// ===========================

const JW_QUERY = `
query GetPopularTitles(
  $country: Country!
  $language: Language!
  $first: Int!
  $filter: TitleFilter
) {
  popularTitles(
    country: $country
    first: $first
    filter: $filter
  ) {
    edges {
      node {
        id
        objectId
        objectType

        content(
          country: $country
          language: $language
        ) {
          title
          originalReleaseYear
          fullPath
        }
      }
    }
  }
}
`;

async function getNetflixSaudi() {

  const response = await fetch(JUSTWATCH_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
    },

    body: JSON.stringify({
      operationName: "GetPopularTitles",

      variables: {
        country: "SA",
        language: "ar",
        first: 10,

        filter: {
          objectTypes: ["SHOW"],
          packages: ["nfx"]
        }
      },

      query: JW_QUERY
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`JustWatch HTTP ${response.status}`);
  }

  if (data.errors?.length) {
    throw new Error(
      data.errors.map(e => e.message).join(" | ")
    );
  }

  return data?.data?.popularTitles?.edges || [];
}


// ===========================
// TMDB
// ===========================

async function tmdbSearch(title, year) {

  if (!TMDB_KEY) {
    throw new Error("TMDB_API_KEY غير موجود");
  }

  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    query: title,
    language: "ar-SA",
    include_adult: "false"
  });

  if (year) {
    params.set("first_air_date_year", String(year));
  }

  let response = await fetch(
    `https://api.themoviedb.org/3/search/tv?${params}`
  );

  let data = await response.json();

  // إذا السنة منعت التطابق نجرب مرة ثانية بدونها
  if (!data.results?.length && year) {

    params.delete("first_air_date_year");

    response = await fetch(
      `https://api.themoviedb.org/3/search/tv?${params}`
    );

    data = await response.json();
  }

  return data.results?.[0] || null;
}


async function tmdbDetails(id) {

  const params = new URLSearchParams({
    api_key: TMDB_KEY,
    language: "ar-SA"
  });

  const response = await fetch(
    `https://api.themoviedb.org/3/tv/${id}?${params}`
  );

  if (!response.ok) {
    return null;
  }

  return await response.json();
}


// ===========================
// BUILD CATALOG
// ===========================

async function buildCatalog() {

  if (
    cache.metas.length &&
    Date.now() - cache.time < CACHE_TIME
  ) {
    return cache.metas;
  }

  const edges = await getNetflixSaudi();

  const metas = [];

  for (const edge of edges.slice(0, 10)) {

    const jw = edge.node;
    const content = jw.content || {};

    const title = content.title;
    const year = content.originalReleaseYear;

    if (!title) continue;

    try {

      const match = await tmdbSearch(title, year);

      if (!match) {
        console.log("TMDB NOT FOUND:", title);
        continue;
      }

      const details =
        await tmdbDetails(match.id);

      const info = details || match;

      const poster = info.poster_path
        ? `https://image.tmdb.org/t/p/w500${info.poster_path}`
        : undefined;

      const background = info.backdrop_path
        ? `https://image.tmdb.org/t/p/original${info.backdrop_path}`
        : poster;

      metas.push({
        id: `tmdb:${match.id}`,
        type: "series",

        name:
          info.name ||
          match.name ||
          title,

        description:
          info.overview ||
          match.overview ||
          "",

        poster,
        background,

        posterShape: "poster",

        releaseInfo:
          String(
            info.first_air_date ||
            match.first_air_date ||
            year ||
            ""
          ).slice(0, 4)
      });

    } catch (error) {

      console.error(
        "ITEM ERROR:",
        title,
        error.message
      );
    }
  }

  cache = {
    time: Date.now(),
    metas
  };

  return metas;
}


// ===========================
// CATALOG
// ===========================

builder.defineCatalogHandler(async args => {

  if (
    args.type !== "series" ||
    args.id !== "netflix_sa"
  ) {
    return { metas: [] };
  }

  try {

    const metas = await buildCatalog();

    return { metas };

  } catch (error) {

    console.error("CATALOG ERROR:", error);

    return {
      metas: [
        {
          id: "netflix:error",
          type: "series",
          name: `ERROR: ${error.message}`
        }
      ]
    };
  }
});


// ===========================
// META
// ===========================

builder.defineMetaHandler(async args => {

  if (
    args.type !== "series" ||
    !args.id.startsWith("tmdb:")
  ) {
    return { meta: null };
  }

  try {

    const tmdbId =
      args.id.replace("tmdb:", "");

    const details =
      await tmdbDetails(tmdbId);

    if (!details) {
      return { meta: null };
    }

    const poster = details.poster_path
      ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
      : undefined;

    const background = details.backdrop_path
      ? `https://image.tmdb.org/t/p/original${details.backdrop_path}`
      : poster;

    return {
      meta: {
        id: args.id,
        type: "series",

        name: details.name,

        description:
          details.overview || "",

        poster,
        background,

        posterShape: "poster",

        releaseInfo:
          String(
            details.first_air_date || ""
          ).slice(0, 4)
      }
    };

  } catch (error) {

    console.error("META ERROR:", error);

    return { meta: null };
  }
});


serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
