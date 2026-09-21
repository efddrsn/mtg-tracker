import { beforeEach, describe, expect, it } from 'vitest';
import { useDeckStore } from './deckStore';
import { DEFAULT_CONFIG, type DeckCard } from './scryfall';

function card(name: string, oracleId = name): DeckCard {
  return {
    id: `${oracleId}-printing-1`,
    oracleId,
    name,
    typeLine: 'Artifact',
    manaCost: '{1}',
    cmc: 1,
    colors: [],
    colorIdentity: [],
    rarity: 'rare',
    keywords: [],
    themes: [],
    edhrecRank: 1,
    image: 'https://example.com/card.jpg',
    backImage: null,
    priceUsd: '1.00',
    scryfallUri: 'https://scryfall.com/card',
    oracleText: '',
    games: ['paper'],
    legalities: { commander: 'legal' },
  };
}

beforeEach(() => {
  useDeckStore.setState({
    config: { ...DEFAULT_CONFIG },
    deck: [],
    owned: [],
    revisions: [],
    commander: null,
    rejected: [],
    swipeCount: 0,
    configVersion: 0,
  });
});

describe('wishlist collections', () => {
  it('moves a card between wishlist and owned without duplicates', () => {
    const solRing = card('Sol Ring');
    useDeckStore.getState().addToWishlist(solRing);
    useDeckStore.getState().addToOwned(solRing);

    expect(useDeckStore.getState().deck).toHaveLength(0);
    expect(useDeckStore.getState().owned.map((c) => c.name)).toEqual(['Sol Ring']);
    expect(useDeckStore.getState().isSeen(solRing.oracleId)).toBe(true);
  });

  it('saves and restores a versioned snapshot', () => {
    const first = card('Sol Ring');
    const second = card('Arcane Signet');
    useDeckStore.getState().addToWishlist(first);
    useDeckStore.getState().saveRevision('Inicial');
    const revision = useDeckStore.getState().revisions[0];
    useDeckStore.getState().addToWishlist(second);
    useDeckStore.getState().restoreRevision(revision.id);

    expect(useDeckStore.getState().deck.map((c) => c.name)).toEqual(['Sol Ring']);
  });

  it('updates the selected printing without changing when the card was added', () => {
    const original = card('Sol Ring', 'sol-ring');
    useDeckStore.getState().addToWishlist(original);
    const addedAt = useDeckStore.getState().deck[0].addedAt;
    const fancy = { ...original, id: 'fancy', setCode: 'sld', collectorNumber: '999' };
    useDeckStore.getState().updateCardPrinting('wishlist', original.oracleId, fancy);

    expect(useDeckStore.getState().deck[0]).toMatchObject({
      id: 'fancy',
      setCode: 'sld',
      collectorNumber: '999',
      addedAt,
    });
  });
});
