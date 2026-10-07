const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.series.debug4",
  version: "4.0.0",
  name: "🧪 Netflix Series Debug 4",
  description: "فحص أماكن application/json في Netflix",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "netflix_series_debug4",
      name: "Netflix Series Debug 4"
    }
  ]
};

const builder = new addonBuilder(manifest);

const SERIES_URL =
  "https://www.netflix.com/sa-ar/browse/genre/11714";

const HEADERS = {
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
};

async function getPage() {
  const response = await fetch(SERIES_URL, {
    headers: HEADERS,
    redirect: "follow"
  });

  return {
    status: response.status,
    url: response.url,
    html: await response.text()
  };
}

function clean(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/"/g, "'")
    .trim();
}

builder.defineCatalogHandler(async (args) => {
  if (
    args.type !== "series" ||
    args.id !== "netflix_series_debug4"
  ) {
    return { metas: [] };
  }

  try {
    const result = await getPage();
    const html = result.html;

    const needle = "application/json";
    const positions = [];

    let position = 0;

    while (true) {
      const found = html
        .toLowerCase()
        .indexOf(needle, position);

      if (found === -1) break;

      positions.push(found);
      position = found + needle.length;
    }

    const metas = [
      {
        id: "debug4:page",
        type: "series",
        name:
          `HTTP ${result.status} | HTML ${html.length} | matches ${positions.length}`
      }
    ];

    positions.slice(0, 9).forEach((pos, index) => {
      const start = Math.max(0, pos - 180);
      const end = Math.min(
        html.length,
        pos + 350
      );

      const sample = clean(
        html.slice(start, end)
      );

      console.log(
        `===== MATCH ${index + 1} =====`
      );
      console.log(sample);

      // نخلي جزء من النص يظهر مباشرة في رابط الفحص
      metas.push({
        id: `debug4:match${index + 1}`,
        type: "series",
        name:
          `MATCH ${index + 1}: ${sample.slice(0, 280)}`
      });
    });

    // فحوص إضافية تساعدنا نعرف نوع الصفحة
    const checks = [
      ["__NEXT_DATA__", /__NEXT_DATA__/gi],
      ["netflix.falcor", /falcor/gi],
      ["graphql", /graphql/gi],
      ["lolomo", /lolomo/gi],
      ["genreId", /genreId/gi],
      ["jawBone", /jawBone/gi],
      ["billboard", /billboard/gi]
    ];

    for (const [name, regex] of checks) {
      const count =
        (html.match(regex) || []).length;

      metas.push({
        id: `debug4:check:${name}`,
        type: "series",
        name: `${name} = ${count}`
      });

      console.log(`${name}: ${count}`);
    }

    console.log(
      "Final URL:",
      result.url
    );

    return { metas };

  } catch (error) {
    console.error("DEBUG 4 ERROR:", error);

    return {
      metas: [
        {
          id: "debug4:error",
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
