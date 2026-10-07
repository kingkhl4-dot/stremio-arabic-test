const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.sa.test",
  version: "1.0.3",
  name: "🧪 Netflix السعودية - تجريبي",
  description: "اختبار بيانات Netflix السعودية مباشرة",
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

const headers = {
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
};

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\u002F/g, "/")
    .replace(/\\u002f/g, "/")
    .replace(/\\u003A/g, ":")
    .replace(/\\u003a/g, ":")
    .replace(/\\\//g, "/")
    .trim();
}

function cleanName(text) {
  return decodeHtml(text)
    .replace(/^Go to\s*/i, "")
    .replace(/^اذهب إلى\s*/i, "")
    .trim();
}

function findImage(text) {
  const decoded = decodeHtml(text);

  const patterns = [
    /https?:\/\/[^"'\\\s]+nflximg\.net[^"'\\\s<]*/i,
    /https?:\/\/[^"'\\\s]+nflxso\.net[^"'\\\s<]*/i,
    /<img[^>]+src="([^"]+)"/i,
    /<img[^>]+srcset="([^"]+)"/i
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);

    if (match) {
      let url = match[1] || match[0];

      if (url.includes(",")) {
        url = url.split(",")[0].trim().split(" ")[0];
      }

      return decodeHtml(url);
    }
  }

  return "";
}

async function fetchPage(url) {
  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Netflix HTTP ${response.status}`);
  }

  return response.text();
}

function extractCatalog(html) {
  const metas = [];
  const seen = new Set();

  const regex =
    /<a[^>]+href="([^"]*\/title\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const netflixId = match[2];

    if (seen.has(netflixId)) continue;

    const around = html.slice(
      Math.max(0, match.index - 1200),
      Math.min(html.length, regex.lastIndex + 1200)
    );

    const alt =
      match[3].match(/alt="([^"]+)"/i)?.[1] ||
      around.match(/alt="([^"]+)"/i)?.[1] ||
      "";

    const aria =
      match[3].match(/aria-label="([^"]+)"/i)?.[1] ||
      around.match(/aria-label="([^"]+)"/i)?.[1] ||
      "";

    const name = cleanName(alt || aria);

    if (!name) continue;

    const poster = findImage(match[3]) || findImage(around);

    seen.add(netflixId);

    metas.push({
      id: `netflix:${netflixId}`,
      type: "movie",
      name,
      poster:
        poster ||
        "https://dummyimage.com/300x450/111/ffffff.png&text=Netflix"
    });
  }

  return metas;
}

builder.defineCatalogHandler(async (args) => {
  if (
    args.type !== "movie" ||
    args.id !== "netflix_sa_movies"
  ) {
    return { metas: [] };
  }

  try {
    const html = await fetchPage(NETFLIX_URL);
    const metas = extractCatalog(html);

    console.log("Netflix catalog:", metas.length);
    console.log(
      "Real posters:",
      metas.filter(x => !x.poster.includes("dummyimage")).length
    );

    return { metas: metas.slice(0, 100) };
  } catch (error) {
    console.error("Catalog error:", error);
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

    const url =
      `https://www.netflix.com/sa/title/${netflixId}`;

    const html = await fetchPage(url);
    const decoded = decodeHtml(html);

    const title =
      decoded.match(
        /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i
      )?.[1] ||
      decoded.match(/<title>([^<]+)<\/title>/i)?.[1] ||
      `Netflix ${netflixId}`;

    const description =
      decoded.match(
        /<meta[^>]+(?:name|property)="(?:description|og:description)"[^>]+content="([^"]+)"/i
      )?.[1] ||
      "";

    const poster =
      decoded.match(
        /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i
      )?.[1] ||
      findImage(decoded);

    const meta = {
      id: `netflix:${netflixId}`,
      type: "movie",
      name: cleanName(title)
        .replace(/\s*-\s*Netflix.*$/i, "")
        .trim(),
      description: decodeHtml(description)
    };

    if (poster) {
      meta.poster = decodeHtml(poster);
      meta.background = decodeHtml(poster);
    }

    console.log(
      "META",
      netflixId,
      "poster:",
      poster ? "YES" : "NO"
    );

    return { meta };
  } catch (error) {
    console.error("Meta error:", error);
    return { meta: null };
  }
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
