const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.disney.series.posters",
  version: "3.0.0",
  name: "🧪 Disney+ Series Posters",
  description: "اختبار مسلسلات Disney+ مع الصور",
  resources: ["catalog", "meta"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "disney_series_posters",
      name: "Disney+ - مسلسلات"
    }
  ]
};

const builder = new addonBuilder(manifest);

const DISNEY_URL = "https://www.disneyplus.com/";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\u0026/g, "&")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .trim();
}

async function getPage(url) {
  const response = await fetch(url, {
    headers: HEADERS,
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`Disney HTTP ${response.status}`);
  }

  return await response.text();
}

function extractPoster(html) {

  const decoded = decodeHtml(html);

  // نحاول أولاً og:image
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

  // وإذا ما وجدناه نجرب روابط صور Disney
  const image =
    decoded.match(
      /https?:\/\/[^"' <]+\.(?:jpg|jpeg|png|webp)(?:\?[^"' <]*)?/i
    )?.[0];

  return image ? decodeHtml(image) : "";
}

function extractDescription(html) {

  const decoded = decodeHtml(html);

  return decodeHtml(
    decoded.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    decoded.match(
      /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    ""
  );
}

function extractItems(html) {

  const items = [];
  const seen = new Set();

  const regex =
    /<a[^>]+href=["']([^"']*\/browse\/entity-([a-zA-Z0-9-]+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {

    const href = decodeHtml(match[1]);
    const entityId = match[2];
    const block = match[3];

    if (seen.has(entityId)) continue;

    let name =
      block.match(/alt=["']([^"']+)["']/i)?.[1] ||
      block.match(/aria-label=["']([^"']+)["']/i)?.[1] ||
      "";

    name = decodeHtml(name);

    if (!name) continue;

    if (
      /disney\+?|logo|hbo max|bundle|espn|hulu/i.test(name)
    ) {
      continue;
    }

    seen.add(entityId);

    let url;

    if (href.startsWith("http")) {
      url = href;
    } else {
      url = `https://www.disneyplus.com${href}`;
    }

    items.push({
      entityId,
      name,
      url
    });

    if (items.length >= 10) break;
  }

  return items;
}

async function enrichItem(item) {

  try {

    const html = await getPage(item.url);

    const poster = extractPoster(html);

    console.log(
      "POSTER:",
      item.name,
      poster ? "YES" : "NO"
    );

    const meta = {
      id: `disney:${item.entityId}`,
      type: "series",
      name: item.name
    };

    if (poster) {
      meta.poster = poster;
      meta.background = poster;
    }

    return meta;

  } catch (error) {

    console.error(
      "ITEM ERROR:",
      item.name,
      error.message
    );

    return {
      id: `disney:${item.entityId}`,
      type: "series",
      name: item.name
    };
  }
}

builder.defineCatalogHandler(async (args) => {

  if (
    args.type !== "series" ||
    args.id !== "disney_series_posters"
  ) {
    return { metas: [] };
  }

  try {

    const html = await getPage(DISNEY_URL);

    const items = extractItems(html);

    console.log("ITEMS:", items.length);

    const metas = [];

    // دفعات صغيرة حتى ما نضغط على Disney
    for (let i = 0; i < items.length; i += 5) {

      const batch = items.slice(i, i + 5);

      const results =
        await Promise.all(
          batch.map(enrichItem)
        );

      metas.push(...results);
    }

    return { metas };

  } catch (error) {

    console.error("CATALOG ERROR:", error);

    return {
      metas: [
        {
          id: "disney:error",
          type: "series",
          name: `ERROR: ${error.message}`
        }
      ]
    };
  }
});

builder.defineMetaHandler(async (args) => {

  try {

    const entityId =
      String(args.id || "")
        .replace("disney:", "");

    if (!entityId) {
      return { meta: null };
    }

    const url =
      `https://www.disneyplus.com/browse/entity-${entityId}`;

    const html = await getPage(url);

    const poster = extractPoster(html);
    const description = extractDescription(html);

    const meta = {
      id: `disney:${entityId}`,
      type: "series",
      name: "Disney+",
      description
    };

    if (poster) {
      meta.poster = poster;
      meta.background = poster;
    }

    return { meta };

  } catch (error) {

    console.error("META ERROR:", error);

    return { meta: null };
  }
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
