export const PUBLIC_RECOMMANDER_URL =
  "https://api.recommander.cards/public-release/api/decks/recommend/top";

// https://recommander.cards/api/ documents this public release. The website's
// own /api/decks/recommend route is not the third-party integration API.
export function createRecommanderClient({
  fetchImpl = fetch,
  endpoint = process.env.RECOMMANDER_UPSTREAM || PUBLIC_RECOMMANDER_URL,
  ttl = 600_000,
} = {}) {
  const cache = new Map();
  const inflight = new Map();
  return async function recommend(query) {
    const key = JSON.stringify(query);
    const cached = cache.get(key);
    if (cached && cached.until > Date.now()) return cached.value;
    if (inflight.has(key)) return inflight.get(key);
    const job = (async () => {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: key,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        const error = new Error(`Recommander HTTP ${response.status}`);
        error.status = response.status;
        error.retryAfter = response.headers.get("retry-after");
        throw error;
      }
      let envelope;
      try {
        envelope = await response.json();
      } catch {
        throw new Error("Recommander returned non-JSON data.");
      }
      const recommendations =
        envelope.result_code === "success"
          ? envelope.data?.recommendations
          : null;
      if (!Array.isArray(recommendations))
        throw new Error("Unexpected public API response.");
      const value = {
        recommendations: recommendations.filter(
          (c) =>
            typeof c.oracle_id === "string" &&
            typeof c.name === "string" &&
            Number.isFinite(c.score),
        ),
        source: "model",
      };
      if (cache.size >= 200) cache.delete(cache.keys().next().value);
      cache.set(key, { value, until: Date.now() + ttl });
      return value;
    })();
    inflight.set(key, job);
    try {
      return await job;
    } finally {
      inflight.delete(key);
    }
  };
}
