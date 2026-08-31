import type { SavedCard } from './deckStore';
import { isBasicLand } from './scryfall';

export interface DeckCardGroup {
  card: SavedCard;
  count: number;
}

// Keep the user's insertion order, collapse duplicate print records, and move
// basic lands behind every spell and nonbasic land.
export function groupDeckCards(cards: SavedCard[]): DeckCardGroup[] {
  const groups = new Map<string, DeckCardGroup>();

  for (const card of cards) {
    const existing = groups.get(card.oracleId);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(card.oracleId, { card, count: 1 });
    }
  }

  return [...groups.values()].sort(
    (a, b) => Number(isBasicLand(a.card)) - Number(isBasicLand(b.card)),
  );
}
