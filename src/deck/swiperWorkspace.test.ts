import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "./scryfall";
import { useHubStore, makeDeck, toCard } from "./hubStore";
import { useDeckStore } from "./deckStore";
import {
  ensureSwiperWorkspace, loadSwiperDeck, persistSwiperDeck,
  switchSwiperDeck, configureSwiperDeck, swipeSessionFor,
} from "./swiperWorkspace";

const entry = (name: string, quantity = 1) => ({
  name, quantity, section: "main" as const, oracleId: name,
  setCode: "cmm", collectorNumber: "42",
});
beforeEach(() => {
  useHubStore.setState({ decks: [], activeDeckId: null, nickname: "" });
  useDeckStore.setState({
    config: { ...DEFAULT_CONFIG }, deck: [], wishlist: [],
    maybe: [], owned: [], rejected: [], revisions: [],
    commander: null, swipeCount: 0, configVersion: 0,
  });
});

describe("deck-scoped Swiper workspace", () => {
  it("saves and resumes each deck without cross-contamination or loss of quantities", () => {
    const a = makeDeck("Urza", [entry("Sol Ring", 2)]);
    const b = makeDeck("Meren", [entry("Forest", 33)]);
    useHubStore.getState().save(a);
    useHubStore.getState().save(b);
    loadSwiperDeck(a);
    useDeckStore.getState().moveCard(toCard(entry("Arcane Signet")), "recommendations", "wishlist");
    useDeckStore.getState().moveCard(toCard(entry("Mana Leak")), "recommendations", "maybe");
    configureSwiperDeck(a.id, { source: "maybe", reviewIndex: 1,
      corners: { nw: "owned", ne: "wishlist", sw: "deck", se: "maybe" } });
    persistSwiperDeck(a.id);
    switchSwiperDeck(b);
    expect(useDeckStore.getState().deck.map(c => c.name)).toEqual(["Forest"]);
    expect(useDeckStore.getState().wishlist).toHaveLength(0);
    useDeckStore.getState().moveCard(toCard(entry("Eternal Witness")), "recommendations", "deck");
    persistSwiperDeck(b.id);
    switchSwiperDeck(useHubStore.getState().decks.find(d => d.id === a.id)!);
    expect(useDeckStore.getState().deck[0].quantity).toBe(2);
    expect(useDeckStore.getState().wishlist.map(c => c.name)).toEqual(["Arcane Signet"]);
    expect(useDeckStore.getState().maybe.map(c => c.name)).toEqual(["Mana Leak"]);
    expect(swipeSessionFor(useHubStore.getState().decks.find(d => d.id === a.id)!).source).toBe("maybe");
    expect(swipeSessionFor(useHubStore.getState().decks.find(d => d.id === a.id)!).corners.se).toBe("maybe");
    expect(useHubStore.getState().decks.find(d => d.id === b.id)!.cards.some(c => c.name === "Eternal Witness")).toBe(true);
  });

  it("migrates the global Wishlist once, retaining legacy owned cards", () => {
    useDeckStore.setState({
      wishlist: [{ ...toCard(entry("Sol Ring")), addedAt: 1 }],
      owned: [{ ...toCard(entry("Island")), addedAt: 2 }],
    });
    const created = ensureSwiperWorkspace();
    expect(created.kind).toBe("wishlist");
    expect(created.cards[0].name).toBe("Sol Ring");
    expect(created.swiper?.owned[0].name).toBe("Island");
    expect(ensureSwiperWorkspace().id).toBe(created.id);
  });

  it("restores old lists to the last active deck without overwriting a different one", () => {
    const old = makeDeck("Original", [entry("Sol Ring")]);
    useHubStore.getState().save(old);
    useHubStore.getState().setActive(old.id);
    useDeckStore.setState({ wishlist: [{ ...toCard(entry("Mana Drain")), addedAt: 1 }] });
    const recovered = ensureSwiperWorkspace();
    expect(recovered.swiper?.wishlist[0].name).toBe("Mana Drain");
    expect(useHubStore.getState().decks.filter(d => d.id === old.id)).toHaveLength(1);
    expect(ensureSwiperWorkspace().swiper?.wishlist).toHaveLength(1);
  });

  it("keeps collection ownership independent when opening a standalone list", () => {
    const saved = makeDeck("Collection", [entry("Island", 40)], "collection");
    useHubStore.getState().save(saved);
    loadSwiperDeck(saved);
    expect(useDeckStore.getState().owned[0].quantity).toBe(40);
    expect(useDeckStore.getState().deck).toHaveLength(0);
    useDeckStore.getState().moveCard(toCard(entry("Sol Ring")), "recommendations", "deck");
    persistSwiperDeck(saved.id);
    loadSwiperDeck(useHubStore.getState().decks.find(d => d.id === saved.id)!);
    expect(useDeckStore.getState().deck[0].name).toBe("Sol Ring");
    expect(useDeckStore.getState().owned[0].quantity).toBe(40);
  });
});
