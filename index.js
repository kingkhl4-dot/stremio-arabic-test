const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.series83.test",
  version: "1.0.0",
  name: "🧪 Netflix Series 83",
  description: "اختبار مسلسلات Netflix من genre 83",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "netflix_series83",
      name: "Netflix Series Test"
    }
  ]
};

const builder = new addonBuilder(manifest);

const SERIES_URL =
  "https://www.netflix.com/us/browse/genre/83";

const HEADERS = {
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

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

builder.defineCatalogHandler(async (args) => {

  if (
    args.type !== "series" ||
    args.id !== "netflix_series83"
  ) {
    return { metas: [] };
  }

  try {

    const response = await fetch(SERIES_URL, {
      headers: HEADERS,
      redirect: "follow"
    });

    const html = await response.text();

    console.log("HTTP:", response.status);
    console.log("Final URL:", response.url);
    console.log("HTML:", html.length);

    const metas = [];
    const seen = new Set();

    const regex =
      /<a[^>]+href=["'][^"']*\/title\/(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;

    let match;

    while ((match = regex.exec(html)) !== null) {

      const netflixId = match[1];

      if (seen.has(netflixId)) continue;

      const block = match[2];

      const alt =
        block.match(/alt=["']([^"']+)["']/i)?.[1] || "";

      const aria =
        block.match(/aria-label=["']([^"']+)["']/i)?.[1] || "";

      const name = cleanName(alt || aria);

      if (!name) continue;

      seen.add(netflixId);

      metas.push({
        id: `netflix:${netflixId}`,
        type: "series",
        name
      });

      if (metas.length >= 10) break;
    }

    console.log("SERIES FOUND:", metas.length);

    // إذا لم نجد شيئًا، تظهر نتيجة التشخيص بدل صفحة فارغة
    if (!metas.length) {

      const titleLinks =
        (html.match(/\/title\/\d+/gi) || []).length;

      return {
        metas: [
          {
            id: "series83:debug",
            type: "series",
            name:
              `HTTP ${response.status} | HTML ${html.length} | /title/ = ${titleLinks}`
          }
        ]
      };
    }

    return { metas };

  } catch (error) {

    console.error("SERIES 83 ERROR:", error);

    return {
      metas: [
        {
          id: "series83:error",
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
