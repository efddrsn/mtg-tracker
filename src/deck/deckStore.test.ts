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
    wishlist: [],
    maybe: [],
    owned: [],
    revisions: [],
    commander: null,
    rejected: [],
    swipeCount: 0,
    configVersion: 0,
  });
});

describe('independent deck-scoped collections', () => {
  it('tracks wishlist and ownership independently of deck membership', () => {
    const solRing = card('Sol Ring');
    useDeckStore.getState().addToWishlist(solRing);
    useDeckStore.getState().addToOwned(solRing);

    expect(useDeckStore.getState().deck).toHaveLength(0);
    expect(useDeckStore.getState().wishlist.map((c) => c.name)).toEqual(['Sol Ring']);
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

    expect(useDeckStore.getState().wishlist.map((c) => c.name)).toEqual(['Sol Ring']);
  });

  it('updates the selected printing without changing when the card was added', () => {
    const original = card('Sol Ring', 'sol-ring');
    useDeckStore.getState().addToWishlist(original);
    const addedAt = useDeckStore.getState().wishlist[0].addedAt;
    const fancy = { ...original, id: 'fancy', setCode: 'sld', collectorNumber: '999' };
    useDeckStore.getState().updateCardPrinting('wishlist', original.oracleId, fancy);

    expect(useDeckStore.getState().wishlist[0]).toMatchObject({
      id: 'fancy',
      setCode: 'sld',
      collectorNumber: '999',
      addedAt,
    });
  });
});

describe('pile table decisions', () => {
  it('moves a card from maybe to the deck without marking it owned', () => {
    const spell = card('Arcane Signet');
    useDeckStore.getState().addToMaybe(spell);
    useDeckStore.getState().moveCard(spell, 'maybe', 'deck');
    expect(useDeckStore.getState().maybe).toHaveLength(0);
    expect(useDeckStore.getState().deck.map(c => c.name)).toEqual(['Arcane Signet']);
    expect(useDeckStore.getState().owned).toHaveLength(0);
  });

  it('copies an owned card into a deck without losing ownership', () => {
    const spell = card('Sol Ring');
    useDeckStore.getState().addToOwned(spell);
    useDeckStore.getState().moveCard(spell, 'owned', 'deck');
    expect(useDeckStore.getState().deck).toHaveLength(1);
    expect(useDeckStore.getState().owned).toHaveLength(1);
  });

  it('records deck, maybe, wishlist and owned in a restorable revision', () => {
    const spell = card('Counterspell');
    useDeckStore.getState().addToDeck(spell);
    useDeckStore.getState().addToMaybe(card('Mana Leak'));
    useDeckStore.getState().saveRevision('Antes');
    useDeckStore.getState().clearList('deck');
    useDeckStore.getState().clearList('maybe');
    useDeckStore.getState().restoreRevision(useDeckStore.getState().revisions[0].id);
    expect(useDeckStore.getState().deck).toHaveLength(1);
    expect(useDeckStore.getState().maybe).toHaveLength(1);
  });
  it('moves, removes and changes only one selected printing, preserving the other', () => {
    const first = { ...card('Sol Ring', 'shared-oracle'), id: 'a', setCode: 'cmm', collectorNumber: '12' };
    const second = { ...card('Sol Ring', 'shared-oracle'), id: 'b', setCode: 'cmm', collectorNumber: '13' };
    useDeckStore.getState().addToDeck(first);
    useDeckStore.getState().addToDeck(second);
    expect(useDeckStore.getState().deck).toHaveLength(2);
    useDeckStore.getState().moveCard(second, 'deck', 'maybe');
    expect(useDeckStore.getState().deck.map(c => c.id)).toEqual(['a']);
    expect(useDeckStore.getState().maybe.map(c => c.id)).toEqual(['b']);
    useDeckStore.getState().updateCardPrinting('deck', first.oracleId,
      { ...first, id: 'a-new', collectorNumber: '14' }, first);
    expect(useDeckStore.getState().deck[0].collectorNumber).toBe('14');
    useDeckStore.getState().removeFromList('maybe', second.oracleId, second);
    expect(useDeckStore.getState().maybe).toHaveLength(0);
    expect(useDeckStore.getState().deck).toHaveLength(1);
  });

});
