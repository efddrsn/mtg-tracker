// Scryfall API layer. Provides EDHREC-ranked deck-building recommendations
// derived from a DeckConfig. CORS-friendly and key-free.

export type ColorCode = 'W' | 'U' | 'B' | 'R' | 'G';
export const ALL_COLORS: ColorCode[] = ['W', 'U', 'B', 'R', 'G'];

export type DeckFormat =
  | 'commander'
  | 'standard'
  | 'pioneer'
  | 'modern'
  | 'legacy'
  | 'pauper';

export const FORMATS: { value: DeckFormat; label: string }[] = [
  { value: 'commander', label: 'Commander' },
  { value: 'standard', label: 'Standard' },
  { value: 'pioneer', label: 'Pioneer' },
  { value: 'modern', label: 'Modern' },
  { value: 'legacy', label: 'Legacy' },
  { value: 'pauper', label: 'Pauper' },
];

export type CardKind =
  | 'creature'
  | 'instant'
  | 'sorcery'
  | 'artifact'
  | 'enchantment'
  | 'planeswalker'
  | 'land';

export const CARD_KINDS: { value: CardKind; label: string }[] = [
  { value: 'creature', label: 'Creatures' },
  { value: 'instant', label: 'Instants' },
  { value: 'sorcery', label: 'Sorceries' },
  { value: 'artifact', label: 'Artifacts' },
  { value: 'enchantment', label: 'Enchantments' },
  { value: 'planeswalker', label: 'Planeswalkers' },
  { value: 'land', label: 'Lands' },
];

export interface DeckConfig {
  format: DeckFormat;
  // Selected colors. Empty = no color restriction.
  colors: ColorCode[];
  // For commander: id<= (within color identity). Otherwise commander-style
  // identity is still a sensible "what fits my deck" filter.
  colorRule: 'within' | 'exact';
  // Card types to include (OR). Empty = all types.
  kinds: CardKind[];
  // Free-text theme appended to the query (oracle text / tribe / keyword).
  theme: string;
  // Hide basic lands from the feed (they're rarely a recommendation).
  hideBasics: boolean;
}

export const DEFAULT_CONFIG: DeckConfig = {
  format: 'commander',
  colors: [],
  colorRule: 'within',
  kinds: [],
  theme: '',
  hideBasics: true,
};

export interface DeckCard {
  id: string;
  oracleId: string;
  name: string;
  typeLine: string;
  manaCost: string;
  cmc: number;
  colorIdentity: ColorCode[];
  edhrecRank: number | null;
  image: string | null;
  backImage: string | null;
  priceUsd: string | null;
  scryfallUri: string;
}

// --- Query construction -----------------------------------------------------

export function buildQuery(config: DeckConfig): string {
  const parts: string[] = [`legal:${config.format}`];

  if (config.colors.length > 0) {
    const c = config.colors.join('').toLowerCase();
    // Color identity keeps recommendations castable in a deck of these colors.
    parts.push(config.colorRule === 'exact' ? `id=${c}` : `id<=${c}`);
  } else {
    // No colors chosen: still avoid suggesting off-identity cards is moot;
    // leave unrestricted.
  }

  if (config.kinds.length > 0) {
    const typeClause = config.kinds.map((k) => `t:${k}`).join(' OR ');
    parts.push(`(${typeClause})`);
  }

  if (config.hideBasics) {
    parts.push('-t:basic');
  }

  const theme = config.theme.trim();
  if (theme) {
    // Quote multi-word themes so Scryfall treats them as a single oracle match.
    parts.push(/\s/.test(theme) ? `oracle:"${theme}"` : `oracle:${theme}`);
  }

  return parts.join(' ');
}

// --- Fetching ----------------------------------------------------------------

interface ScryfallImageUris {
  normal?: string;
  large?: string;
  png?: string;
  small?: string;
}

interface ScryfallCardFace {
  image_uris?: ScryfallImageUris;
  mana_cost?: string;
  type_line?: string;
}

interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  type_line?: string;
  mana_cost?: string;
  cmc?: number;
  color_identity?: string[];
  edhrec_rank?: number;
  image_uris?: ScryfallImageUris;
  card_faces?: ScryfallCardFace[];
  prices?: { usd?: string | null };
  scryfall_uri: string;
}

interface ScryfallList {
  object: string;
  data?: ScryfallCard[];
  has_more?: boolean;
  next_page?: string;
  total_cards?: number;
  details?: string;
}

function pickImage(uris?: ScryfallImageUris): string | null {
  if (!uris) return null;
  return uris.normal || uris.large || uris.png || uris.small || null;
}

function normalize(card: ScryfallCard): DeckCard {
  const front = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  const back =
    card.card_faces && card.card_faces.length > 1
      ? card.card_faces[1]?.image_uris
      : undefined;
  return {
    id: card.id,
    oracleId: card.oracle_id,
    name: card.name,
    typeLine: card.type_line ?? card.card_faces?.[0]?.type_line ?? '',
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '',
    cmc: card.cmc ?? 0,
    colorIdentity: (card.color_identity ?? []) as ColorCode[],
    edhrecRank: card.edhrec_rank ?? null,
    image: pickImage(front),
    backImage: pickImage(back),
    priceUsd: card.prices?.usd ?? null,
    scryfallUri: card.scryfall_uri,
  };
}

const SEARCH_URL = 'https://api.scryfall.com/cards/search';

export interface RecommendationPage {
  cards: DeckCard[];
  nextPage: string | null;
  totalCards: number;
}

export class ScryfallError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ScryfallError';
    this.status = status;
  }
}

async function request(url: string, signal?: AbortSignal): Promise<ScryfallList> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  const body = (await res.json()) as ScryfallList;
  if (!res.ok) {
    // Scryfall returns 404 with a list-like error body when nothing matches.
    if (res.status === 404) {
      return { object: 'list', data: [], has_more: false, total_cards: 0 };
    }
    throw new ScryfallError(body.details ?? `Scryfall error ${res.status}`, res.status);
  }
  return body;
}

// Fetch the first page of recommendations for a config, sorted by EDHREC rank
// so the most-played cards surface first.
export async function fetchRecommendations(
  config: DeckConfig,
  signal?: AbortSignal,
): Promise<RecommendationPage> {
  const params = new URLSearchParams({
    q: buildQuery(config),
    order: 'edhrec',
    dir: 'asc',
    unique: 'cards',
  });
  const body = await request(`${SEARCH_URL}?${params.toString()}`, signal);
  return {
    cards: (body.data ?? []).filter((c) => c.image_uris || c.card_faces).map(normalize),
    nextPage: body.has_more ? body.next_page ?? null : null,
    totalCards: body.total_cards ?? 0,
  };
}

// Follow a Scryfall next_page URL (already fully-formed).
export async function fetchNextPage(
  nextPage: string,
  signal?: AbortSignal,
): Promise<RecommendationPage> {
  const body = await request(nextPage, signal);
  return {
    cards: (body.data ?? []).filter((c) => c.image_uris || c.card_faces).map(normalize),
    nextPage: body.has_more ? body.next_page ?? null : null,
    totalCards: body.total_cards ?? 0,
  };
}
