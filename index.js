const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.shahid.series.debug4",
  version: "4.0.0",
  name: "🧪 Shahid Series Debug 4",
  description: "استخراج معرفات مسلسلات شاهد من الصفحة العامة",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "shahid_series_debug4",
      name: "شاهد - فحص معرفات المسلسلات"
    }
  ]
};

const builder = new addonBuilder(manifest);

const SHAHID_URL = "https://shahid.mbc.net/ar/series";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

function decodeText(text) {
  return String(text || "")
    .replace(/\\u002F/gi, "/")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function decodeSlug(slug) {
  try {
    return decodeURIComponent(slug)
      .replace(/-/g, " ")
      .trim();
  } catch {
    return slug.replace(/-/g, " ").trim();
  }
}

builder.defineCatalogHandler(async (args) => {

  if (
    args.type !== "series" ||
    args.id !== "shahid_series_debug4"
  ) {
    return { metas: [] };
  }

  try {

    const response = await fetch(SHAHID_URL, {
      headers: HEADERS,
      redirect: "follow"
    });

    let html = await response.text();

    html = decodeText(html);

    console.log("HTTP:", response.status);
    console.log("HTML:", html.length);

    const found = [];
    const seen = new Set();

    /*
      مثال متوقع:
      /ar/series/اسم-المسلسل/series-141486
    */
    const regex =
      /\/(?:ar\/)?series\/([^"'<>?\s]+?)\/series-(\d+)/gi;

    let match;

    while ((match = regex.exec(html)) !== null) {

      const slug = match[1];
      const shahidId = match[2];

      if (seen.has(shahidId)) continue;

      seen.add(shahidId);

      const name = decodeSlug(slug);

      found.push({
        shahidId,
        name,
        path: match[0]
      });

      console.log(
        "FOUND:",
        shahidId,
        name,
        match[0]
      );

      if (found.length >= 10) break;
    }

    if (found.length) {

      return {
        metas: found.map(item => ({
          id: `shahid:${item.shahidId}`,
          type: "series",
          name: `${item.name} | ID ${item.shahidId}`
        }))
      };
    }

    // إذا لم نجد، نحسب أي ظهور لـ series-ID
    const rawIds = [
      ...html.matchAll(/series-(\d+)/gi)
    ].map(x => x[1]);

    const uniqueIds = [...new Set(rawIds)];

    return {
      metas: [
        {
          id: "shahid:debug4:status",
          type: "series",
          name:
            `HTTP ${response.status} | HTML ${html.length}`
        },
        {
          id: "shahid:debug4:ids",
          type: "series",
          name:
            `series-ID = ${uniqueIds.length}`
        },
        {
          id: "shahid:debug4:first",
          type: "series",
          name:
            uniqueIds.length
              ? `FIRST ID = ${uniqueIds[0]}`
              : "لم نجد أي series-ID"
        }
      ]
    };

  } catch (error) {

    console.error("SHAHID DEBUG 4 ERROR:", error);

    return {
      metas: [
        {
          id: "shahid:debug4:error",
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
