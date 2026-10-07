const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.shahid.series.debug3",
  version: "3.0.0",
  name: "🧪 Shahid Series Debug 3",
  description: "فحص روابط أعمال شاهد",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "shahid_series_debug3",
      name: "شاهد - فحص روابط المسلسلات"
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
    args.id !== "shahid_series_debug3"
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

    const results = [];
    const seen = new Set();

    const linkRegex =
      /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let match;

    while ((match = linkRegex.exec(html)) !== null) {

      const href = clean(match[1]);
      const block = match[2];

      if (!href) continue;
      if (seen.has(href)) continue;

      let name =
        block.match(/alt=["']([^"']+)["']/i)?.[1] ||
        block.match(/aria-label=["']([^"']+)["']/i)?.[1] ||
        block.match(/title=["']([^"']+)["']/i)?.[1] ||
        "";

      if (!name) {
        name = block.replace(/<[^>]+>/g, " ");
      }

      name = clean(name);

      /*
        نبحث عن الروابط التي تبدو مرتبطة
        بمسلسل أو موسم أو برنامج
      */
      const looksLikeContent =
        /series|show|season|episode|مسلسل|الموسم/i.test(
          `${href} ${name}`
        );

      if (!looksLikeContent) continue;

      if (
        /kids-menu|logo|facebook|instagram|youtube/i.test(name)
      ) {
        continue;
      }

      seen.add(href);

      results.push({
        name: name || "NO NAME",
        href
      });

      if (results.length >= 10) break;
    }

    console.log("FOUND:", results);

    if (!results.length) {
      return {
        metas: [
          {
            id: "shahid:debug3:none",
            type: "series",
            name:
              `لم نجد روابط | HTTP ${response.status} | HTML ${html.length}`
          }
        ]
      };
    }

    return {
      metas: results.map((item, index) => ({
        id: `shahid:debug3:${index + 1}`,
        type: "series",

        // نظهر الاسم والرابط نفسه في النتيجة
        name:
          `${index + 1}. ${item.name} | ${item.href}`.slice(0, 450)
      }))
    };

  } catch (error) {

    console.error("SHAHID DEBUG 3 ERROR:", error);

    return {
      metas: [
        {
          id: "shahid:debug3:error",
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
