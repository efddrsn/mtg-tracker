import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeckCard, DeckConfig } from './scryfall';
import {
  adjustedRecommendationScore,
  buildRecommanderPayload,
  fetchRecommanderRecommendations,
} from './recommanderApi';

function card(overrides: Partial<DeckCard> = {}): DeckCard {
  return {
    id: 'printing-id',
    oracleId: 'oracle-id',
    name: 'Card',
    typeLine: 'Creature',
    manaCost: '{1}{G}',
    cmc: 2,
    colors: ['G'],
    colorIdentity: ['G'],
    rarity: 'uncommon',
    keywords: [],
    themes: [],
    edhrecRank: 100,
    image: 'https://cards.test/card.jpg',
    backImage: null,
    priceUsd: '1.00',
    scryfallUri: 'https://scryfall.com/card/test',
    oracleText: '',
    games: ['paper'],
    legalities: { commander: 'legal' },
    ...overrides,
  };
}

const config: DeckConfig = {
  format: 'commander',
  colors: ['B', 'G'],
  colorRule: 'within',
  kinds: [],
  theme: '',
  hideBasics: true,
  arenaOnly: false,
  rarities: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Recommander query', () => {
  it('uses right-swiped cards as input and never duplicates the commander', () => {
    const commander = card({ oracleId: 'meren', name: 'Meren of Clan Nel Toth' });
    const selected = card({ oracleId: 'spore-frog', name: 'Spore Frog' });

    expect(buildRecommanderPayload({ commander, deck: [commander, selected], config })).toEqual({
      card_format: 'oracle_id',
      commander: 'meren',
      partner: null,
      deck: ['spore-frog'],
    });
  });

  it('confidence-corrects low-sample outliers without replacing personalization', () => {
    const proven = adjustedRecommendationScore({
      oracle_id: 'proven',
      name: 'Proven synergy',
      score: 0.75,
      commander_count: 4_000,
      lift: 2,
    });
    const outlier = adjustedRecommendationScore({
      oracle_id: 'outlier',
      name: 'Tiny sample',
      score: 0.8,
      commander_count: 2,
      lift: -1,
    });

    expect(proven).toBeGreaterThan(outlier);
  });

  it('hydrates API results, preserves model order, and applies UI filters', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            recommendations: [
              {
                oracle_id: 'tiny',
                name: 'Tiny Sample',
                score: 0.8,
                commander_count: 2,
                lift: -1,
              },
              {
                oracle_id: 'proven',
                name: 'Proven Synergy',
                score: 0.75,
                commander_count: 4_000,
                lift: 2,
              },
              {
                oracle_id: 'basic',
                name: 'Forest',
                score: 0.9,
                commander_count: 10_000,
                lift: 0,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              scryfallCard('tiny', 'Tiny Sample'),
              scryfallCard('proven', 'Proven Synergy'),
              scryfallCard('basic', 'Forest', 'Basic Land — Forest'),
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    const commander = card({ oracleId: 'meren', name: 'Meren of Clan Nel Toth' });
    const results = await fetchRecommanderRecommendations({
      commander,
      deck: [commander],
      config,
    });

    expect(results.map((item) => item.name)).toEqual(['Proven Synergy', 'Tiny Sample']);
    expect(results[0].recommendationScore).toBeGreaterThan(results[1].recommendationScore!);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/recommander',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          card_format: 'oracle_id',
          commander: 'meren',
          partner: null,
          deck: [],
        }),
      }),
    );
  });
});

function scryfallCard(oracleId: string, name: string, typeLine = 'Creature') {
  return {
    id: `${oracleId}-printing`,
    oracle_id: oracleId,
    name,
    type_line: typeLine,
    mana_cost: '{1}{G}',
    cmc: 2,
    colors: ['G'],
    color_identity: ['G'],
    rarity: 'uncommon',
    keywords: [],
    oracle_text: '',
    edhrec_rank: 100,
    image_uris: { normal: `https://cards.test/${oracleId}.jpg` },
    prices: { usd: '1.00' },
    scryfall_uri: `https://scryfall.com/card/${oracleId}`,
    games: ['paper'],
    legalities: { commander: 'legal' },
  };
}
