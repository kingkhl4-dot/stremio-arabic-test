const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.sa.test",
  version: "1.0.1",
  name: "🧪 Netflix السعودية - اختبار",
  description: "اختبار قراءة أسماء العناوين من صفحة Netflix السعودية",
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

  return await response.text();
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

function extractNames(html) {
  const names = [];
  const seen = new Set();

  // Netflix قد يضع أسماء العناوين في alt أو aria-label
  const patterns = [
    /alt="([^"]+)"/gi,
    /aria-label="([^"]+)"/gi
  ];

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(html)) !== null) {
      const name = decodeHtml(match[1]);

      if (!name) continue;
      if (name.length < 2 || name.length > 150) continue;
      if (seen.has(name)) continue;

      // نستبعد الكلمات العامة الموجودة في واجهة الموقع
      const lower = name.toLowerCase();

      if (
        lower.includes("netflix") ||
        lower.includes("sign in") ||
        lower.includes("تسجيل الدخول") ||
        lower.includes("menu") ||
        lower.includes("logo")
      ) {
        continue;
      }

      seen.add(name);
      names.push(name);
    }
  }

  return names;
}

builder.defineCatalogHandler(async (args) => {
  if (
    args.type !== "movie" ||
    args.id !== "netflix_sa_movies"
  ) {
    return { metas: [] };
  }

  try {
    console.log("Fetching Netflix Saudi page...");

    const html = await getNetflixPage();

    console.log("HTML length:", html.length);

    const names = extractNames(html);

    console.log("Netflix names found:", names.length);
    console.log("First names:", names.slice(0, 20));

    /*
      هذا اختبار فقط.
      Stremio يحتاج poster لعرض البطاقات بشكل طبيعي،
      لذلك نستخدم صورة مؤقتة ثابتة حتى نتأكد أولاً
      أن أسماء Netflix يتم استخراجها فعلاً.
    */

    const metas = names.slice(0, 100).map((name, index) => ({
      id: `netflix-test:${index}`,
      type: "movie",
      name,
      poster:
        "https://dummyimage.com/300x450/111/ffffff.png&text=Netflix"
    }));

    return { metas };
  } catch (error) {
    console.error("Netflix test error:", error);
    return { metas: [] };
  }
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
