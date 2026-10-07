const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.shahid.series.landing",
  version: "6.0.0",
  name: "🧪 Shahid Series Landing",
  description: "اختبار صفحة مسلسلات شاهد البديلة",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "shahid_series_landing",
      name: "شاهد - Landing Series"
    }
  ]
};

const builder = new addonBuilder(manifest);

const SHAHID_URL =
  "https://shahid.mbc.net/ar/landingpages/series";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

function decodeHtml(text) {
  return String(text || "")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function cleanName(slug) {
  try {
    return decodeURIComponent(slug)
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return slug
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

builder.defineCatalogHandler(async (args) => {

  if (
    args.type !== "series" ||
    args.id !== "shahid_series_landing"
  ) {
    return { metas: [] };
  }

  try {

    const response = await fetch(SHAHID_URL, {
      headers: HEADERS,
      redirect: "follow"
    });

    let html = await response.text();
    html = decodeHtml(html);

    console.log("HTTP:", response.status);
    console.log("FINAL URL:", response.url);
    console.log("HTML:", html.length);

    const results = [];
    const seen = new Set();

    // مثال:
    // /ar/series/اسم-المسلسل/series-141486

    const regex =
      /\/(?:ar\/)?series\/([^"'<>?\s]+?)\/series-(\d+)/gi;

    let match;

    while ((match = regex.exec(html)) !== null) {

      const slug = match[1];
      const shahidId = match[2];

      if (seen.has(shahidId)) continue;

      seen.add(shahidId);

      results.push({
        id: shahidId,
        name: cleanName(slug),
        path: match[0]
      });

      if (results.length >= 10) break;
    }

    console.log("FOUND:", results);

    if (results.length) {
      return {
        metas: results.map((item, index) => ({
          id: `shahid:${item.id}`,
          type: "series",
          name:
            `${index + 1}. ${item.name} | ID ${item.id}`
        }))
      };
    }

    // فحص احتياطي لأي series-ID داخل الصفحة

    const rawIds = [
      ...html.matchAll(/series-(\d+)/gi)
    ].map(x => x[1]);

    const uniqueIds = [...new Set(rawIds)];

    return {
      metas: [
        {
          id: "shahid:landing:status",
          type: "series",
          name:
            `HTTP ${response.status} | HTML ${html.length}`
        },
        {
          id: "shahid:landing:count",
          type: "series",
          name:
            `عدد series-ID = ${uniqueIds.length}`
        },
        {
          id: "shahid:landing:first",
          type: "series",
          name:
            uniqueIds.length
              ? `أول ID = ${uniqueIds[0]}`
              : "لم نجد أي series-ID"
        }
      ]
    };

  } catch (error) {

    console.error("SHAHID LANDING ERROR:", error);

    return {
      metas: [
        {
          id: "shahid:landing:error",
          type: "series",
          name: `ERROR: ${error.message}`
        }
      ]
    };
  }
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
