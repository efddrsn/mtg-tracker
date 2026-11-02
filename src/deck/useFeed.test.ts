import { it, expect } from "vitest";
import { rankPool } from "./useFeed";
import { toCard } from "./hubStore";
it("keeps real model scores ahead of ordinal page ranks and popularity fallback", () => {
  const base = toCard({ name: "Card", quantity: 1, section: "main" });
  const queue = [
    { ...base, name: "Generic", seq: 0 },
    {
      ...base,
      name: "Page rank",
      seq: 2,
      recommendationScore: 1,
      recommendationSource: "commander-top-picks" as const,
    },
    {
      ...base,
      name: "Model synergy",
      seq: 3,
      recommendationScore: 0.2,
      recommendationSource: "model" as const,
    },
  ];
  expect(rankPool(queue, false).map((c) => c.name)).toEqual([
    "Model synergy",
    "Page rank",
    "Generic",
  ]);
  expect(rankPool(queue, true)[0].name).toBe("Generic");
});
