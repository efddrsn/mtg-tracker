import { describe, expect, it } from "vitest";
import { parseCommanderTopPicks } from "./recommander-page.mjs";

describe("Recommander commander-page parser", () => {
  it("preserves global order and removes category duplicates", () => {
    const row = (id, name, score, count) =>
      `<li data-rep="print" data-sf="set/1/card" data-score="${score}" data-count="${count}" data-pop="100"><a href="/card/${id}">${name}</a></li>`;
    const html = [
      row("11111111-1111-1111-1111-111111111111", "Rain of Riches", 0.63, 70),
      row(
        "22222222-2222-2222-2222-222222222222",
        "Dragon&#39;s Hoard",
        0.61,
        60,
      ),
      row("11111111-1111-1111-1111-111111111111", "Rain of Riches", 0.63, 70),
    ].join("");

    expect(parseCommanderTopPicks(html)).toEqual([
      expect.objectContaining({
        name: "Rain of Riches",
        score: 0.63,
        commander_count: 70,
      }),
      expect.objectContaining({
        name: "Dragon's Hoard",
        score: 0.61,
        commander_count: 60,
      }),
    ]);
  });
});

it("reads the current dedicated Astro Top Picks section instead of category order", () => {
  const id = "11111111-1111-1111-1111-111111111111";
  const html = `<section data-stats-view="lands"><a href="/card/22222222-2222-2222-2222-222222222222" aria-label="Generic land"></a></section><section data-stats-view="top" aria-label="Top Picks" hidden><a class="magic-card-link" href="/card/${id}" aria-label="Distinctive synergy"></a><a href="/card/${id}" aria-label="Distinctive synergy"></a></section>`;
  const picks = parseCommanderTopPicks(html);
  expect(picks).toHaveLength(1);
  expect(picks[0]).toMatchObject({
    name: "Distinctive synergy",
    score_kind: "ordinal",
    source: "commander-top-picks",
    rank: 0,
  });
});
it("ranks the entire legacy pool before applying the limit", () => {
  const row = (id, score) =>
    `<li data-rep="p" data-sf="x" data-score="${score}" data-count="100" data-pop="100"><a href="/card/${id}">${id}</a></li>`;
  expect(
    parseCommanderTopPicks(row("land", 0.1) + row("synergy", 0.9), 1)[0].name,
  ).toBe("synergy");
});
