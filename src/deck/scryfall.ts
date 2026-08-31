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
  | 'pauper'
  | 'alchemy'
  | 'historic'
  | 'explorer'
  | 'timeless'
  | 'standardbrawl'
  | 'gladiator';

export const FORMATS: { value: DeckFormat; label: string; arena?: boolean }[] = [
  { value: 'commander', label: 'Commander' },
  { value: 'standard', label: 'Standard' },
  { value: 'pioneer', label: 'Pioneer' },
  { value: 'modern', label: 'Modern' },
  { value: 'legacy', label: 'Legacy' },
  { value: 'pauper', label: 'Pauper' },
  { value: 'alchemy', label: 'Alchemy', arena: true },
  { value: 'historic', label: 'Historic', arena: true },
  { value: 'explorer', label: 'Explorer', arena: true },
  { value: 'timeless', label: 'Timeless', arena: true },
  { value: 'standardbrawl', label: 'Brawl', arena: true },
  { value: 'gladiator', label: 'Gladiator', arena: true },
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

export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic';

export const RARITIES: { value: Rarity; label: string }[] = [
  { value: 'common', label: 'Common' },
  { value: 'uncommon', label: 'Uncommon' },
  { value: 'rare', label: 'Rare' },
  { value: 'mythic', label: 'Mythic' },
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
  // Restrict to cards available on MTG Arena (game:arena).
  arenaOnly: boolean;
  // Rarities to include (OR). Empty = all rarities.
  rarities: Rarity[];
}

export const DEFAULT_CONFIG: DeckConfig = {
  format: 'commander',
  colors: [],
  colorRule: 'within',
  kinds: [],
  theme: '',
  hideBasics: true,
  arenaOnly: false,
  rarities: [],
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
  // Curated Scryfall oracle-tag keys this card was fetched via (see
  // ORACLE_TAG_MAP). Unset for cards that arrived through the normal feed.
  tagHints?: string[];
  edhrecRank: number | null;
  image: string | null;
  backImage: string | null;
  priceUsd: string | null;
  scryfallUri: string;
  oracleText: string;
  games: string[];
  legalities: Record<string, string>;
  // Present when the card came from Recommander. The score is the primary
  // ordering signal; rank preserves the API order if scores tie.
  recommendationScore?: number;
  recommendationRank?: number;
}

export function isBasicLand(card: Pick<DeckCard, 'typeLine'>): boolean {
  return /\bbasic land\b/i.test(card.typeLine);
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

// --- Oracle tags -------------------------------------------------------------
// Scryfall's card objects don't expose their own community tags, but `otag:`
// IS a valid search filter — a curated, human-verified functional index (see
// https://scryfall.com/docs/api/tags). That makes it much more precise than
// the regex guesses above (e.g. a bounce spell reads nothing like "destroy
// target", but the community correctly tags it `removal`).
//
// We use tags as a *supplemental fetch*, not a per-card score: once the local
// regex theme signal shows real interest in one of these themes, the feed
// fires one extra `otag:` query (scoped to the deck's own filters) and merges
// the results in, marking them with `tagHints` so they score just as well as
// (and keep teaching the model alongside) anything matched by regex.
export const ORACLE_TAG_MAP: { themeKey: string; otag: string; label: string }[] = [
  { themeKey: 'ramp', otag: 'ramp', label: 'Ramp' },
  { themeKey: 'removal', otag: 'removal', label: 'Removal' },
  { themeKey: 'draw', otag: 'card-advantage', label: 'Card advantage' },
  { themeKey: 'sacrifice', otag: 'sac-outlet', label: 'Sac outlets' },
  { themeKey: 'lifegain', otag: 'lifegain', label: 'Lifegain' },
  { themeKey: 'reanimate', otag: 'reanimate', label: 'Reanimation' },
  { themeKey: 'countermagic', otag: 'counterspell', label: 'Counterspells' },
  { themeKey: 'discard', otag: 'hand-disruption', label: 'Hand disruption' },
  { themeKey: 'burn', otag: 'burn', label: 'Burn' },
];

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

// Clauses shared by the main feed query and the general "add a card" search:
// format legality, color identity, Arena-only, and rarity. Kind/theme/seed are
// feed-specific narrowing, not applicability, so they're kept out of here.
function baseClauses(
  config: DeckConfig,
  commanderIdentity: ColorCode[] | null,
): string[] {
  // Keep the rollup on a physical non-foil printing. Combined with
  // `unique=cards` below, this returns one gameplay object instead of the
  // foil/showcase print variants that otherwise look like repeated cards.
  const parts: string[] = [`legal:${config.format}`, 'is:nonfoil'];

  const colors = commanderIdentity ?? config.colors;
  if (colors.length > 0) {
    const c = colors.join('').toLowerCase();
    const rule = commanderIdentity ? 'within' : config.colorRule;
    parts.push(rule === 'exact' ? `id=${c}` : `id<=${c}`);
  }

  if (config.arenaOnly) parts.push('game:arena');

  if (config.rarities.length > 0) {
    parts.push(`(${config.rarities.map((r) => `rarity:${r}`).join(' OR ')})`);
  }

  return parts;
}

export function buildQuery(req: FeedRequest): string {
  const { config, commanderIdentity, phase, seed } = req;

  if (phase === 'commander-select') {
    const parts: string[] = [`legal:${config.format}`, 'is:commander', 'is:nonfoil'];
    if (config.colors.length > 0) {
      parts.push(`id<=${config.colors.join('').toLowerCase()}`);
    }
    if (config.arenaOnly) parts.push('game:arena');
    parts.push('-t:background');
    return parts.join(' ');
  }

  // Build phase.
  const parts = baseClauses(config, commanderIdentity);

  if (seed) {
    // Distinctive opener: iconic *colored* cards, skipping generic colorless
    // staples (Sol Ring, signets, Command Tower…) and lands. If the player
    // already chose specific rarities above, that choice wins instead.
    if (config.rarities.length === 0) parts.push('(rarity:rare OR rarity:mythic)');
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

// Query for the general "add a card by name" search: same applicability
// clauses as the feed (format/colors/arena/rarity) plus the typed name term.
export function buildNameSearchQuery(
  config: DeckConfig,
  commanderIdentity: ColorCode[] | null,
  term: string,
): string {
  return [...baseClauses(config, commanderIdentity), term].join(' ');
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
  games?: string[];
  legalities?: Record<string, string>;
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
    oracleText: oracle,
    games: card.games ?? [],
    legalities: card.legalities ?? {},
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

// Shared name-search primitive behind both the commander finder and the
// general "add a card" field: run an arbitrary query and return normalized,
// image-bearing results, most-played first.
async function searchByQuery(query: string, signal?: AbortSignal): Promise<DeckCard[]> {
  const params = new URLSearchParams({
    q: query,
    order: 'edhrec',
    dir: 'asc',
    unique: 'cards',
  });
  const body = await request(`${SEARCH_URL}?${params.toString()}`, signal);
  return (body.data ?? [])
    .filter((c) => c.image_uris || c.card_faces)
    .map(normalize)
    .slice(0, 12);
}

// Fetch cards carrying a specific curated oracle tag, scoped to the deck's own
// applicability filters — the "supplemental fetch" side of tag-based
// recommendations (see ORACLE_TAG_MAP above).
export async function fetchByOracleTag(
  config: DeckConfig,
  commanderIdentity: ColorCode[] | null,
  otag: string,
  signal?: AbortSignal,
): Promise<DeckCard[]> {
  const query = [...baseClauses(config, commanderIdentity), `otag:${otag}`].join(' ');
  const params = new URLSearchParams({ q: query, order: 'edhrec', dir: 'asc', unique: 'cards' });
  const body = await request(`${SEARCH_URL}?${params.toString()}`, signal);
  return (body.data ?? []).filter((c) => c.image_uris || c.card_faces).map(normalize);
}

// Search legal commanders by (partial) name — powers the "find my commander"
// overlay so a player who already knows their commander can jump straight to it.
export async function searchCommanders(
  name: string,
  signal?: AbortSignal,
): Promise<DeckCard[]> {
  const term = name.trim();
  if (!term) return [];
  return searchByQuery(`is:commander is:nonfoil ${term}`, signal);
}

// Search any card by (partial) name, scoped to the deck's current
// format/color/Arena/rarity filters — powers the general "add a card" field.
export async function searchCards(
  name: string,
  config: DeckConfig,
  commanderIdentity: ColorCode[] | null,
  signal?: AbortSignal,
): Promise<DeckCard[]> {
  const term = name.trim();
  if (!term) return [];
  return searchByQuery(buildNameSearchQuery(config, commanderIdentity, term), signal);
}

// --- Decklist import --------------------------------------------------------

const COLLECTION_URL = 'https://api.scryfall.com/cards/collection';

interface ScryfallCollection {
  data?: ScryfallCard[];
  not_found?: { name?: string }[];
  details?: string;
}

// Parse a pasted decklist into bare card names. Tolerates the common export
// shapes: "1 Sol Ring", "1x Sol Ring", "Sol Ring (C21) 263", "// Commander",
// "SB: ...", trailing foil markers, etc.
export function parseDecklist(text: string): string[] {
  const names: string[] = [];
  for (const raw of text.split('\n')) {
    let line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#')) continue;
    line = line.replace(/^sb:\s*/i, '');
    line = line.replace(/^\s*\d+\s*x?\s+/i, ''); // leading quantity
    line = line.replace(/\s*\([^)]*\)\s*[\w-]*\s*$/i, ''); // (SET) 123
    line = line.replace(/\s*\[[^\]]*\]\s*$/i, ''); // [tags]
    line = line.replace(/\s*\*?f\*?\s*$/i, ''); // foil marker
    line = line.split('//')[0].trim(); // front face of DFCs
    if (line) names.push(line);
  }
  return names;
}

export interface ImportResult {
  cards: DeckCard[];
  notFound: string[];
}

// Apply filters that Recommander itself does not know about. Commander
// legality and color identity are handled by the recommendation model; these
// are the player's optional UI constraints.
export function matchesRecommendationFilters(card: DeckCard, config: DeckConfig): boolean {
  if (config.hideBasics && isBasicLand(card)) return false;
  if (config.arenaOnly && !card.games.includes('arena')) return false;
  if (config.rarities.length > 0 && !config.rarities.includes(card.rarity as Rarity)) {
    return false;
  }
  if (
    config.kinds.length > 0 &&
    !config.kinds.some((kind) => new RegExp(`\\b${kind}\\b`, 'i').test(card.typeLine))
  ) {
    return false;
  }
  const theme = config.theme.trim().toLowerCase();
  if (
    theme &&
    !`${card.name} ${card.typeLine} ${card.oracleText}`.toLowerCase().includes(theme)
  ) {
    return false;
  }
  return true;
}

async function fetchCollection(
  identifiers: ({ name: string } | { oracle_id: string })[],
  signal?: AbortSignal,
): Promise<ImportResult> {
  const cards: DeckCard[] = [];
  const notFound: string[] = [];
  for (let i = 0; i < identifiers.length; i += 75) {
    const chunk = identifiers.slice(i, i + 75);
    const res = await fetch(COLLECTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ identifiers: chunk }),
      signal,
    });
    const body = (await res.json()) as ScryfallCollection;
    if (!res.ok) {
      throw new ScryfallError(body.details ?? `Scryfall error ${res.status}`, res.status);
    }
    for (const c of body.data ?? []) cards.push(normalize(c));
    for (const nf of body.not_found ?? []) if (nf.name) notFound.push(nf.name);
  }
  return { cards, notFound };
}

export async function fetchCardsByOracleId(
  oracleIds: string[],
  signal?: AbortSignal,
): Promise<DeckCard[]> {
  const unique = [...new Set(oracleIds.filter(Boolean))];
  return (await fetchCollection(unique.map((oracle_id) => ({ oracle_id })), signal)).cards;
}

// Resolve card names to full cards via Scryfall's collection endpoint
// (batched at the 75-identifier limit).
export async function fetchCardsByName(
  names: string[],
  signal?: AbortSignal,
): Promise<ImportResult> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  return fetchCollection(unique.map((name) => ({ name })), signal);
}
