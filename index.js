const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.sa.test",
  version: "1.0.0",
  name: "🧪 Netflix السعودية - تجريبي",
  description: "اختبار قراءة كتالوج Netflix السعودية العام",
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

// صفحة أفلام Netflix السعودية العامة
const NETFLIX_URL =
  "https://www.netflix.com/sa/browse/genre/34399";

async function getNetflixPage() {
  const response = await fetch(NETFLIX_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`Netflix HTTP ${response.status}`);
  }

  return response.text();
}

function extractTitles(html) {
  const metas = [];
  const seen = new Set();

  /*
    Netflix يضع في الصفحات العامة روابط للعناوين بالشكل:
    /title/12345678
    ونحاول استخراج ID + الاسم + الصورة من HTML.
  */

  const regex =
    /<a[^>]+href="(?:https?:\/\/www\.netflix\.com)?\/(?:sa(?:-ar)?\/)?title\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const netflixId = match[1];

    if (seen.has(netflixId)) continue;

    const block = match[2];

    const imgMatch =
      block.match(/<img[^>]+src="([^"]+)"/i);

    const altMatch =
      block.match(/<img[^>]+alt="([^"]+)"/i);

    const titleMatch =
      block.match(/title="([^"]+)"/i);

    const name =
      altMatch?.[1] ||
      titleMatch?.[1] ||
      `Netflix ${netflixId}`;

    const poster = imgMatch?.[1];

    if (!poster) continue;

    seen.add(netflixId);

    metas.push({
      id: `netflix:${netflixId}`,
      type: "movie",
      name: decodeHtml(name),
      poster
    });
  }

  return metas;
}

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

builder.defineCatalogHandler(async (args) => {
  if (
    args.type !== "movie" ||
    args.id !== "netflix_sa_movies"
  ) {
    return { metas: [] };
  }

  try {
    console.log("Fetching Netflix Saudi Arabia...");

    const html = await getNetflixPage();

    console.log(
      "Netflix HTML received:",
      html.length,
      "characters"
    );

    const metas = extractTitles(html);

    console.log(
      "Netflix titles found:",
      metas.length
    );

    return { metas };
  } catch (error) {
    console.error(
      "Netflix catalog error:",
      error
    );

    return { metas: [] };
  }
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
