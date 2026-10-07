const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.series.debug3",
  version: "3.0.0",
  name: "🧪 Netflix Series Debug 3",
  description: "فحص JSON داخل صفحة Netflix",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "netflix_series_debug3",
      name: "Netflix Series Debug 3"
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
    html: await response.text()
  };
}

function safeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

builder.defineCatalogHandler(async (args) => {

  if (
    args.type !== "series" ||
    args.id !== "netflix_series_debug3"
  ) {
    return { metas: [] };
  }

  try {

    const result = await getPage();
    const html = result.html;

    const scriptRegex =
      /<script[^>]+type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi;

    const blocks = [];

    let match;

    while ((match = scriptRegex.exec(html)) !== null) {
      blocks.push(match[1]);
    }

    const metas = [
      {
        id: "debug3:page",
        type: "series",
        name: `HTTP ${result.status} | JSON blocks ${blocks.length}`
      }
    ];

    blocks.forEach((raw, index) => {

      let description =
        `JSON ${index + 1} | length ${raw.length}`;

      try {

        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          description +=
            ` | ARRAY ${parsed.length}`;

          if (
            parsed.length > 0 &&
            parsed[0] &&
            typeof parsed[0] === "object"
          ) {
            description +=
              ` | keys: ${Object.keys(parsed[0])
                .slice(0, 8)
                .join(",")}`;
          }

        } else if (
          parsed &&
          typeof parsed === "object"
        ) {

          const keys =
            Object.keys(parsed).slice(0, 12);

          description +=
            ` | keys: ${keys.join(",")}`;
        }

      } catch (error) {

        description +=
          ` | NOT PARSED | ${safeText(raw)}`;
      }

      metas.push({
        id: `debug3:json${index + 1}`,
        type: "series",
        name: description
      });
    });

    console.log("===== DEBUG 3 =====");
    console.log("HTTP:", result.status);
    console.log("HTML:", html.length);
    console.log("JSON blocks:", blocks.length);

    blocks.forEach((raw, i) => {
      console.log(
        `JSON ${i + 1}:`,
        safeText(raw)
      );
    });

    console.log("===================");

    return { metas };

  } catch (error) {

    console.error("DEBUG 3 ERROR:", error);

    return {
      metas: [
        {
          id: "debug3:error",
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
