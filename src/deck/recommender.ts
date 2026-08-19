// Client-side, content-based recommender. Every swipe nudges a preference
// vector keyed by simple card features; the feed re-ranks upcoming cards by how
// well they match what you've liked (and avoids what you've rejected). No
// server, no model — just transparent feature weights persisted with the deck.
//
// Design philosophy — what the model is allowed to learn from:
//   * Synergy   — regex-detected oracle-text themes (tokens, sacrifice, ramp…),
//     keywords, and curated Scryfall oracle tags (see ORACLE_TAG_MAP in
//     scryfall.ts) — a community-verified functional index that catches cards
//     the regex heuristics miss (e.g. a bounce spell tagged `removal`).
//   * Efficiency — mana-value buckets, so a player who likes cheap cards keeps
//     seeing cheap cards.
//   * Role      — broad card types (creature / instant / …) and color.
//   * Power     — supplied by the BASE ordering: the pool arrives in EDHREC
//     popularity order, which is the playability/power signal. The preference
//     score reorders by synergy/efficiency; EDHREC rank breaks ties, so among
//     equally on-theme cards the more powerful/played one wins.
//
// Deliberately ignored: set, rarity, flavor, art — none of these speak to how
// good or synergistic a card is. Creature *type* is also ignored UNLESS the
// deck is demonstrably tribal (see TRIBAL_MIN): a lone Merfolk you liked
// shouldn't flood the feed with Merfolk, but a Merfolk *theme* should.

import type { DeckCard } from './scryfall';

export type Prefs = Record<string, number>;

// Every knob the recommender exposes for manual tuning (see TuningPanel). All
// of these were previously hardcoded constants; they now live in the store so
// a player can inspect and adjust them live.
export interface TuningParams {
  // How much a ❤️ swipe pulls toward a card's features.
  likeWeight: number;
  // How much a ✕ swipe pushes away (stored as a positive magnitude; applied
  // as negative — a few "no"s shouldn't bury a whole strategy as hard as one
  // "yes" builds it up, hence a smaller default than likeWeight).
  dislikeWeight: number;
  // Cap so a long session can't let one feature dominate the score.
  weightClamp: number;
  // A creature subtype only starts influencing recommendations once this many
  // net likes share it — i.e. the deck has shown a genuine tribal lean.
  tribalMin: number;
  // Net theme weight required before spending a request on a supplemental
  // Scryfall oracle-tag fetch for that theme (see useFeed.ts).
  tagTriggerMin: number;
  // How strongly the chosen commander biases the preference model at pick time.
  commanderSeedWeight: number;
  // Distinctive-card opener length (non-Commander formats) before the feed
  // broadens to the full pool.
  seedLimit: number;
}

export const DEFAULT_TUNING: TuningParams = {
  likeWeight: 1,
  dislikeWeight: 0.55,
  weightClamp: 8,
  tribalMin: 3,
  tagTriggerMin: 1.5,
  commanderSeedWeight: 2,
  seedLimit: 12,
};

// Drives the "Algorithm dials" section of the tuning panel generically.
export const TUNING_FIELDS: {
  key: keyof TuningParams;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  emoji: string;
}[] = [
  {
    key: 'likeWeight',
    label: 'Like strength',
    hint: 'How much a ❤️ swipe pulls toward a trait',
    min: 0.25,
    max: 3,
    step: 0.25,
    emoji: '❤️',
  },
  {
    key: 'dislikeWeight',
    label: 'Dislike strength',
    hint: 'How much a ✕ swipe pushes away from a trait',
    min: 0,
    max: 3,
    step: 0.25,
    emoji: '✕',
  },
  {
    key: 'weightClamp',
    label: 'Max pull',
    hint: 'Cap on how strong any single trait can get',
    min: 2,
    max: 15,
    step: 1,
    emoji: '🧲',
  },
  {
    key: 'tribalMin',
    label: 'Tribal threshold',
    hint: 'Net likes before a creature type counts as a tribe',
    min: 1,
    max: 8,
    step: 0.5,
    emoji: '🐉',
  },
  {
    key: 'tagTriggerMin',
    label: 'Tag trigger',
    hint: 'Interest needed before pulling in oracle-tag matches',
    min: 0.5,
    max: 5,
    step: 0.25,
    emoji: '🏷️',
  },
  {
    key: 'commanderSeedWeight',
    label: 'Commander bias',
    hint: 'How strongly your commander steers early picks',
    min: 0.5,
    max: 5,
    step: 0.25,
    emoji: '⚜️',
  },
  {
    key: 'seedLimit',
    label: 'Opener length',
    hint: 'Distinctive-card swipes before the feed broadens',
    min: 0,
    max: 30,
    step: 1,
    emoji: '✨',
  },
];

