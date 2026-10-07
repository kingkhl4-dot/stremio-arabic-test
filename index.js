const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.shahid.series.links",
  version: "2.0.0",
  name: "🧪 Shahid Series Links",
  description: "اختبار روابط ومعرفات مسلسلات شاهد",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "shahid_series_links",
      name: "شاهد - مسلسلات"
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
    args.id !== "shahid_series_links"
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

    const metas = [];
    const seen = new Set();

    const linkRegex =
      /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let match;

    while ((match = linkRegex.exec(html)) !== null) {

      const href = clean(match[1]);
      const block = match[2];

      // نريد روابط المسلسلات فقط
      if (!/series/i.test(href)) continue;

      if (seen.has(href)) continue;

      let name =
        block.match(/alt=["']([^"']+)["']/i)?.[1] ||
        block.match(/aria-label=["']([^"']+)["']/i)?.[1] ||
        block.match(/title=["']([^"']+)["']/i)?.[1] ||
        "";

      name = clean(name);

      // إذا الاسم غير موجود نحاول استخراجه من نص الرابط
      if (!name) {
        name = clean(
          block.replace(/<[^>]+>/g, " ")
        );
      }

      if (!name) continue;

      if (
        /kids-menu|plus icon|logo|facebook|instagram|youtube/i.test(name)
      ) {
        continue;
      }

      seen.add(href);

      metas.push({
        id: `shahid:${metas.length + 1}`,
        type: "series",
        name
      });

      console.log("FOUND:", name, href);

      if (metas.length >= 10) break;
    }

    console.log("SERIES LINKS FOUND:", metas.length);

    if (metas.length) {
      return { metas };
    }

    // تشخيص إذا لم نجد روابط بالطريقة المتوقعة
    const allHrefs =
      [...html.matchAll(/href=["']([^"']+)["']/gi)]
        .map(x => x[1]);

    const seriesHrefs =
      allHrefs.filter(x => /series/i.test(x));

    const uniqueSeries =
      [...new Set(seriesHrefs)];

    return {
      metas: [
        {
          id: "shahid:debug:1",
          type: "series",
          name:
            `HTTP ${response.status} | HTML ${html.length}`
        },
        {
          id: "shahid:debug:2",
          type: "series",
          name:
            `All links = ${allHrefs.length}`
        },
        {
          id: "shahid:debug:3",
          type: "series",
          name:
            `Series links = ${uniqueSeries.length}`
        },
        {
          id: "shahid:debug:4",
          type: "series",
          name:
            uniqueSeries.length
              ? `FIRST: ${clean(uniqueSeries[0]).slice(0, 250)}`
              : "لم نجد روابط series"
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
