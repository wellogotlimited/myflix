const tidbApiKey = process.env.TIDB_API_KEY?.trim();

const probes = [
  {
    name: "Deployed /api/segments",
    url: "http://34.18.79.108/api/segments?tmdbId=79744&season=6&episode=5&imdbId=tt7587890",
    options: {
      headers: {
        accept: "application/json",
      },
      method: "GET",
    },
  },
  {
    name: "TheIntroDB browser-like",
    url: "https://api.theintrodb.org/v2/media?tmdb_id=79744&season=6&episode=5",
    options: {
      headers: {
        accept: "*/*",
        "accept-language": "en-US,en;q=0.9,uz-UZ;q=0.8,uz;q=0.7,fa-AF;q=0.6,fa;q=0.5",
        authorization: "undefined",
        priority: "u=1, i",
        "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "cross-site",
      },
      method: "GET",
      mode: "cors",
      credentials: "include",
    },
  },
  {
    name: "TheIntroDB route-like",
    url: "https://api.theintrodb.org/v2/media?tmdb_id=79744&season=6&episode=5",
    options: {
      headers: {
        accept: "application/json, text/plain;q=0.9, */*;q=0.1",
        "user-agent": "myflix/segments-fetch",
        ...(tidbApiKey ? { authorization: `Bearer ${tidbApiKey}` } : {}),
      },
      method: "GET",
    },
  },
  {
    name: "IntroDB fallback imdb_id",
    url: "https://api.introdb.app/intro?imdb_id=tt7587890&season=6&episode=5",
    options: {
      headers: {
        accept: "application/json, text/plain;q=0.9, */*;q=0.1",
        "user-agent": "myflix/segments-fetch",
      },
      method: "GET",
    },
  },
  {
    name: "IntroDB fallback imdb",
    url: "https://api.introdb.app/intro?imdb=tt7587890&season=6&episode=5",
    options: {
      headers: {
        accept: "application/json, text/plain;q=0.9, */*;q=0.1",
        "user-agent": "myflix/segments-fetch",
      },
      method: "GET",
    },
  },
];

for (const probe of probes) {
  console.log(`\n=== ${probe.name} ===`);
  console.log(probe.url);
  console.log("using api key:", Boolean(tidbApiKey));

  const response = await fetch(probe.url, probe.options);
  const text = await response.text();

  console.log("status:", response.status);
  console.log("content-type:", response.headers.get("content-type"));

  try {
    console.dir(JSON.parse(text), { depth: null });
  } catch {
    console.log(text);
  }
}
