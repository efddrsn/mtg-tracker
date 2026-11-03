import type { DeckCard } from "./scryfall";
import type { HubCard, HubDeck, SwiperPileDefinition } from "./hubStore";

export const RADIAL_GAP = 35;
export const DEFAULT_PILES: SwiperPileDefinition[] = [
  { id: "deck", name: "Main", tag: "main", angle: 45, visible: true, linkedGroup: "sections", updatedAt: 0 },
  { id: "sideboard", name: "Sideboard", tag: "sideboard", angle: 90, visible: true, linkedGroup: "sections", updatedAt: 0 },
  { id: "maybe", name: "Maybe", tag: "maybe", angle: 135, visible: true, linkedGroup: "sections", updatedAt: 0 },
  { id: "wishlist", name: "Wishlist", tag: "wishlist", angle: 315, visible: true, linkedGroup: "interest", updatedAt: 0 },
  { id: "owned", name: "Tenho", tag: "collection", angle: 270, visible: true, linkedGroup: "interest", updatedAt: 0 },
  { id: "none", name: "Nenhum", tag: "none", angle: 225, visible: false, linkedGroup: "interest", updatedAt: 0 },
];

const samePrinting = (a: { oracleId?: string; name: string; setCode?: string; collectorNumber?: string },
  b: { oracleId?: string; name: string; setCode?: string; collectorNumber?: string }) =>
  (a.oracleId && b.oracleId ? a.oracleId === b.oracleId : a.name.toLowerCase() === b.name.toLowerCase())
  && a.setCode === b.setCode && a.collectorNumber === b.collectorNumber;

export function pileAngle(value: number): number {
  return ((Math.round(value / 5) * 5 % 360) + 360) % 360;
}

export function angularDistance(a: number, b: number) {
  const delta = Math.abs(pileAngle(a) - pileAngle(b));
  return Math.min(delta, 360 - delta);
}

export function normalizePiles(stored?: SwiperPileDefinition[]): SwiperPileDefinition[] {
  const seen = new Set<string>();
  const supplied = Array.isArray(stored) ? stored.filter(p =>
    p && typeof p.id === "string" && typeof p.name === "string") : [];
  const result: SwiperPileDefinition[] = [];
  for (const original of [...supplied, ...DEFAULT_PILES]) {
    if (seen.has(original.id)) continue;
    seen.add(original.id);
    const base = DEFAULT_PILES.find(p => p.id === original.id);
    result.push({
      ...base, ...original,
      name: original.name.trim().slice(0, 48) || base?.name || "Pilha",
      tag: (original.tag || base?.tag || "").trim().toLowerCase().slice(0, 48),
      angle: pileAngle(Number.isFinite(original.angle) ? original.angle : base?.angle ?? 0),
      visible: original.visible !== false,
      updatedAt: original.updatedAt || 0,
      cards: base && original.id !== "none" ? undefined : original.cards || [],
    });
  }
  // Existing layouts get to keep their latest chosen visible position.
  return resolveVisibility(result);
}

/** Conflicts are hidden, never deleted; newest positioned pile wins. */
export function resolveVisibility(piles: SwiperPileDefinition[]): SwiperPileDefinition[] {
  const visible = [...piles].filter(p => p.visible && !p.deleted)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const accepted: SwiperPileDefinition[] = [];
  for (const pile of visible) {
    if (accepted.every(p => angularDistance(p.angle, pile.angle) >= RADIAL_GAP)) accepted.push(pile);
  }
  const ids = new Set(accepted.map(p => p.id));
  return piles.map(p => ({ ...p, visible: p.visible && !p.deleted && ids.has(p.id) }));
}

/** Display all linked piles by default, moving the most recently edited member
 * into view and hiding any colliding positions instead of duplicating slots. */
