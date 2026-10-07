const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.netflix.series.debug2",
  version: "2.0.0",
  name: "🧪 Netflix Series Debug 2",
  description: "تشخيص بيانات مسلسلات Netflix",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "netflix_series_debug2",
      name: "Netflix Series Debug 2"
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

  return {
    status: response.status,
    url: response.url,
    html: await response.text()
  };
}

function countMatches(html, regex) {
  return (html.match(regex) || []).length;
}

builder.defineCatalogHandler(async (args) => {
  if (
    args.type !== "series" ||
    args.id !== "netflix_series_debug2"
  ) {
    return { metas: [] };
  }

  try {
    const result = await getPage(SERIES_URL);
    const html = result.html;

    const tests = [
      {
        name: "videoId",
        regex: /"videoId"\s*:\s*"?\d+"?/gi
      },
      {
        name: "video_id",
        regex: /"video_id"\s*:\s*"?\d+"?/gi
      },
      {
        name: "titleId",
        regex: /"titleId"\s*:\s*"?\d+"?/gi
      },
      {
        name: "title_id",
        regex: /"title_id"\s*:\s*"?\d+"?/gi
      },
      {
        name: "movieId",
        regex: /"movieId"\s*:\s*"?\d+"?/gi
      },
      {
        name: "id",
        regex: /"id"\s*:\s*"?\d{6,10}"?/gi
      },
      {
        name: "nflximg",
        regex: /nflximg\.net/gi
      },
      {
        name: "nflxso",
        regex: /nflxso\.net/gi
      },
      {
        name: "application-json",
        regex: /application\/(?:ld\+)?json/gi
      }
    ];

    const metas = [
      {
        id: "debug2:page",
        type: "series",
        name:
          `HTTP ${result.status} | HTML ${html.length}`
      }
    ];

    for (const test of tests) {
      const count = countMatches(
        html,
        test.regex
      );

      metas.push({
        id: `debug2:${test.name}`,
        type: "series",
        name: `${test.name} = ${count}`
      });
    }

    // نأخذ أمثلة فقط بدون إغراق الصفحة
    const interesting =
      html.match(
        /.{0,80}(?:videoId|titleId|movieId).{0,120}/gi
      ) || [];

    console.log("===== DEBUG 2 =====");
    console.log("HTTP:", result.status);
    console.log("URL:", result.url);
    console.log("HTML:", html.length);

    for (const test of tests) {
      console.log(
        test.name,
        countMatches(html, test.regex)
      );
    }

    console.log(
      "Samples:",
      interesting.slice(0, 10)
    );

    console.log("===================");

    return { metas };

  } catch (error) {
    console.error("DEBUG 2 ERROR:", error);

    return {
      metas: [
        {
          id: "debug2:error",
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
