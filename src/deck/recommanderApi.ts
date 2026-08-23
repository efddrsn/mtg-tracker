import {
  fetchCardsByOracleId,
  matchesRecommendationFilters,
  type DeckCard,
  type DeckConfig,
} from './scryfall';

const RECOMMENDER_PROXY_URL = '/api/recommander';

export interface ApiRecommendation {
  oracle_id: string;
  name: string;
  score: number;
  commander_count?: number;
  lift?: number;
}

interface ApiResponse {
  recommendations?: ApiRecommendation[];
  message?: string;
}

export interface RecommanderQuery {
  commander: DeckCard;
  deck: DeckCard[];
  config: DeckConfig;
}

export class RecommanderError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RecommanderError';
    this.status = status;
  }
}

// Embedding scores can over-rank a card seen in only a handful of decks. A
// small confidence correction keeps the model's personalization dominant while
// demoting cold-start outliers. The curve saturates at 1,000 commander decks.
export function adjustedRecommendationScore(item: ApiRecommendation): number {
  const count = Math.max(0, item.commander_count ?? 0);
  const confidence = Math.min(1, Math.log10(count + 1) / 3);
  const lift = Math.max(-2, Math.min(3, item.lift ?? 0));
  return item.score * (0.7 + 0.3 * confidence) + 0.04 * confidence + 0.01 * lift;
}

// The API learns only from cards the player actually chose. Rejected cards are
// intentionally absent: the public contract has no negative-input field, and
// pretending a rejected card belongs to the deck would train the opposite
// preference. Exact rejections are filtered by the feed's `isSeen` check.
export function buildRecommanderPayload({ commander, deck }: RecommanderQuery) {
  return {
    card_format: 'oracle_id' as const,
    commander: commander.oracleId,
    partner: null,
    deck: deck
      .filter((card) => card.oracleId !== commander.oracleId)
      .map((card) => card.oracleId),
  };
}

export async function fetchRecommanderRecommendations(
  query: RecommanderQuery,
  signal?: AbortSignal,
): Promise<DeckCard[]> {
  const response = await fetch(RECOMMENDER_PROXY_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildRecommanderPayload(query)),
    signal,
  });

  let body: ApiResponse;
  try {
    body = (await response.json()) as ApiResponse;
  } catch {
    throw new RecommanderError('Recommander returned an invalid response.', response.status);
  }

  if (!response.ok) {
    throw new RecommanderError(
      body.message ?? `Recommander request failed (${response.status}).`,
      response.status,
    );
  }

  const recommendations = (body.recommendations ?? [])
    .filter(
      (item) =>
        typeof item.oracle_id === 'string' &&
        typeof item.score === 'number' &&
        Number.isFinite(item.score),
    )
    .sort((a, b) => adjustedRecommendationScore(b) - adjustedRecommendationScore(a))
    .slice(0, 50);

  if (recommendations.length === 0) return [];

  const hydrated = await fetchCardsByOracleId(
    recommendations.map((item) => item.oracle_id),
    signal,
  );
  const byOracleId = new Map(hydrated.map((card) => [card.oracleId, card]));

  return recommendations.flatMap((item, rank) => {
    const card = byOracleId.get(item.oracle_id);
    if (!card || !matchesRecommendationFilters(card, query.config)) return [];
    return [{
      ...card,
      recommendationScore: adjustedRecommendationScore(item),
      recommendationRank: rank,
    }];
  });
}
