const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const builder = new addonBuilder({
  id: "org.khalid.hybrid.test",
  version: "2.0.0",
  name: "اختبار Hybrid ID",
  description: "اختبار Custom Meta مع IMDb Episode IDs",
  
  resources: ["catalog", "meta"],
  types: ["series"],

  catalogs: [
    {
      type: "series",
      id: "hybrid-test",
      name: "اختبار Hybrid ID"
    }
  ],

  // الإضافة نفسها تتعامل مع الهوية الخاصة بنا
  idPrefixes: ["khalid"]
});

// هوية المسلسل داخل مكتبتنا
const CUSTOM_SERIES_ID = "khalid:blacklist";

// هوية IMDb الحقيقية
const IMDB_ID = "tt2741602";

builder.defineCatalogHandler(async ({ type, id }) => {
  if (type !== "series" || id !== "hybrid-test") {
    return { metas: [] };
  }

  return {
    metas: [
      {
        id: CUSTOM_SERIES_ID,
        type: "series",

        name: "القائمة السوداء — اختبار Hybrid",

        poster:
          "https://image.tmdb.org/t/p/w500/htJzeRcYI2ewMm4PTrg98UMXShe.jpg",

        description:
          "هذه بيانات تجريبية من إضافتنا لاختبار السيطرة على البيانات العربية."
      }
    ]
  };
});

builder.defineMetaHandler(async ({ type, id }) => {
  if (type !== "series" || id !== CUSTOM_SERIES_ID) {
    return { meta: null };
  }

  return {
    meta: {
      id: CUSTOM_SERIES_ID,
      type: "series",

      name: "القائمة السوداء — META عربي من إضافتنا",

      poster:
        "https://image.tmdb.org/t/p/w500/htJzeRcYI2ewMm4PTrg98UMXShe.jpg",

      background:
        "https://image.tmdb.org/t/p/original/sCzcYW9h55WcesOqA12cgEr9Exw.jpg",

      description:
        "إذا ظهر هذا الوصف، فهذا يؤكد أن Stremio يستخدم بيانات الـ Meta الخاصة بمكتبتنا وليس Cinemeta.",

      releaseInfo: "2013",

      genres: [
        "جريمة",
        "دراما",
        "غموض"
      ],

      videos: [
        {
          // مهم جدًا للاختبار:
          // Meta للمسلسل Custom
          // لكن الحلقة تحمل IMDb ID
          id: `${IMDB_ID}:1:1`,
          title: "الحلقة 1 — اختبار Hybrid",
          season: 1,
          episode: 1,
          released: "2013-09-23T00:00:00.000Z"
        },

        {
          id: `${IMDB_ID}:1:2`,
          title: "الحلقة 2 — اختبار Hybrid",
          season: 1,
          episode: 2,
          released: "2013-09-30T00:00:00.000Z"
        },

        // وضعت حلقة الموسم الثالث عمدًا
        // لأن صورتك السابقة أثبتت أن Torrentio RD
        // تعرف على S03E09
        {
          id: `${IMDB_ID}:3:9`,
          title: "الحلقة 9 — اختبار التشغيل",
          season: 3,
          episode: 9,
          released: "2016-01-21T00:00:00.000Z"
        }
      ]
    }
  };
});

serveHTTP(builder.getInterface(), {
  port: process.env.PORT || 7000
});
