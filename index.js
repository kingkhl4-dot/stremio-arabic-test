const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.tudum.test",
  version: "1.0.0",
  name: "🧪 Netflix Tudum Test",
  description: "اختبار Top 10 Netflix السعودية",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "netflix_tudum_sa",
      name: "Netflix Top 10 السعودية"
    }
  ]
};

const builder = new addonBuilder(manifest);

const URL =
  "https://www.netflix.com/tudum/top10/saudi-arabia/tv";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9"
};

builder.defineCatalogHandler(async (args) => {

  if (
    args.type !== "series" ||
    args.id !== "netflix_tudum_sa"
  ) {
    return { metas: [] };
  }

  try {

    const response = await fetch(URL, {
      headers: HEADERS,
      redirect: "follow"
    });

    const html = await response.text();

    console.log("HTTP:", response.status);
    console.log("HTML:", html.length);

    const names = [];
    const seen = new Set();

    // Tudum يستخدم أسماء الأعمال داخل alt للصور
    const regex = /alt=["']([^"']+)["']/gi;

    let match;

    while ((match = regex.exec(html)) !== null) {

      let name = match[1]
        .replace(/^Image:\s*/i, "")
        .trim();

      if (!name) continue;

      // نستبعد العناصر العامة
      if (
        /netflix|logo|top 10|country|language|profile/i.test(name)
      ) {
        continue;
      }

      if (seen.has(name)) continue;

      seen.add(name);
      names.push(name);

      if (names.length >= 10) break;
    }

    console.log("FOUND:", names);

    if (!names.length) {
      return {
        metas: [
          {
            id: "tudum:none",
            type: "series",
            name:
              `لم نجد أسماء | HTTP ${response.status} | HTML ${html.length}`
          }
        ]
      };
    }

    return {
      metas: names.map((name, index) => ({
        id: `tudum:${index + 1}`,
        type: "series",
        name: `${index + 1}. ${name}`
      }))
    };

  } catch (error) {

    console.error("TUDUM ERROR:", error);

    return {
      metas: [
        {
          id: "tudum:error",
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
