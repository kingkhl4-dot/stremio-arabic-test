const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.disney.series.links",
  version: "2.0.0",
  name: "🧪 Disney+ Series Links",
  description: "اختبار روابط ومعرفات أعمال Disney+",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "disney_series_links",
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
    args.id !== "disney_series_links"
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
    console.log("HTML:", html.length);

    const metas = [];
    const seen = new Set();

    /*
      نبحث عن رابط Disney entity
      ونفحص المحتوى القريب منه للحصول على اسم الصورة
    */
    const linkRegex =
      /<a[^>]+href=["']([^"']*\/browse\/entity-([a-zA-Z0-9-]+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;

    let match;

    while ((match = linkRegex.exec(html)) !== null) {

      const href = clean(match[1]);
      const entityId = clean(match[2]);
      const block = match[3];

      if (!entityId || seen.has(entityId)) continue;

      let name =
        block.match(/alt=["']([^"']+)["']/i)?.[1] ||
        block.match(/aria-label=["']([^"']+)["']/i)?.[1] ||
        "";

      name = clean(name);

      if (!name) continue;

      if (
        /disney\+?|logo|hbo max|bundle|espn|hulu/i.test(name)
      ) {
        continue;
      }

      seen.add(entityId);

      metas.push({
        id: `disney:${entityId}`,
        type: "series",
        name: name
      });

      console.log(
        "FOUND:",
        name,
        entityId,
        href
      );

      if (metas.length >= 10) break;
    }

    console.log("ENTITY RESULTS:", metas.length);

    if (metas.length) {
      return { metas };
    }

    // إذا ما اشتغل الربط، نعرف هل روابط entity موجودة أصلًا
    const entityLinks =
      html.match(/\/browse\/entity-[a-zA-Z0-9-]+/gi) || [];

    const uniqueEntities =
      [...new Set(entityLinks)];

    return {
      metas: [
        {
          id: "disney:debug:1",
          type: "series",
          name:
            `HTTP ${response.status} | HTML ${html.length}`
        },
        {
          id: "disney:debug:2",
          type: "series",
          name:
            `Entity links = ${uniqueEntities.length}`
        },
        {
          id: "disney:debug:3",
          type: "series",
          name:
            uniqueEntities.length
              ? `FIRST: ${uniqueEntities[0]}`
              : "لم نجد روابط entity"
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
