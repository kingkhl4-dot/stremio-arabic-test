const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.series.test",
  version: "1.0.0",
  name: "🧪 Netflix - مسلسلات تجريبي",
  description: "اختبار سحب مسلسلات Netflix",
  resources: ["catalog", "meta"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "netflix_series",
      name: "Netflix - مسلسلات"
    }
  ]
};

const builder = new addonBuilder(manifest);

// نجرب صفحة المسلسلات الدرامية
const SERIES_URL =
  "https://www.netflix.com/sa-ar/browse/genre/11714";

const HEADERS = {
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8"
};

// كاش 6 ساعات
const CACHE_TIME = 6 * 60 * 60 * 1000;

let catalogCache = null;
let catalogCacheTime = 0;

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

function extractSeries(html) {
  const items = [];
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

    items.push({
      id: `netflix:${netflixId}`,
      netflixId,
      type: "series",
      name
    });
  }

  return items;
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

async function enrichSeries(item) {
  try {
    const html = await getPage(
      `https://www.netflix.com/sa-ar/title/${item.netflixId}`
    );

    const poster = extractPoster(html);

    return {
      id: item.id,
      type: "series",
      name: item.name,
      poster:
        poster ||
        "https://dummyimage.com/300x450/111/ffffff.png&text=Netflix"
    };

  } catch (error) {
    return {
      id: item.id,
      type: "series",
      name: item.name,
      poster:
        "https://dummyimage.com/300x450/111/ffffff.png&text=Netflix"
    };
  }
}

async function buildCatalog() {
  const now = Date.now();

  if (
    catalogCache &&
    now - catalogCacheTime < CACHE_TIME
  ) {
    console.log("SERIES CACHE HIT");
    return catalogCache;
  }

  console.log("SERIES CACHE MISS");

  const html = await getPage(SERIES_URL);

  const items =
    extractSeries(html).slice(0, 100);

  console.log(
    `Netflix series found: ${items.length}`
  );

  const metas = [];

  // خمس مسلسلات في كل دفعة
  for (let i = 0; i < items.length; i += 5) {
    const batch = items.slice(i, i + 5);

    const results = await Promise.all(
      batch.map(enrichSeries)
    );

    metas.push(...results);
  }

  catalogCache = metas;
  catalogCacheTime = Date.now();

  const realPosters = metas.filter(
    item => !item.poster.includes("dummyimage")
  ).length;

  console.log(
    `Netflix series posters: ${realPosters}/${metas.length}`
  );

  return metas;
}

builder.defineCatalogHandler(async (args) => {
  if (
    args.type !== "series" ||
    args.id !== "netflix_series"
  ) {
    return { metas: [] };
  }

  try {
    return {
      metas: await buildCatalog()
    };

  } catch (error) {
    console.error(
      "Netflix series catalog error:",
      error
    );

    if (catalogCache) {
      return { metas: catalogCache };
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

    const cached = metaCache.get(netflixId);

    if (
      cached &&
      Date.now() - cached.time < CACHE_TIME
    ) {
      return { meta: cached.meta };
    }

    const html = await getPage(
      `https://www.netflix.com/sa-ar/title/${netflixId}`
    );

    const decoded = decodeHtml(html);

    const title =
      decoded.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
      )?.[1] ||
      decoded.match(
        /<title>([^<]+)<\/title>/i
      )?.[1] ||
      `Netflix ${netflixId}`;

    const poster = extractPoster(html);
    const description = extractDescription(html);

    const meta = {
      id: `netflix:${netflixId}`,
      type: "series",
      name: cleanName(title)
        .replace(/\s*[-|]\s*Netflix.*$/i, "")
        .trim(),
      description: decodeHtml(description)
    };

    if (poster) {
      meta.poster = poster;
      meta.background = poster;
    }

    metaCache.set(netflixId, {
      meta,
      time: Date.now()
    });

    return { meta };

  } catch (error) {
    console.error(
      "Netflix series meta error:",
      error
    );

    return { meta: null };
  }
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
