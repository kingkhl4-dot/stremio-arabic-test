const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.akwam.test",
  version: "1.0.0",
  name: "🧪 أكوام - تجريبي",
  description: "تجربة كتالوج أكوام",
  resources: ["catalog", "meta"],
  types: ["movie", "series"],
  catalogs: [
    {
      type: "movie",
      id: "akwam_movies",
      name: "🧪 أفلام أكوام",
      extra: [{ name: "skip", isRequired: false }]
    },
    {
      type: "series",
      id: "akwam_series",
      name: "🧪 مسلسلات أكوام",
      extra: [{ name: "skip", isRequired: false }]
    }
  ]
};

const builder = new addonBuilder(manifest);

const ARABCITY = "https://arabcity.fly.dev/YWxs";

async function getJSON(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Source error: ${response.status}`);
  }

  return response.json();
}

builder.defineCatalogHandler(async (args) => {
  try {
    const skip = Number(args.extra?.skip || 0);

    const catalogId =
      args.type === "movie"
        ? "akoam-movies-all"
        : "akoam-series-all";

    let url =
      `${ARABCITY}/catalog/ArabCity-Akwam/${catalogId}.json`;

    if (skip > 0) {
      url =
        `${ARABCITY}/catalog/ArabCity-Akwam/${catalogId}/skip=${skip}.json`;
    }

    const data = await getJSON(url);

    const metas = (data.metas || []).map((item) => ({
      id: item.id,
      type: args.type,
      name: item.name,
      poster: item.poster,
      background: item.background,
      description: item.description,
      releaseInfo: item.releaseInfo,
      genres: item.genres
    }));

    return { metas };
  } catch (error) {
    console.error("Catalog error:", error);
    return { metas: [] };
  }
});

builder.defineMetaHandler(async (args) => {
  try {
    const sourceType = "ArabCity-Akwam";

    const url =
      `${ARABCITY}/meta/${sourceType}/${encodeURIComponent(args.id)}.json`;

    const data = await getJSON(url);

    if (!data.meta) {
      return { meta: null };
    }

    const item = data.meta;

    return {
      meta: {
        id: args.id,
        type: args.type,
        name: item.name,
        poster: item.poster,
        background: item.background,
        description: item.description,
        releaseInfo: item.releaseInfo,
        genres: item.genres,
        runtime: item.runtime,
        imdbRating: item.imdbRating
      }
    };
  } catch (error) {
    console.error("Meta error:", error);
    return { meta: null };
  }
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
