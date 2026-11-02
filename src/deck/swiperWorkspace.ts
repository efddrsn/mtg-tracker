import { DEFAULT_CONFIG, type DeckFormat } from "./scryfall";
import { useDeckStore, type DeckState, type SavedCard } from "./deckStore";
import { fromCards, makeDeck, toCard, useHubStore, type HubDeck, type HubCard, type SwipeCorner, type SwipePile, type SwipeSession } from "./hubStore";

export const DEFAULT_CORNERS: Record<SwipeCorner, SwipePile> = {
  nw: "maybe", ne: "deck", sw: "sideboard", se: "sideboard",
};

/** Three visible destinations: Main, Sideboard, Maybe. The lower-left corner
 * is reserved for discard, and old Wishlist/Owned corners are reset without
 * deleting the cards they held in legacy storage. */
export function normalizedDestinations(saved?: Partial<Record<SwipeCorner, SwipePile>>): Record<SwipeCorner, SwipePile> {
  const slots: Array<"nw" | "ne" | "se"> = ["nw", "ne", "se"];
  const allowed: SwipePile[] = ["deck", "sideboard", "maybe"];
  const result: Record<SwipeCorner, SwipePile> = { ...DEFAULT_CORNERS };
  const used = new Set<SwipePile>();
  for (const slot of slots) {
    const choice = saved?.[slot];
    if (choice && allowed.includes(choice) && !used.has(choice)) {
      result[slot] = choice;
      used.add(choice);
    }
  }
  for (const slot of slots) {
    if (used.has(result[slot])) continue;
    const choice = allowed.find(p => !used.has(p))!;
    result[slot] = choice;
    used.add(choice);
  }
  return result;
}

const FORMAT_TO_CODE: Record<string, DeckFormat> = {
  Commander: "commander", Modern: "modern", Standard: "standard",
  Historic: "historic", Brawl: "standardbrawl", Pioneer: "pioneer",
  Pauper: "pauper", Legacy: "legacy",
};

export function swipeSessionFor(deck: HubDeck): SwipeSession {
  const stored = deck.swiper;
  const blank = {
    ...DEFAULT_CONFIG,
    format: FORMAT_TO_CODE[deck.format] || "commander",
  };
  const config = stored?.config
    ? { ...blank, ...stored.config }
    : blank;
  return {
    deck: stored?.deck || [],
    sideboard: stored?.sideboard || [],
    wishlist: stored?.wishlist || [],
    owned: stored?.owned || [],
    maybe: stored?.maybe || [],
    rejected: stored?.rejected || [],
    swipeCount: stored?.swipeCount || 0,
    revisions: stored?.revisions || [],
    config,
    source: stored?.source === "wishlist" || stored?.source === "owned"
      ? "recommendations" : stored?.source || "recommendations",
    reviewIndex: stored?.source === "wishlist" || stored?.source === "owned"
      ? 0 : stored?.reviewIndex || 0,
    corners: normalizedDestinations(stored?.corners),
  };
}

export function hydratedDeckState(deck: HubDeck) {
  const session = swipeSessionFor(deck);
  const mainCards = deck.cards.filter(c => c.section === "main" || c.section === "commander");
  const selectedCommander = mainCards.find(c => c.section === "commander");
  const commander = selectedCommander
    ? { ...toCard(selectedCommander), addedAt: Date.now(), quantity: selectedCommander.quantity }
    : null;
  const asSaved = (items: HubCard[]): SavedCard[] => items.map(c => ({
    ...toCard(c), addedAt: Date.now(), quantity: c.quantity,
  }));
  const loadedDeck = asSaved(mainCards);
  const loadedSide = asSaved(deck.cards.filter(c => c.section === "sideboard"));
  const loadedMaybe = asSaved(deck.cards.filter(c => c.section === "maybe"));
  const sideboard = loadedSide.length ? loadedSide : asSaved(session.sideboard || []);
  const maybe = loadedMaybe.length ? loadedMaybe : asSaved(session.maybe);
  const wishlist = asSaved(session.wishlist);
  const owned = asSaved(session.owned);
  const rejected = [...new Set([
    ...session.rejected, ...loadedDeck.map(c => c.oracleId),
    ...sideboard.map(c => c.oracleId), ...maybe.map(c => c.oracleId),
    ...wishlist.map(c => c.oracleId), ...owned.map(c => c.oracleId),
  ])].slice(0, 4000);
  return {
    deck: loadedDeck,
    sideboard,
    wishlist,
    maybe,
    owned,
    commander,
    rejected,
    swipeCount: session.swipeCount,
    revisions: session.revisions || [],
    config: {
      ...session.config,
      ...(commander
        ? { format: "commander" as DeckFormat, colors: commander.colorIdentity, colorRule: "within" as const }
        : {}),
    },
  };
}

export function loadSwiperDeck(deck: HubDeck) {
  const current = useDeckStore.getState();
  useDeckStore.setState({
    ...hydratedDeckState(deck),
    configVersion: current.configVersion + 1,
  });
  useHubStore.getState().setActive(deck.id);
}

function sameCard(a: { name: string; oracleId?: string }, b: { name: string; oracleId?: string }) {
  return !!(a.oracleId && b.oracleId && a.oracleId === b.oracleId)
    || a.name.toLowerCase() === b.name.toLowerCase();
}

