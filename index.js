const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.series.debug",
  version: "1.0.0",
  name: "🧪 Netflix Series Debug",
  description: "تشخيص صفحة مسلسلات Netflix",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "netflix_series_debug",
      name: "Netflix Series Debug"
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

async function getPage(url) {
  const response = await fetch(url, {
    headers: HEADERS,
    redirect: "follow"
  });

  const html = await response.text();

  return {
    html,
    status: response.status,
    finalUrl: response.url
  };
}

builder.defineCatalogHandler(async (args) => {
  if (
    args.type !== "series" ||
    args.id !== "netflix_series_debug"
  ) {
    return { metas: [] };
  }

  try {
    const result = await getPage(SERIES_URL);
    const html = result.html;

    // كم مرة ظهر /title/ في الصفحة؟
    const titleMatches =
      html.match(/\/title\/\d+/gi) || [];

    // نأخذ IDs فريدة فقط
    const ids = [
      ...new Set(
        titleMatches.map(x =>
          x.match(/\d+/)?.[0]
        )
      )
    ].filter(Boolean);

    // نبحث عن أي أرقام Netflix تظهر حول كلمة title
    const looseMatches =
      html.match(/title.{0,100}?\d{6,10}/gi) || [];

    console.log("===== NETFLIX SERIES DEBUG =====");
    console.log("HTTP status:", result.status);
    console.log("Final URL:", result.finalUrl);
    console.log("HTML length:", html.length);
    console.log("/title/ count:", titleMatches.length);
    console.log("Unique IDs:", ids.length);
    console.log("First IDs:", ids.slice(0, 10));
    console.log(
      "Loose title matches:",
      looseMatches.slice(0, 5)
    );
    console.log("===============================");

    // نخلي نتيجة Stremio نفسها تعرض لنا التشخيص
    const metas = [
      {
        id: "debug:status",
        type: "series",
        name: `HTTP ${result.status} | HTML ${html.length}`
      },
      {
        id: "debug:titles",
        type: "series",
        name: `/title/ = ${titleMatches.length} | IDs = ${ids.length}`
      }
    ];

    ids.slice(0, 5).forEach((id, index) => {
      metas.push({
        id: `debug:${id}`,
        type: "series",
        name: `Netflix ID ${index + 1}: ${id}`
      });
    });

    return { metas };

  } catch (error) {
    console.error("DEBUG ERROR:", error);

    return {
      metas: [
        {
          id: "debug:error",
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
