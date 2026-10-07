const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.sa.test",
  version: "1.0.6",
  name: "🧪 Netflix السعودية - تجريبي",
  description: "اختبار كتالوج Netflix السعودية مباشرة",
  resources: ["catalog", "meta"],
  types: ["movie"],
  catalogs: [
    {
      type: "movie",
      id: "netflix_sa_movies",
      name: "🇸🇦 Netflix السعودية"
    }
  ]
};

const builder = new addonBuilder(manifest);

const NETFLIX_URL =
  "https://www.netflix.com/sa/browse/genre/34399";

const HEADERS = {
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8"
};

// ===== Cache =====
const CACHE_TIME = 6 * 60 * 60 * 1000; // 6 ساعات

let catalogCache = {
  metas: null,
  time: 0
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

function extractNetflix(html) {
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
      type: "movie",
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

  if (ogImage) return decodeHtml(ogImage);

  const netflixImage =
    decoded.match(
      /https?:\/\/[^"' <]+(?:nflximg\.net|nflxso\.net)[^"' <]*/i
    )?.[0];

  return netflixImage ? decodeHtml(netflixImage) : "";
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

builder.defineCatalogHandler(async (args) => {
  if (
    args.type !== "movie" ||
    args.id !== "netflix_sa_movies"
  ) {
    return { metas: [] };
  }

  try {
    const now = Date.now();

    // إذا الكتالوج محفوظ وأقل من 6 ساعات نرجعه فوراً
    if (
      catalogCache.metas &&
      now - catalogCache.time < CACHE_TIME
    ) {
      console.log("Netflix catalog: CACHE HIT ⚡");

      return {
        metas: catalogCache.metas
      };
    }

    console.log("Netflix catalog: CACHE MISS - fetching...");

    const html = await getPage(NETFLIX_URL);
    const items = extractNetflix(html).slice(0, 30);

    console.log("Netflix titles:", items.length);

    const metas = [];

    for (let i = 0; i < items.length; i += 5) {
      const batch = items.slice(i, i + 5);

      const results = await Promise.all(
        batch.map(enrichItem)
      );

      metas.push(...results);
    }

    catalogCache = {
      metas,
      time: Date.now()
    };

    const realPosters = metas.filter(
      item => !item.poster.includes("dummyimage")
    ).length;

    console.log(
      `Netflix real posters: ${realPosters}/${metas.length}`
    );

    console.log("Netflix catalog saved to cache ✅");

    return { metas };
  } catch (error) {
    console.error("Netflix catalog error:", error);

    // لو Netflix تعطل مؤقتاً وعندنا نسخة قديمة نستخدمها
    if (catalogCache.metas) {
      console.log("Using old Netflix cache");

      return {
        metas: catalogCache.metas
      };
    }

    return { metas: [] };
  }
});

builder.defineMetaHandler(async (args) => {
  try {
    const netflixId = String(args.id || "")
      .replace("netflix:", "");

    if (!/^\d+$/.test(netflixId)) {
      return { meta: null };
    }

    const cached = metaCache.get(netflixId);

    if (
      cached &&
      Date.now() - cached.time < CACHE_TIME
    ) {
      console.log(`Netflix meta ${netflixId}: CACHE HIT ⚡`);

      return {
        meta: cached.meta
      };
    }

    const html = await getPage(
      `https://www.netflix.com/sa/title/${netflixId}`
    );

    const decoded = decodeHtml(html);

    const title =
      decoded.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
      )?.[1] ||
      decoded.match(/<title>([^<]+)<\/title>/i)?.[1] ||
      `Netflix ${netflixId}`;

    const poster = extractPoster(html);
    const description = extractDescription(html);

    const meta = {
      id: `netflix:${netflixId}`,
      type: "movie",
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
    console.error("Netflix meta error:", error);
    return { meta: null };
  }
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
