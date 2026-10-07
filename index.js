const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.series.debug5",
  version: "5.0.0",
  name: "🧪 Netflix Series Debug 5",
  description: "فحص محتوى صفحة Netflix الفعلي",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "netflix_series_debug5",
      name: "Netflix Series Debug 5"
    }
  ]
};

const builder = new addonBuilder(manifest);

const SERIES_URL =
  "https://www.netflix.com/sa-ar/browse/genre/11714";

const HEADERS = {
  "Accept-Language": "ar-SA,ar;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
};

function clean(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/"/g, "'")
    .trim();
}

async function getPage() {
  const response = await fetch(SERIES_URL, {
    headers: HEADERS,
    redirect: "follow"
  });

  return {
    status: response.status,
    finalUrl: response.url,
    contentType:
      response.headers.get("content-type") || "",
    html: await response.text()
  };
}

builder.defineCatalogHandler(async (args) => {

  if (
    args.type !== "series" ||
    args.id !== "netflix_series_debug5"
  ) {
    return { metas: [] };
  }

  try {

    const result = await getPage();
    const html = result.html;

    const title =
      html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
      "NO TITLE";

    const description =
      html.match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i
      )?.[1] ||
      "NO DESCRIPTION";

    const scripts = [
      ...html.matchAll(
        /<script[^>]+src=["']([^"']+)["']/gi
      )
    ].map(x => x[1]);

    const links = [
      ...html.matchAll(
        /<link[^>]+href=["']([^"']+)["']/gi
      )
    ].map(x => x[1]);

    const firstHtml = clean(
      html.slice(0, 1500)
    );

    const metas = [
      {
        id: "debug5:status",
        type: "series",
        name:
          `HTTP ${result.status} | HTML ${html.length}`
      },
      {
        id: "debug5:type",
        type: "series",
        name:
          `Content-Type: ${result.contentType}`
      },
      {
        id: "debug5:title",
        type: "series",
        name:
          `TITLE: ${clean(title).slice(0, 250)}`
      },
      {
        id: "debug5:description",
        type: "series",
        name:
          `DESC: ${clean(description).slice(0, 250)}`
      },
      {
        id: "debug5:scripts",
        type: "series",
        name:
          `SCRIPT SRC = ${scripts.length}`
      },
      {
        id: "debug5:links",
        type: "series",
        name:
          `LINK HREF = ${links.length}`
      },
      {
        id: "debug5:start",
        type: "series",
        name:
          `START: ${firstHtml.slice(0, 500)}`
      }
    ];

    scripts.slice(0, 5).forEach((src, i) => {
      metas.push({
        id: `debug5:script${i}`,
        type: "series",
        name:
          `SCRIPT ${i + 1}: ${clean(src).slice(0, 300)}`
      });
    });

    console.log("===== DEBUG 5 =====");
    console.log("HTTP:", result.status);
    console.log("Final URL:", result.finalUrl);
    console.log("Content-Type:", result.contentType);
    console.log("HTML length:", html.length);
    console.log("TITLE:", clean(title));
    console.log("DESCRIPTION:", clean(description));
    console.log("SCRIPT SRC:", scripts.length);
    console.log("LINK HREF:", links.length);
    console.log("FIRST HTML:", firstHtml);
    console.log("===================");

    return { metas };

  } catch (error) {

    console.error("DEBUG 5 ERROR:", error);

    return {
      metas: [
        {
          id: "debug5:error",
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
