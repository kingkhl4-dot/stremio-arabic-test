const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const manifest = {
  id: "org.khalid.justwatch.netflix.sa.test2",
  version: "2.0.0",
  name: "🧪 Netflix Saudi via JustWatch",
  description: "اختبار كتالوج Netflix السعودية عبر JustWatch",
  resources: ["catalog"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "netflix_sa_justwatch2",
      name: "Netflix السعودية - JustWatch"
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

        content(
          country: $country
          language: $language
        ) {
          title
          originalReleaseYear
          fullPath
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

  console.log("HTTP:", response.status);
  console.log("RESPONSE:", text.slice(0, 2000));

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${text.slice(0, 300)}`
    );
  }

  const data = JSON.parse(text);

  if (data.errors?.length) {
    throw new Error(
      data.errors.map(e => e.message).join(" | ")
    );
  }

  return data?.data?.popularTitles?.edges || [];
}


builder.defineCatalogHandler(async args => {

  if (
    args.type !== "series" ||
    args.id !== "netflix_sa_justwatch2"
  ) {
    return { metas: [] };
  }

  try {

    const edges = await getNetflixSaudiSeries();

    if (!edges.length) {
      return {
        metas: [
          {
            id: "jw:none",
            type: "series",
            name: "JustWatch رجع 0 مسلسل"
          }
        ]
      };
    }

    return {
      metas: edges.slice(0, 10).map((edge, index) => {

        const node = edge.node;
        const content = node.content || {};

        const title =
          content.title ||
          `مسلسل ${index + 1}`;

        const year =
          content.originalReleaseYear
            ? ` (${content.originalReleaseYear})`
            : "";

        return {
          id: `jw:${node.objectId || node.id}`,
          type: "series",
          name: `${index + 1}. ${title}${year}`
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
            `JustWatch ERROR: ${error.message}`.slice(0, 500)
        }
      ]
    };
  }
});


serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
