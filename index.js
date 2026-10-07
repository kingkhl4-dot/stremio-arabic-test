const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const builder = new addonBuilder({
  id: "org.khalid.imdb.test",
  version: "1.0.0",
  name: "اختبار IMDb العربي",
  description: "اختبار هوية IMDb مع بيانات عربية خاصة",
  resources: ["catalog", "meta"],
  types: ["movie", "series"],

  catalogs: [
    {
      type: "series",
      id: "imdb-arabic-test",
      name: "اختبار IMDb العربي"
    }
  ],

  idPrefixes: ["tt"]
});

// The Blacklist
const TEST_ID = "tt2741602";

builder.defineCatalogHandler(async ({ type, id }) => {
  if (type !== "series" || id !== "imdb-arabic-test") {
    return { metas: [] };
  }

  return {
    metas: [
      {
        id: TEST_ID,
        type: "series",

        // متعمد عشان نعرف هل Stremio أخذ بياناتنا
        name: "القائمة السوداء — اختبارنا العربي",

        poster:
          "https://image.tmdb.org/t/p/w500/htJzeRcYI2ewMm4PTrg98UMXShe.jpg",

        description:
          "هذا وصف عربي تجريبي من إضافتنا. إذا ظهر هذا النص داخل Stremio فهذا يعني أن بيانات الـ Meta الخاصة بنا تعمل مع IMDb ID.",

        releaseInfo: "2013",
        genres: ["جريمة", "دراما", "غموض"]
      }
    ]
  };
});

builder.defineMetaHandler(async ({ type, id }) => {
  if (type !== "series" || id !== TEST_ID) {
    return { meta: null };
  }

  return {
    meta: {
      id: TEST_ID,
      type: "series",

      // مهم جدًا: لا تغير هذه العبارة أثناء الاختبار
      name: "القائمة السوداء — META من إضافتنا",

      poster:
        "https://image.tmdb.org/t/p/w500/htJzeRcYI2ewMm4PTrg98UMXShe.jpg",

      background:
        "https://image.tmdb.org/t/p/original/sCzcYW9h55WcesOqA12cgEr9Exw.jpg",

      description:
        "إذا كنت تقرأ هذا الوصف، فقد نجح الاختبار: Stremio يستخدم بيانات الـ Meta العربية التي أرسلتها إضافتنا رغم أن هوية المسلسل IMDb تبدأ بـ tt.",

      releaseInfo: "2013",
      genres: ["جريمة", "دراما", "غموض"],

      videos: [
        {
          id: `${TEST_ID}:1:1`,
          title: "الحلقة 1 — اختبار",
          season: 1,
          episode: 1,
          released: "2013-09-23T00:00:00.000Z"
        },
        {
          id: `${TEST_ID}:1:2`,
          title: "الحلقة 2 — اختبار",
          season: 1,
          episode: 2,
          released: "2013-09-30T00:00:00.000Z"
        }
      ]
    }
  };
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
