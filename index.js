const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.sa.test",
  version: "1.0.2",
  name: "🧪 Netflix السعودية - تجريبي",
  description: "اختبار كتالوج Netflix السعودية العام",
  resources: ["catalog"],
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

async function getNetflixPage() {
  const response = await fetch(NETFLIX_URL, {
    headers: {
      "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Netflix HTTP ${response.status}`);
  }

  return response.text();
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/\\u0027/g, "'")
    .replace(/\\u0022/g, '"')
    .trim();
}

function cleanName(text) {
  return decodeHtml(text)
    .replace(/^Go to\s*/i, "")
    .replace(/^اذهب إلى\s*/i, "")
    .trim();
}

function extractNetflix(html) {
  const metas = [];
  const seen = new Set();

  /*
    نبحث عن روابط Netflix العامة التي تحتوي على title ID،
    ثم نقرأ النص والصورة الموجودة بالقرب منها.
  */
  const linkRegex =
    /<a[^>]+href="([^"]*\/title\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const netflixId = match[2];

    if (seen.has(netflixId)) continue;

    const block = match[3];

    const alt =
      block.match(/alt="([^"]+)"/i)?.[1] || "";

    const aria =
      block.match(/aria-label="([^"]+)"/i)?.[1] || "";

    const img =
      block.match(/<img[^>]+src="([^"]+)"/i)?.[1] || "";

    let name = cleanName(alt || aria);

    /*
      بعض أسماء Netflix تكون في خصائص العنصر نفسه،
      لذلك نأخذ جزءاً من HTML حول الرابط كخيار إضافي.
    */
    if (!name) {
      const start = Math.max(0, match.index - 500);
      const end = Math.min(
        html.length,
        linkRegex.lastIndex + 500
      );

      const around = html.slice(start, end);

      const nearby =
        around.match(/aria-label="([^"]+)"/i)?.[1] ||
        around.match(/alt="([^"]+)"/i)?.[1] ||
        "";

      name = cleanName(nearby);
    }

    if (!name) continue;

    seen.add(netflixId);

    metas.push({
      id: `netflix:${netflixId}`,
      type: "movie",
      name,
      poster:
        img ||
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
    console.log("Fetching Netflix Saudi...");

    const html = await getNetflixPage();

    console.log("HTML length:", html.length);

    const metas = extractNetflix(html);

    console.log("Netflix items with ID:", metas.length);
    console.log("First items:", metas.slice(0, 10));

    return {
      metas: metas.slice(0, 100)
    };
  } catch (error) {
    console.error("Netflix error:", error);
    return { metas: [] };
  }
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
