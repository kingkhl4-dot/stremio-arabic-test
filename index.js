const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.disney.series.test",
  version: "1.0.0",
  name: "🧪 Disney+ Series Test",
  description: "اختبار كتالوج مسلسلات Disney+",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "disney_series_test",
      name: "Disney+ - مسلسلات"
    }
  ]
};

const builder = new addonBuilder(manifest);

// صفحة Disney+ العامة
const DISNEY_URL = "https://www.disneyplus.com/";

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
    args.id !== "disney_series_test"
  ) {
    return { metas: [] };
  }

  try {

    const response = await fetch(DISNEY_URL, {
      headers: HEADERS,
      redirect: "follow"
    });

    const html = await response.text();

    console.log("HTTP:", response.status);
    console.log("FINAL URL:", response.url);
    console.log("HTML:", html.length);

    const names = [];
    const seen = new Set();

    // نجرب أولاً أسماء الصور الموجودة في الصفحة العامة
    const altRegex = /alt=["']([^"']+)["']/gi;

    let match;

    while ((match = altRegex.exec(html)) !== null) {

      const name = clean(match[1]);

      if (!name) continue;

      // نستبعد العناصر العامة والشعارات
      if (
        /disney|logo|facebook|instagram|youtube|app store|google play/i.test(name)
      ) {
        continue;
      }

      if (seen.has(name)) continue;

      seen.add(name);
      names.push(name);

      if (names.length >= 10) break;
    }

    console.log("NAMES FOUND:", names.length);

    // إذا وجدنا أسماء، نعرض أول 10
    if (names.length) {

      return {
        metas: names.map((name, index) => ({
          id: `disney:test:${index + 1}`,
          type: "series",
          name
        }))
      };
    }

    // إذا لم نجد، نعرض تشخيص الصفحة
    const hrefCount =
      (html.match(/href=/gi) || []).length;

    const imageCount =
      (html.match(/<img/gi) || []).length;

    const scriptCount =
      (html.match(/<script/gi) || []).length;

    const nextData =
      (html.match(/__NEXT_DATA__/gi) || []).length;

    return {
      metas: [
        {
          id: "disney:status",
          type: "series",
          name:
            `HTTP ${response.status} | HTML ${html.length}`
        },
        {
          id: "disney:href",
          type: "series",
          name:
            `href = ${hrefCount}`
        },
        {
          id: "disney:images",
          type: "series",
          name:
            `img = ${imageCount}`
        },
        {
          id: "disney:scripts",
          type: "series",
          name:
            `script = ${scriptCount}`
        },
        {
          id: "disney:next",
          type: "series",
          name:
            `NEXT_DATA = ${nextData}`
        }
      ]
    };

  } catch (error) {

    console.error("DISNEY ERROR:", error);

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

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