function mvBucket(cmc: number): string {
  if (cmc <= 1) return 'mv:0-1';
  if (cmc === 2) return 'mv:2';
  if (cmc === 3) return 'mv:3';
  if (cmc <= 5) return 'mv:4-5';
  return 'mv:6+';
}

// Primary card type (first word of the type line, ignoring "Legendary" etc.).
function primaryTypes(typeLine: string): string[] {
  const face = typeLine.split('//')[0];
  const beforeDash = face.split('—')[0].toLowerCase();
  const known = [
    'creature',
    'instant',
    'sorcery',
    'artifact',
    'enchantment',
    'planeswalker',
    'land',
    'battle',
  ];
  return known.filter((t) => beforeDash.includes(t));
}

// Creature subtypes / tribes (after the em dash), e.g. "Merfolk Wizard".
function subtypes(typeLine: string): string[] {
  const face = typeLine.split('//')[0];
  const idx = face.indexOf('—');
  if (idx === -1) return [];
  return face
    .slice(idx + 1)
    .trim()
    .split(/\s+/)
    .map((s) => s.toLowerCase())
    .filter(Boolean);
}

// The feature tokens that describe a card for matching purposes.
export function cardFeatures(card: DeckCard): string[] {
  const f: string[] = [];
  for (const t of primaryTypes(card.typeLine)) f.push(`type:${t}`);
  f.push(mvBucket(card.cmc));
  for (const c of card.colors) f.push(`color:${c}`);
  for (const k of card.keywords) f.push(`kw:${k.toLowerCase()}`);
  for (const th of card.themes) f.push(`theme:${th}`);
  // Curated Scryfall oracle tags (see ORACLE_TAG_MAP) — a stronger, community-
  // verified synergy signal than the regex themes above. Cards fetched via a
  // tag supplement carry these; swiping on them keeps teaching the model even
  // when their wording doesn't match any regex theme.
  for (const t of card.tagHints ?? []) f.push(`tag:${t}`);
  // Subtypes are tracked here so a tribe can be *detected*, but they only count
  // toward a card's score once they cross TRIBAL_MIN (see scoreCard). Rarity /
  // set / flavor are intentionally never features.
  for (const st of subtypes(card.typeLine)) f.push(`sub:${st}`);
  return f;
}

// Fold a card into the preference vector. `weight` lets callers seed more
// strongly (e.g. the chosen commander).
export function applyToPrefs(
  prefs: Prefs,
  card: DeckCard,
  liked: boolean,
  weight = 1,
  tuning: TuningParams = DEFAULT_TUNING,
): Prefs {
  const delta = (liked ? tuning.likeWeight : -tuning.dislikeWeight) * weight;
  const next: Prefs = { ...prefs };
  for (const feat of cardFeatures(card)) {
    const v = (next[feat] ?? 0) + delta;
    next[feat] = Math.max(-tuning.weightClamp, Math.min(tuning.weightClamp, v));
  }
  return next;
}

