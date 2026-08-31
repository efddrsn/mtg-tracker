import { describe, expect, it } from 'vitest';
import type { SavedCard } from './deckStore';
import { groupDeckCards } from './deckPresentation';

function card(
  oracleId: string,
  name: string,
  typeLine = 'Creature',
): SavedCard {
  return {
    id: `${oracleId}-printing`,
    oracleId,
    name,
    typeLine,
    manaCost: '',
    cmc: 0,
    colors: [],
    colorIdentity: [],
    rarity: 'common',
    keywords: [],
    themes: [],
    edhrecRank: null,
    image: null,
    backImage: null,
    priceUsd: null,
    scryfallUri: '',
    oracleText: '',
    games: ['paper'],
    legalities: {},
    addedAt: 1,
  };
}

describe('groupDeckCards', () => {
  it('stacks identical gameplay objects and moves basic lands last', () => {
    const forest = card('forest', 'Forest', 'Basic Land — Forest');
    const bolt = card('bolt', 'Lightning Bolt', 'Instant');

    expect(groupDeckCards([forest, bolt, { ...bolt, id: 'another-print' }])).toEqual([
      { card: bolt, count: 2 },
      { card: forest, count: 1 },
    ]);
  });
});
