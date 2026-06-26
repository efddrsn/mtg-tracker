// Scryfall API layer. Provides EDHREC-ranked deck-building recommendations.
// CORS-friendly and key-free. Scryfall bakes EDHREC popularity into
// `order:edhrec`, so we lean on it for the base ranking and layer a local,
// swipe-driven preference model on top (see recommender.ts).

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
  colors: ColorCode[];
  colorIdentity: ColorCode[];
  rarity: string;
  keywords: string[];
  // Coarse strategy tags derived from oracle text (see THEME_PATTERNS).
  themes: string[];
  edhrecRank: number | null;
  image: string | null;
  backImage: string | null;
  priceUsd: string | null;
  scryfallUri: string;
}

// --- Theme extraction -------------------------------------------------------
// Lightweight oracle-text classification so the recommender can learn that a
// player favours, say, tokens or sacrifice without a server-side model.

const THEME_PATTERNS: { theme: string; re: RegExp }[] = [
  { theme: 'tokens', re: /\btoken/ },
  { theme: 'sacrifice', re: /\bsacrifice/ },
  { theme: 'lifegain', re: /\b(gain[s]? .*life|lifelink)/ },
  { theme: 'draw', re: /\bdraw[s]? (a|one|two|three|that many|\d|cards?)/ },
  { theme: 'plus1counters', re: /\+1\/\+1 counter/ },
  { theme: 'countermagic', re: /\bcounter target/ },
  { theme: 'graveyard', re: /\bgraveyard/ },
  { theme: 'mill', re: /\bmill/ },
  { theme: 'treasure', re: /\btreasure/ },
  { theme: 'equipment', re: /\b(equip\b|equipped)/ },
  { theme: 'auras', re: /\benchant (creature|permanent|player|land)/ },
  { theme: 'discard', re: /\bdiscard/ },
  { theme: 'reanimate', re: /return .* from .* graveyard to the battlefield/ },
  { theme: 'ramp', re: /(search your library for .* land|add \{[wubrgc]\}|mana of any)/ },
  { theme: 'removal', re: /\b(destroy target|exile target)/ },
  { theme: 'burn', re: /deals? \d+ damage to (any target|target (creature|player|opponent))/ },
];

function extractThemes(text: string): string[] {
  const lower = text.toLowerCase();
  const out: string[] = [];
  for (const { theme, re } of THEME_PATTERNS) {
    if (re.test(lower)) out.push(theme);
  }
  return out;
}

// --- Query construction -----------------------------------------------------

export type FeedPhase = 'commander-select' | 'build';

export interface FeedRequest {
  config: DeckConfig;
  // Locked color identity once a commander is chosen (overrides config.colors).
  commanderIdentity: ColorCode[] | null;
  phase: FeedPhase;
  // Non-commander opener: famous colored cards only, no colorless staples.
  seed: boolean;
}

export function buildQuery(req: FeedRequest): string {
  const { config, commanderIdentity, phase, seed } = req;
  const parts: string[] = [`legal:${config.format}`];

  if (phase === 'commander-select') {
    parts.push('is:commander');
    if (config.colors.length > 0) {
      parts.push(`id<=${config.colors.join('').toLowerCase()}`);
    }
    parts.push('-t:background');
    return parts.join(' ');
  }

  // Build phase.
  const colors = commanderIdentity ?? config.colors;
  if (colors.length > 0) {
    const c = colors.join('').toLowerCase();
    const rule = commanderIdentity ? 'within' : config.colorRule;
    parts.push(rule === 'exact' ? `id=${c}` : `id<=${c}`);
  }

  if (seed) {
    // Distinctive opener: iconic *colored* cards, skipping generic colorless
    // staples (Sol Ring, signets, Command Tower…) and lands.
    parts.push('(rarity:rare OR rarity:mythic)');
    parts.push('-c:c');
    parts.push('-t:land');
  }

  if (config.kinds.length > 0) {
    parts.push(`(${config.kinds.map((k) => `t:${k}`).join(' OR ')})`);
  }

  if (config.hideBasics) parts.push('-t:basic');

  const theme = config.theme.trim();
  if (theme) {
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
  oracle_text?: string;
}

interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  type_line?: string;
  mana_cost?: string;
  cmc?: number;
  colors?: string[];
  color_identity?: string[];
  rarity?: string;
  keywords?: string[];
  oracle_text?: string;
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
  const oracle =
    card.oracle_text ??
    (card.card_faces ?? []).map((f) => f.oracle_text ?? '').join(' \n ');
  return {
    id: card.id,
    oracleId: card.oracle_id,
    name: card.name,
    typeLine: card.type_line ?? card.card_faces?.[0]?.type_line ?? '',
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? '',
    cmc: card.cmc ?? 0,
    colors: (card.colors ?? []) as ColorCode[],
    colorIdentity: (card.color_identity ?? []) as ColorCode[],
    rarity: card.rarity ?? 'common',
    keywords: card.keywords ?? [],
    themes: extractThemes(oracle),
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

function toPage(body: ScryfallList): RecommendationPage {
  return {
    cards: (body.data ?? []).filter((c) => c.image_uris || c.card_faces).map(normalize),
    nextPage: body.has_more ? body.next_page ?? null : null,
    totalCards: body.total_cards ?? 0,
  };
}

// Fetch the first page of recommendations for a feed request, sorted by EDHREC
// rank so the most-played cards surface first.
export async function fetchRecommendations(
  req: FeedRequest,
  signal?: AbortSignal,
): Promise<RecommendationPage> {
  const params = new URLSearchParams({
    q: buildQuery(req),
    order: 'edhrec',
    dir: 'asc',
    unique: 'cards',
  });
  return toPage(await request(`${SEARCH_URL}?${params.toString()}`, signal));
}

// Follow a Scryfall next_page URL (already fully-formed).
export async function fetchNextPage(
  nextPage: string,
  signal?: AbortSignal,
): Promise<RecommendationPage> {
  return toPage(await request(nextPage, signal));
}