// How well a candidate matches current preferences. Normalised by feature count
// so feature-dense cards aren't unfairly favoured. Returns 0 when prefs is empty
// (no swipes yet), which preserves the base EDHREC ordering.
export function scoreCard(
  card: DeckCard,
  prefs: Prefs,
  tuning: TuningParams = DEFAULT_TUNING,
): number {
  const feats = cardFeatures(card);
  if (feats.length === 0) return 0;
  let sum = 0;
  for (const feat of feats) {
    const w = prefs[feat] ?? 0;
    // Creature type is inert until the deck proves it's tribal: a subtype must
    // have accumulated tribalMin+ likes before it can sway the score.
    if (feat.startsWith('sub:') && w < tuning.tribalMin) continue;
    sum += w;
  }
  return sum / Math.sqrt(feats.length);
}

export function hasSignal(prefs: Prefs): boolean {
  for (const k in prefs) if (prefs[k] !== 0) return true;
  return false;
}

// --- Presentation helpers for the tuning panel ------------------------------

const FEATURE_CATEGORIES: Record<string, { category: string; emoji: string }> = {
  type: { category: 'Card type', emoji: '🃏' },
  mv: { category: 'Mana value', emoji: '💧' },
  color: { category: 'Color', emoji: '🎨' },
  kw: { category: 'Keyword', emoji: '⚡' },
  theme: { category: 'Theme', emoji: '🧵' },
  tag: { category: 'Oracle tag', emoji: '🏷️' },
  sub: { category: 'Tribal type', emoji: '🐉' },
};

const COLOR_NAMES: Record<string, string> = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface FeatureInfo {
  key: string;
  category: string;
  emoji: string;
  label: string;
}

// Turn a raw feature key (e.g. "theme:ramp", "mv:4-5", "color:U") into
// something a human can read in the tuning panel.
export function describeFeature(key: string): FeatureInfo {
  const sep = key.indexOf(':');
  const prefix = sep === -1 ? key : key.slice(0, sep);
  const value = sep === -1 ? '' : key.slice(sep + 1);
  const meta = FEATURE_CATEGORIES[prefix] ?? { category: prefix, emoji: '❔' };
  const label =
    prefix === 'color'
      ? COLOR_NAMES[value] ?? value
      : prefix === 'mv'
        ? `MV ${value}`
        : titleCase(value.replace(/-/g, ' '));
  return { key, category: meta.category, emoji: meta.emoji, label };
}

export type WeightedFeature = FeatureInfo & { value: number };

// Group every non-zero learned weight by category, ordered to match
// FEATURE_CATEGORIES and sorted within each category by impact (|value|,
// descending) — exactly the shape the tuning panel renders.
export function groupLearnedFeatures(prefs: Prefs): {
  category: string;
  emoji: string;
  items: WeightedFeature[];
}[] {
  const byCategory = new Map<string, WeightedFeature[]>();
  for (const [key, value] of Object.entries(prefs)) {
    if (value === 0) continue;
    const info = describeFeature(key);
    const list = byCategory.get(info.category) ?? [];
    list.push({ ...info, value });
    byCategory.set(info.category, list);
  }
  const orderedCategories = Object.values(FEATURE_CATEGORIES).map((m) => m.category);
  const result: { category: string; emoji: string; items: WeightedFeature[] }[] = [];
  for (const category of orderedCategories) {
    const items = byCategory.get(category);
    if (!items || items.length === 0) continue;
    items.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    result.push({ category, emoji: items[0].emoji, items });
  }
  return result;
}

// Quick "what's driving this" summary for the tuning panel header.
export function summarizePrefs(prefs: Prefs): {
  learnedCount: number;
  topFeature: WeightedFeature | null;
} {
  let learnedCount = 0;
  let topFeature: WeightedFeature | null = null;
  for (const [key, value] of Object.entries(prefs)) {
    if (value === 0) continue;
    learnedCount++;
    if (!topFeature || Math.abs(value) > Math.abs(topFeature.value)) {
      topFeature = { ...describeFeature(key), value };
    }
  }
  return { learnedCount, topFeature };
}
