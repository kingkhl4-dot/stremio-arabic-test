const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.sa.test",
  version: "1.0.8",
  name: "🧪 Netflix - تجريبي",
  description: "اختبار كتالوج Netflix",
  resources: ["catalog", "meta"],
  types: ["movie", "series"],
  catalogs: [
    {
      type: "movie",
      id: "netflix_movies",
      name: "Netflix - أفلام"
    },
    {
      type: "series",
      id: "netflix_series",
      name: "Netflix - مسلسلات"
    }
  ]
};

const builder = new addonBuilder(manifest);

// صفحات Netflix السعودية العامة
const MOVIES_URL =
  "https://www.netflix.com/sa/browse/genre/34399";

const SERIES_URL =
  "https://www.netflix.com/sa-ar/browse/genre/83";

const HEADERS = {
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8"
};

// ===== Cache لمدة 6 ساعات =====
const CACHE_TIME = 6 * 60 * 60 * 1000;

const catalogCache = {
  movie: {
    metas: null,
    time: 0
  },
  series: {
    metas: null,
    time: 0
  }
};

const metaCache = new Map();

async function getPage(url) {
  const response = await fetch(url, {
    headers: HEADERS
  });

  if (!response.ok) {
    throw new Error(`Netflix HTTP ${response.status}`);
  }

  return response.text();
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .trim();
}

function cleanName(text) {
  return decodeHtml(text)
    .replace(/^Go to\s*/i, "")
    .replace(/^اذهب إلى\s*/i, "")
    .trim();
}

function extractNetflix(html, type) {
  const metas = [];
  const seen = new Set();

  const linkRegex =
    /<a[^>]+href="([^"]*\/title\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const netflixId = match[2];

    if (seen.has(netflixId)) continue;

    const block = match[3];

    const alt =
      block.match(/alt="([^"]+)"/i)?.[1] || "";

    const aria =
      block.match(/aria-label="([^"]+)"/i)?.[1] || "";

    let name = cleanName(alt || aria);

    if (!name) {
      const start = Math.max(0, match.index - 500);

      const end = Math.min(
        html.length,
        linkRegex.lastIndex + 500
      );

      const around = html.slice(start, end);

      const nearby =
        around.match(/aria-label="([^"]+)"/i)?.[1] ||
        around.match(/alt="([^"]+)"/i)?.[1] ||
        "";

      name = cleanName(nearby);
    }

    if (!name) continue;

    seen.add(netflixId);

    metas.push({
      id: `netflix:${netflixId}`,
      netflixId,
      type,
      name
    });
  }

  return metas;
}

function extractPoster(html) {
  const decoded = decodeHtml(html);

  const ogImage =
    decoded.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    decoded.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    )?.[1];

  if (ogImage) {
    return decodeHtml(ogImage);
  }

  const netflixImage =
    decoded.match(
      /https?:\/\/[^"' <]+(?:nflximg\.net|nflxso\.net)[^"' <]*/i
    )?.[0];

  return netflixImage
    ? decodeHtml(netflixImage)
    : "";
}

function extractDescription(html) {
  const decoded = decodeHtml(html);

  return (
    decoded.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    decoded.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    ""
  );
}

async function enrichItem(item) {
  try {
    const html = await getPage(
      `https://www.netflix.com/sa/title/${item.netflixId}`
    );

    const poster = extractPoster(html);

    return {
      id: item.id,
      type: item.type,
      name: item.name,
      poster:
        poster ||
        "https://dummyimage.com/300x450/111/ffffff.png&text=Netflix"
    };
  } catch (error) {
    return {
      id: item.id,
      type: item.type,
      name: item.name,
      poster:
        "https://dummyimage.com/300x450/111/ffffff.png&text=Netflix"
    };
  }
}

async function buildCatalog(type) {
  const cache = catalogCache[type];
  const now = Date.now();

  if (
    cache.metas &&
    now - cache.time < CACHE_TIME
  ) {
    console.log(`${type}: CACHE HIT`);

    return cache.metas;
  }

  console.log(`${type}: CACHE MISS`);

  const url =
    type === "movie"
      ? MOVIES_URL
      : SERIES_URL;

  const html = await getPage(url);

  // حتى 100 عنوان لكل قسم
  const items =
    extractNetflix(html, type).slice(0, 100);

  console.log(
    `Netflix ${type} titles: ${items.length}`
  );

  const metas = [];

  // خمس صفحات في نفس الوقت
  for (let i = 0; i < items.length; i += 5) {
    const batch = items.slice(i, i + 5);

    const results = await Promise.all(
      batch.map(enrichItem)
    );

    metas.push(...results);
  }

  cache.metas = metas;
  cache.time = Date.now();

  const realPosters = metas.filter(
    item => !item.poster.includes("dummyimage")
  ).length;

  console.log(
    `Netflix ${type} posters: ${realPosters}/${metas.length}`
  );

  return metas;
}

builder.defineCatalogHandler(async (args) => {
  try {
    if (
      args.type === "movie" &&
      args.id === "netflix_movies"
    ) {
      return {
        metas: await buildCatalog("movie")
      };
    }

    if (
      args.type === "series" &&
      args.id === "netflix_series"
    ) {
      return {
        metas: await buildCatalog("series")
      };
    }

    return { metas: [] };

  } catch (error) {
    console.error(
      "Netflix catalog error:",
      error
    );

    const oldCache =
      catalogCache[args.type]?.metas;

    if (oldCache) {
      return {
        metas: oldCache
      };
    }

    return { metas: [] };
  }
});

builder.defineMetaHandler(async (args) => {
  try {
    const netflixId =
      String(args.id || "")
        .replace("netflix:", "");

    if (!/^\d+$/.test(netflixId)) {
      return { meta: null };
    }

    const cacheKey =
      `${args.type}:${netflixId}`;

    const cached =
      metaCache.get(cacheKey);

    if (
      cached &&
      Date.now() - cached.time < CACHE_TIME
    ) {
      return {
        meta: cached.meta
      };
    }

    const html = await getPage(
      `https://www.netflix.com/sa/title/${netflixId}`
    );

    const decoded =
      decodeHtml(html);

    const title =
      decoded.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
      )?.[1] ||
      decoded.match(
        /<title>([^<]+)<\/title>/i
      )?.[1] ||
      `Netflix ${netflixId}`;

    const poster =
      extractPoster(html);

    const description =
      extractDescription(html);

    const meta = {
      id: `netflix:${netflixId}`,
      type: args.type,
      name: cleanName(title)
        .replace(
          /\s*[-|]\s*Netflix.*$/i,
          ""
        )
        .trim(),
      description:
        decodeHtml(description)
    };

    if (poster) {
      meta.poster = poster;
      meta.background = poster;
    }

    metaCache.set(cacheKey, {
      meta,
      time: Date.now()
    });

    return { meta };

  } catch (error) {
    console.error(
      "Netflix meta error:",
      error
    );

    return { meta: null };
  }
});

serveHTTP(
  builder.getInterface(),
  {
    port: process.env.PORT || 7000
  }
);
