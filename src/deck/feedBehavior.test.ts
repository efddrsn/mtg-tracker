import { describe, expect, it } from 'vitest';
import type { DeckCard } from './scryfall';
import { buildQuery, DEFAULT_CONFIG } from './scryfall';
import { rankPool } from './useFeed';

function card(
  oracleId: string,
  typeLine: string,
  recommendationScore: number,
  seq: number,
) {
  const item: DeckCard & { seq: number } = {
    id: `${oracleId}-printing`,
    oracleId,
    name: oracleId,
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
    recommendationScore,
    seq,
  };
  return item;
}

describe('recommendation feed behavior', () => {
  it('requests a single non-foil gameplay object', () => {
    const query = buildQuery({
      config: { ...DEFAULT_CONFIG, hideBasics: false },
      commanderIdentity: null,
      phase: 'build',
      seed: false,
    });

    expect(query).toContain('is:nonfoil');
  });

  it('keeps basic lands after other cards regardless of model score', () => {
    const forest = card('Forest', 'Basic Land — Forest', 1, 0);
    const spell = card('Spell', 'Instant', 0.1, 1);

    expect(rankPool([forest, spell], false).map((item) => item.oracleId)).toEqual([
      'Spell',
      'Forest',
    ]);
  });
});
