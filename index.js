const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.shahid.series.test",
  version: "1.0.0",
  name: "🧪 Shahid Series Test",
  description: "اختبار كتالوج مسلسلات شاهد",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "shahid_series_test",
      name: "شاهد - مسلسلات"
    }
  ]
};

const builder = new addonBuilder(manifest);

// صفحة شاهد العامة
const SHAHID_URL = "https://shahid.mbc.net/ar/series";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

function clean(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

builder.defineCatalogHandler(async (args) => {

  if (
    args.type !== "series" ||
    args.id !== "shahid_series_test"
  ) {
    return { metas: [] };
  }

  try {

    const response = await fetch(SHAHID_URL, {
      headers: HEADERS,
      redirect: "follow"
    });

    const html = await response.text();

    console.log("HTTP:", response.status);
    console.log("FINAL URL:", response.url);
    console.log("HTML:", html.length);

    const names = [];
    const seen = new Set();

    // التجربة الأولى: أسماء الصور
    const altRegex = /alt=["']([^"']+)["']/gi;

    let match;

    while ((match = altRegex.exec(html)) !== null) {

      const name = clean(match[1]);

      if (!name) continue;

      // نستبعد الأشياء العامة
      if (
        /shahid|شاهد|logo|facebook|instagram|youtube|app store|google play/i.test(name)
      ) {
        continue;
      }

      if (seen.has(name)) continue;

      seen.add(name);
      names.push(name);

      if (names.length >= 10) break;
    }

    console.log("NAMES FOUND:", names.length);

    if (names.length) {

      return {
        metas: names.map((name, index) => ({
          id: `shahid:test:${index + 1}`,
          type: "series",
          name
        }))
      };
    }

    // إذا ما ظهرت أسماء، يعطينا تشخيص الصفحة
    const hrefCount =
      (html.match(/href=/gi) || []).length;

    const imgCount =
      (html.match(/<img/gi) || []).length;

    const scriptCount =
      (html.match(/<script/gi) || []).length;

    const nextDataCount =
      (html.match(/__NEXT_DATA__/gi) || []).length;

    const seriesCount =
      (html.match(/series/gi) || []).length;

    return {
      metas: [
        {
          id: "shahid:status",
          type: "series",
          name:
            `HTTP ${response.status} | HTML ${html.length}`
        },
        {
          id: "shahid:href",
          type: "series",
          name:
            `href = ${hrefCount}`
        },
        {
          id: "shahid:img",
          type: "series",
          name:
            `img = ${imgCount}`
        },
        {
          id: "shahid:script",
          type: "series",
          name:
            `script = ${scriptCount}`
        },
        {
          id: "shahid:next",
          type: "series",
          name:
            `NEXT_DATA = ${nextDataCount}`
        },
        {
          id: "shahid:series",
          type: "series",
          name:
            `series text = ${seriesCount}`
        }
      ]
    };

  } catch (error) {

    console.error("SHAHID ERROR:", error);

    return {
      metas: [
        {
          id: "shahid:error",
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