export function changePile(piles: SwiperPileDefinition[], id: string,
  changes: Partial<SwiperPileDefinition>): SwiperPileDefinition[] {
  const target = piles.find(p => p.id === id);
  if (!target) return piles;
  const group = changes.visible === true
    ? (changes.linkedGroup ?? target.linkedGroup) : changes.linkedGroup || undefined;
  const now = Date.now();
  const changed = piles.map(p => {
    if (p.id === id) return {
      ...p, ...changes, id,
      angle: pileAngle(changes.angle ?? p.angle),
      cards: changes.deleted ? (p.cards ? [] : undefined) : p.cards,
      updatedAt: now,
    };
    if (group && p.linkedGroup === group) return { ...p, visible: true };
    return p;
  });
  return resolveVisibility(changed);
}

export function addPile(piles: SwiperPileDefinition[], options: {
  name: string; tag?: string; angle: number; linkedGroup?: string;
}): SwiperPileDefinition[] {
  const id = crypto.randomUUID();
  return changePile([...piles, {
    id, name: options.name.trim().slice(0, 48) || "Nova pilha",
    tag: (options.tag || options.name).toLowerCase().trim().slice(0, 48),
    angle: pileAngle(options.angle),
    visible: false, linkedGroup: options.linkedGroup?.trim() || undefined,
    cards: [], updatedAt: Date.now(),
  }], id, { visible: true });
}

export function assignCustomPile(piles: SwiperPileDefinition[], id: string,
  card: HubCard): SwiperPileDefinition[] {
  const target = piles.find(p => p.id === id);
  if (!target) return piles;
  return piles.map(p => {
    if (!p.cards) return p;
    if (p.id === id) return {
      ...p, cards: p.cards.some(c => samePrinting(c, card))
        ? p.cards : [card, ...p.cards], updatedAt: Date.now(),
    };
    if (target.linkedGroup && p.linkedGroup === target.linkedGroup) return {
      ...p, cards: p.cards.filter(c => !samePrinting(c, card)),
    };
    return p;
  });
}

export function removeCustomCard(piles: SwiperPileDefinition[], id: string, card: HubCard) {
  return piles.map(p => p.id === id && p.cards
    ? { ...p, cards: p.cards.filter(c => !samePrinting(c, card)) } : p);
}

export function aggregateTaggedCards(decks: HubDeck[], tag: string): HubCard[] {
  const unique = new Map<string, HubCard>();
  for (const d of decks.filter(d => !d.deletedAt)) {
    const piles = normalizePiles(d.swiper?.piles);
    for (const pile of piles.filter(p => !p.deleted && p.tag === tag.toLowerCase())) {
      const cards = pile.cards || (pile.id === "deck"
        ? d.cards.filter(c => ["main", "commander"].includes(c.section))
        : pile.id === "sideboard" ? d.cards.filter(c => c.section === "sideboard")
        : pile.id === "maybe" ? d.cards.filter(c => c.section === "maybe")
        : pile.id === "wishlist" ? d.swiper?.wishlist || []
        : pile.id === "owned" ? d.swiper?.owned || [] : []);
      for (const c of cards) {
        const key = c.oracleId || c.name.toLowerCase();
        if (!unique.has(key)) unique.set(key, c);
      }
    }
  }
  return [...unique.values()];
}

export function isRightSide(angle: number): boolean {
  const a = pileAngle(angle);
  return a > 0 && a < 180;
}

export function findRadialTarget(piles: SwiperPileDefinition[], x: number, y: number) {
  if (Math.hypot(x, y) < 18) return null;
  // Fixed discard sector to the left and down-left of the card.
  if (x < -18 && (y >= -25 || y > Math.abs(x) * .3)) return "reject";
  const angle = pileAngle(Math.atan2(x, -y) * 180 / Math.PI);
  const candidates = piles.filter(p => p.visible && !p.deleted)
    .map(p => ({ p, delta: angularDistance(p.angle, angle) }))
    .sort((a, b) => a.delta - b.delta);
  return candidates[0] && candidates[0].delta <= 28 ? candidates[0].p.id : null;
}

export function fromRecommendationCard(card: DeckCard): HubCard {
  return {
    name: card.name, oracleId: card.oracleId,
    setCode: card.setCode, collectorNumber: card.collectorNumber,
    image: card.image || undefined, details: card,
    quantity: 1, section: "main",
  };
}
