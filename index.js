const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.crunchyroll.anime.test",
  version: "1.0.0",
  name: "🧪 Crunchyroll Anime",
  description: "اختبار مكتبة Crunchyroll العامة",
  resources: ["catalog", "meta"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "crunchyroll_anime",
      name: "Crunchyroll"
    }
  ]
};

const builder = new addonBuilder(manifest);

const BASE = "https://www.crunchyroll.com";
const CATALOG_URL = `${BASE}/ar/videos/new`;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

const CACHE_TIME = 6 * 60 * 60 * 1000;

let cache = {
  time: 0,
  metas: []
};

function clean(value) {
  return String(value || "")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteUrl(url) {
  url = clean(url);

  if (!url) return null;

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  if (url.startsWith("/")) {
    return `${BASE}${url}`;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return null;
}

function extractSeries(html) {

  html = clean(html);

  const results = [];
  const seen = new Set();

  /*
    Crunchyroll:
    /ar/series/GDKHZEJ0K/solo-leveling
  */

  const regex =
    /\/(?:[a-z]{2}\/)?series\/([A-Z0-9]+)\/([^"'<>?#\s]+)/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {

    const id = match[1];
    const slug = match[2];

    if (!id || seen.has(id)) continue;

    seen.add(id);

    let name;

    try {
      name = decodeURIComponent(slug)
        .replace(/-/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      name = slug.replace(/-/g, " ");
    }

    results.push({
      id,
      name,
      url: `${BASE}/ar/series/${id}/${slug}`
    });

    if (results.length >= 10) break;
  }

  return results;
}

function extractMeta(html, fallbackName, id) {

  const title =
    html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i
    )?.[1] ||
    fallbackName;

  const description =
    html.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
    )?.[1] ||
    "";

  let image =
    html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    )?.[1] ||
    "";

  image = absoluteUrl(image);

  return {
    id: `crunchyroll:${id}`,
    type: "series",
    name: clean(title)
      .replace(/\s*-\s*Crunchyroll.*$/i, "")
      .trim(),
    description: clean(description),
    poster: image || undefined,
    background: image || undefined,
    posterShape: "poster"
  };
}

async function fetchPage(url) {

  const response = await fetch(url, {
    headers: HEADERS,
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.text();
}

async function getCatalog() {

  if (
    cache.metas.length &&
    Date.now() - cache.time < CACHE_TIME
  ) {
    return cache.metas;
  }

  const html = await fetchPage(CATALOG_URL);

  const items = extractSeries(html);

  console.log(
    "Crunchyroll series found:",
    items.length
  );

  const metas = [];

  /*
    دفعات صغيرة حتى ما نضغط الموقع
  */

  for (let i = 0; i < items.length; i += 5) {

    const batch = items.slice(i, i + 5);

    const data = await Promise.all(
      batch.map(async item => {

        try {

          const page = await fetchPage(item.url);

          return extractMeta(
            page,
            item.name,
            item.id
          );

        } catch (error) {

          console.error(
            "META ERROR:",
            item.id,
            error.message
          );

          return {
            id: `crunchyroll:${item.id}`,
            type: "series",
            name: item.name
          };
        }
      })
    );

    metas.push(...data);
  }

  cache = {
    time: Date.now(),
    metas
  };

  return metas;
}


// ======================
// CATALOG
// ======================

builder.defineCatalogHandler(async args => {

  if (
    args.type !== "series" ||
    args.id !== "crunchyroll_anime"
  ) {
    return { metas: [] };
  }

  try {

    const metas = await getCatalog();

    return { metas };

  } catch (error) {

    console.error(
      "CRUNCHYROLL CATALOG ERROR:",
      error
    );

    return {
      metas: [
        {
          id: "crunchyroll:error",
          type: "series",
          name: `Crunchyroll ERROR: ${error.message}`
        }
      ]
    };
  }
});


// ======================
// META
// ======================

builder.defineMetaHandler(async args => {

  if (
    args.type !== "series" ||
    !args.id.startsWith("crunchyroll:")
  ) {
    return { meta: null };
  }

  try {

    const crunchyId =
      args.id.replace("crunchyroll:", "");

    /*
      أولاً نحاول نجيبه من الكاش
    */

    const catalog = await getCatalog();

    const cached = catalog.find(
      item => item.id === args.id
    );

    if (cached) {
      return { meta: cached };
    }

    /*
      إذا العمل مو موجود ضمن أول 10،
      نرجع بيانات أساسية.
    */

    return {
      meta: {
        id: args.id,
        type: "series",
        name: `Crunchyroll ${crunchyId}`
      }
    };

  } catch (error) {

    console.error(
      "CRUNCHYROLL META ERROR:",
      error
    );

    return { meta: null };
  }
});


serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
