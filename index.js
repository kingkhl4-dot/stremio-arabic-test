const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.justwatch.netflix.sa.test",
  version: "1.0.0",
  name: "🧪 Netflix Saudi via JustWatch",
  description: "اختبار كتالوج Netflix السعودية عبر JustWatch",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "netflix_sa_justwatch",
      name: "Netflix السعودية - اختبار"
    }
  ]
};

const builder = new addonBuilder(manifest);

const JUSTWATCH_URL = "https://apis.justwatch.com/graphql";

const QUERY = `
query GetPopularTitles(
  $country: Country!
  $language: Language!
  $first: Int!
  $filter: TitleFilter
) {
  popularTitles(
    country: $country
    first: $first
    filter: $filter
  ) {
    edges {
      node {
        id
        objectId
        objectType
        content(country: $country, language: $language) {
          title
          originalReleaseYear
          fullPath
        }
        scoring {
          imdbId
        }
      }
    }
  }
}
`;

async function getNetflixSaudiSeries() {

  const response = await fetch(JUSTWATCH_URL, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36"
    },

    body: JSON.stringify({
      operationName: "GetPopularTitles",

      variables: {
        country: "SA",
        language: "ar",
        first: 10,

        filter: {
          objectTypes: ["SHOW"],
          packages: ["nfx"]
        }
      },

      query: QUERY
    })
  });

  const text = await response.text();

  console.log("JUSTWATCH HTTP:", response.status);
  console.log("JUSTWATCH RESPONSE:", text.slice(0, 1000));

  if (!response.ok) {
    throw new Error(
      `JustWatch HTTP ${response.status}: ${text.slice(0, 200)}`
    );
  }

  const data = JSON.parse(text);

  if (data.errors) {
    throw new Error(
      data.errors.map(x => x.message).join(" | ")
    );
  }

  const edges =
    data?.data?.popularTitles?.edges || [];

  return edges.slice(0, 10);
}


builder.defineCatalogHandler(async args => {

  if (
    args.type !== "series" ||
    args.id !== "netflix_sa_justwatch"
  ) {
    return { metas: [] };
  }

  try {

    const edges =
      await getNetflixSaudiSeries();

    if (!edges.length) {
      return {
        metas: [
          {
            id: "jw:none",
            type: "series",
            name: "لم نجد مسلسلات Netflix للسعودية"
          }
        ]
      };
    }

    return {
      metas: edges.map((edge, index) => {

        const item = edge.node;
        const content = item.content || {};

        const name =
          content.title ||
          `Netflix ${index + 1}`;

        const year =
          content.originalReleaseYear
            ? ` (${content.originalReleaseYear})`
            : "";

        return {
          id:
            edge.node.scoring?.imdbId ||
            `jw:${item.objectId || item.id}`,

          type: "series",

          name:
            `${index + 1}. ${name}${year}`
        };
      })
    };

  } catch (error) {

    console.error("JUSTWATCH ERROR:", error);

    return {
      metas: [
        {
          id: "jw:error",
          type: "series",
          name:
            `JustWatch ERROR: ${error.message}`.slice(0, 450)
        }
      ]
    };
  }
});


serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
