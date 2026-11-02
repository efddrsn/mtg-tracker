import { it, expect, vi } from "vitest";
import {
  createRecommanderClient,
  PUBLIC_RECOMMANDER_URL,
} from "./recommander-api.mjs";
const result = {
  result_code: "success",
  data: {
    recommendations: [{ oracle_id: "id", name: "Synergy", score: 1.25 }],
  },
  error: null,
};
it("uses the official endpoint and unwraps its envelope without rescaling scores", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(result)));
  const recommend = createRecommanderClient({ fetchImpl });
  expect(await recommend({ commander: "urza", deck: [] })).toEqual({
    source: "model",
    recommendations: result.data.recommendations,
  });
  expect(fetchImpl.mock.calls[0][0]).toBe(PUBLIC_RECOMMANDER_URL);
});
it("deduplicates concurrent requests and caches identical deck queries", async () => {
  const fetchImpl = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(result)));
  const recommend = createRecommanderClient({ fetchImpl });
  const query = { commander: "urza", deck: [] };
  await Promise.all([recommend(query), recommend(query)]);
  await recommend(query);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  await recommend({ ...query, deck: ["new-pick"] });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});
it("does not cache rate-limit errors or scrape pages when the public API rejects a request", async () => {
  const fetchImpl = vi
    .fn()
    .mockResolvedValue(
      new Response("<html>Rate limited</html>", {
        status: 429,
        headers: { "retry-after": "60" },
      }),
    );
  const recommend = createRecommanderClient({ fetchImpl });
  await expect(recommend({})).rejects.toMatchObject({
    status: 429,
    retryAfter: "60",
  });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});
it("rejects undocumented/HTML responses instead of silently treating them as empty recommendations", async () => {
  const recommend = createRecommanderClient({
    fetchImpl: async () => new Response("<!DOCTYPE html>"),
  });
  await expect(recommend({})).rejects.toThrow("non-JSON");
});
