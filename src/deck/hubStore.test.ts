import { describe, it, expect, beforeEach } from "vitest";
import {
  parseHubList,
  listText,
  useHubStore,
  makeDeck,
  validDeck,
} from "./hubStore";
describe("deck imports preserve the actual list", () => {
  it("retains quantities, printings, sections and double faced names through export", () => {
    const text =
      "Commander\n1 Urza, Lord High Artificer (MH1) 75\n\nDeck\n33 Island (ELD) 254\n2 Sol Ring\n1 Sol Ring\n1 Delver of Secrets // Insectile Aberration\n\nSideboard\n2 Negate";
    const cards = parseHubList(text);
    expect(cards[0].section).toBe("commander");
    expect(cards[1].quantity).toBe(33);
    expect(cards[2].quantity).toBe(3);
    expect(cards[3].name).toContain("//");
    expect(cards[4].section).toBe("sideboard");
    expect(parseHubList(listText(cards))).toEqual(cards);
  });
  it("keeps different printings separate and accepts Liga tags", () => {
    const cards = parseHubList(
      "1x Sol Ring (CMM) 396\n2 Sol Ring (C21) 263\n1 Island [QUALIDADE=NM][EDICAO=ELD][EXTRAS=Foil]",
    );
    expect(cards).toHaveLength(3);
    expect(cards[1].quantity).toBe(2);
    expect(cards[2].name).toBe("Island");
  });
  it("rejects invalid quantities and over-sized lists without silent truncation", () => {
    expect(() => parseHubList("0 Island")).toThrow();
    expect(() => parseHubList("1000 Island")).toThrow();
    expect(() =>
      parseHubList(
        Array.from({ length: 251 }, (_, i) => "1 Card " + i).join("\n"),
      ),
    ).toThrow();
  });
});
describe("workspace sync and recovery", () => {
  beforeEach(() => useHubStore.setState({ decks: [] }));
  it("uses the newest edit including deletion tombstones", () => {
    const d = { ...makeDeck("A"), id: "same", updatedAt: 100 };
    useHubStore.getState().save(d);
    useHubStore.getState().merge([
      { ...d, title: "New", updatedAt: 200 },
      { ...d, title: "Old", updatedAt: 50 },
    ]);
    expect(useHubStore.getState().decks[0].title).toBe("New");
    useHubStore.getState().merge([{ ...d, deletedAt: 300, updatedAt: 300 }]);
    useHubStore.getState().merge([{ ...d, updatedAt: 250 }]);
    expect(useHubStore.getState().decks[0].deletedAt).toBe(300);
  });
  it("rejects malformed backups", () => {
    expect(
      validDeck({
        id: "x",
        title: "x",
        updatedAt: 1,
        cards: [{ name: "x", quantity: -1, section: "main" }],
      }),
    ).toBe(false);
  });
});

it("normalizes Binder input into repeated unprefixed printing lines", async () => {
  const { binderText } = await import("./hubStore");
  expect(
    binderText(
      parseHubList("Commander\n1 Urza (MH1) 75\n\nDeck\n2 Island (ELD) 254"),
    ),
  ).toBe("Urza (MH1) 75\nIsland (ELD) 254\nIsland (ELD) 254");
});