function sameSelectedPrinting(a: { name: string; oracleId?: string; setCode?: string; collectorNumber?: string }, b: { name: string; oracleId?: string; setCode?: string; collectorNumber?: string }) {
  return sameCard(a, b) && a.setCode === b.setCode && a.collectorNumber === b.collectorNumber;
}

export function updatedSwiperDeck(deck: HubDeck, state: DeckState): HubDeck {
  const asHubCards = (items: SavedCard[], section: HubCard["section"]) =>
    items.map(c => {
      const previous = deck.cards.find(old =>
        old.section === section && sameSelectedPrinting(old, c));
      return {
        ...previous,
        ...fromCards([c])[0],
        quantity: c.quantity || previous?.quantity || 1,
        section,
      };
    });
  const main = state.deck.map(c => {
    const section: HubCard["section"] = state.commander && sameSelectedPrinting(c, state.commander)
      ? "commander" : "main";
    const previous = deck.cards.find(old =>
      (old.section === "main" || old.section === "commander") && sameSelectedPrinting(old,c));
    return {
      ...previous, ...fromCards([c])[0],
      quantity: c.quantity || previous?.quantity || 1, section,
    };
  });
  // Sections are independent. Moving a card into Side or Maybe updates the
  // canonical deck list as well as its per-workspace Swiper session.
  const cards = [
    ...main,
    ...asHubCards(state.sideboard, "sideboard"),
    ...asHubCards(state.maybe, "maybe"),
  ];
  const base = swipeSessionFor(deck);
  const swiper: SwipeSession = {
    ...base,
    config: state.config,
    deck: fromCards(state.deck),
    sideboard: asHubCards(state.sideboard, "sideboard"),
    wishlist: fromCards(state.wishlist),
    maybe: asHubCards(state.maybe, "maybe"),
    owned: fromCards(state.owned),
    rejected: state.rejected.slice(0, 4000),
    swipeCount: state.swipeCount,
    revisions: state.revisions.slice(0, 12),
  };
  return {
    ...deck, cards, swiper,
    updatedAt: Math.max(Date.now(), deck.updatedAt + 1),
  };
}

export function persistSwiperDeck(deckId: string) {
  const hub = useHubStore.getState();
  const deck = hub.decks.find(d => d.id === deckId && !d.deletedAt);
  if (!deck) return;
  hub.save(updatedSwiperDeck(deck, useDeckStore.getState()));
}

export function configureSwiperDeck(deckId: string, patch: Partial<Pick<SwipeSession, "corners" | "source" | "reviewIndex">>) {
  const hub = useHubStore.getState();
  const deck = hub.decks.find(d => d.id === deckId && !d.deletedAt);
  if (!deck) return;
  hub.save({
    ...deck,
    swiper: { ...swipeSessionFor(deck), ...patch },
    updatedAt: Math.max(Date.now(), deck.updatedAt + 1),
  });
}

/** A new visitor receives an actual editable list rather than a hidden global workspace. */
export function ensureSwiperWorkspace() {
  const hub = useHubStore.getState();
  const active = hub.decks.find(d => d.id === hub.activeDeckId && !d.deletedAt);
  const original = useDeckStore.getState();
  if (active) {
    // The former global Swiper belonged to the last active deck. Keep its
    // historic wishlist/owned and revision snapshots instead of overwriting
    // them on the first deck-scoped visit.
    if (!active.swiper && !hub.decks.some(d => !!d.swiper) &&
        (original.wishlist.length || original.owned.length || original.maybe.length)) {
      const migrated: HubDeck = {
        ...active,
        swiper: {
          ...swipeSessionFor(active),
          wishlist: fromCards(original.wishlist),
          owned: fromCards(original.owned),
          maybe: fromCards(original.maybe),
          rejected: [...original.rejected],
          revisions: original.revisions,
          swipeCount: original.swipeCount,
          config: original.config,
        },
        updatedAt: Math.max(Date.now(), active.updatedAt + 1),
      };
      hub.save(migrated);
      return migrated;
    }
    return active;
  }
  // Existing users land in a real recent deck, not an empty global feed.
  // If old global lists still contain cards, preserve them in a separate
  // named workspace rather than attributing them to an unrelated deck.
  const legacyContent = original.wishlist.length || original.owned.length || original.maybe.length;
  if (!legacyContent) {
    const recent = hub.decks.filter(d => !d.deletedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (recent) {
      hub.setActive(recent.id);
      return recent;
    }
  }
  // Preserve the original global Wishlist / Owned on the first transition.
  const list = makeDeck("Minhas descobertas", fromCards(original.wishlist || []), "wishlist");
  list.swiper = {
    ...swipeSessionFor(list),
    wishlist: fromCards(original.wishlist || []),
    owned: fromCards(original.owned || []),
    maybe: fromCards(original.maybe || []),
    rejected: [...original.rejected],
    swipeCount: original.swipeCount,
    revisions: original.revisions,
    config: original.config,
  };
  hub.save(list);
  hub.setActive(list.id);
  return list;
}

/** Save before changing workspaces to avoid cross-deck state contamination. */
export function switchSwiperDeck(next: HubDeck) {
  const activeId = useHubStore.getState().activeDeckId;
  if (activeId && activeId !== next.id) persistSwiperDeck(activeId);
  loadSwiperDeck(next);
}
