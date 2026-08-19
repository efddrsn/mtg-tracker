// Client-side, content-based recommender. Every swipe nudges a preference
// vector keyed by simple card features; the feed re-ranks upcoming cards by how
// well they match what you've liked (and avoids what you've rejected). No
// server, no model — just transparent feature weights persisted with the deck.
//
// Design philosophy — what the model is allowed to learn from:
//   * Only high-confidence, meaningful signals make it in: curated Scryfall
//     oracle tags, regex-detected oracle-text themes, ability keywords, and
//     mana value. Each carries its own confidence multiplier (see
//     FEATURE_CATEGORIES) reflecting how trustworthy a signal it is —
//     oracle tags first (community-verified), then themes, then keywords,
//     then mana value last (the weakest signal: plenty of great cards share
//     any given cost, so it should nudge, not steer).
//   * Power comes from the BASE ordering: the pool arrives in EDHREC
//     popularity order. The preference score only reorders within that;
//     EDHREC rank breaks ties, so among equally on-theme cards the more
//     powerful/played one wins.
//
// Deliberately left out entirely: card type, color, creature subtype, set,
// rarity, flavor, art. Type and color are already hard filters in the config
// sheet, so re-learning them as soft preferences is redundant noise. Creature
// subtype (tribal synergy) turned out to be too easily confused with "I liked
// one card that happened to be a Merfolk" — cut rather than tuned, in favor of
// keeping only signals that are actually informative on their own.

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

// The only feature namespaces the model tracks, in priority order (also the
// tuning panel's category order). `confidence` scales how strongly a single
// swipe moves that category's weights — the most trustworthy signal (a
// community-verified oracle tag) moves the needle hardest; the weakest
// (mana value, since plenty of good cards share any given cost) moves it least.
const FEATURE_CATEGORIES: Record<string, { category: string; emoji: string; confidence: number }> = {
  tag: { category: 'Oracle tag', emoji: '🏷️', confidence: 1.5 },
  theme: { category: 'Theme', emoji: '🧵', confidence: 1 },
  kw: { category: 'Keyword', emoji: '⚡', confidence: 0.7 },
  mv: { category: 'Mana value', emoji: '💧', confidence: 0.4 },
};

function mvBucket(cmc: number): string {
  if (cmc <= 1) return 'mv:0-1';
  if (cmc === 2) return 'mv:2';
  if (cmc === 3) return 'mv:3';
  if (cmc <= 5) return 'mv:4-5';
  return 'mv:6+';
}

// The feature tokens that describe a card for matching purposes — only the
// four tracked namespaces above; see the design philosophy note up top for
// why type/color/subtype are deliberately left out.
export function cardFeatures(card: DeckCard): string[] {
  const f: string[] = [];
  f.push(mvBucket(card.cmc));
  for (const k of card.keywords) f.push(`kw:${k.toLowerCase()}`);
  for (const th of card.themes) f.push(`theme:${th}`);
  // Curated Scryfall oracle tags (see ORACLE_TAG_MAP) — the strongest,
  // community-verified synergy signal. Cards fetched via a tag supplement
  // carry these; swiping on them keeps teaching the model even when their
  // wording doesn't match any regex theme.
  for (const t of card.tagHints ?? []) f.push(`tag:${t}`);
  return f;
}

function featureConfidence(feat: string): number {
  const prefix = feat.slice(0, feat.indexOf(':'));
  return FEATURE_CATEGORIES[prefix]?.confidence ?? 1;
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
  const base = (liked ? tuning.likeWeight : -tuning.dislikeWeight) * weight;
  const next: Prefs = { ...prefs };
  for (const feat of cardFeatures(card)) {
    const delta = base * featureConfidence(feat);
    const v = (next[feat] ?? 0) + delta;
    next[feat] = Math.max(-tuning.weightClamp, Math.min(tuning.weightClamp, v));
  }
  return next;
}

// How well a candidate matches current preferences. Normalised by feature count
// so feature-dense cards aren't unfairly favoured. Returns 0 when prefs is empty
// (no swipes yet), which preserves the base EDHREC ordering.
export function scoreCard(card: DeckCard, prefs: Prefs): number {
  const feats = cardFeatures(card);
  if (feats.length === 0) return 0;
  let sum = 0;
  for (const feat of feats) sum += prefs[feat] ?? 0;
  return sum / Math.sqrt(feats.length);
}

export function hasSignal(prefs: Prefs): boolean {
  for (const k in prefs) if (prefs[k] !== 0) return true;
  return false;
}

// --- Presentation helpers for the tuning panel ------------------------------

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface FeatureInfo {
  key: string;
  category: string;
  emoji: string;
  label: string;
}

// Whether a stored prefs key is one of the four tracked namespaces. Older
// saved decks may still carry now-retired signals (card type, color, tribal
// subtype); this keeps them out of the tuning panel without needing a data
// migration — they're inert (never matched against new cards) either way.
function isTrackedFeature(key: string): boolean {
  return key.slice(0, key.indexOf(':')) in FEATURE_CATEGORIES;
}

// Drop any prefs entries outside the tracked namespaces — used by the store's
// migration to clean out now-retired signals (card type, color, tribal
// subtype) from older saved decks.
export function pruneUntrackedFeatures(prefs: Prefs): Prefs {
  const next: Prefs = {};
  for (const [key, value] of Object.entries(prefs)) {
    if (isTrackedFeature(key)) next[key] = value;
  }
  return next;
}

// Turn a raw feature key (e.g. "theme:ramp", "mv:4-5", "tag:removal") into
// something a human can read in the tuning panel.
export function describeFeature(key: string): FeatureInfo {
  const sep = key.indexOf(':');
  const prefix = sep === -1 ? key : key.slice(0, sep);
  const value = sep === -1 ? '' : key.slice(sep + 1);
  const meta = FEATURE_CATEGORIES[prefix] ?? { category: prefix, emoji: '❔' };
  const label = prefix === 'mv' ? `MV ${value}` : titleCase(value.replace(/-/g, ' '));
  return { key, category: meta.category, emoji: meta.emoji, label };
}

export type WeightedFeature = FeatureInfo & { value: number };

// Group every non-zero learned weight by category, ordered to match
// FEATURE_CATEGORIES (oracle tag → theme → keyword → mana value) and sorted
// within each category by impact (|value|, descending) — exactly the shape
// the tuning panel renders.
export function groupLearnedFeatures(prefs: Prefs): {
  category: string;
  emoji: string;
  items: WeightedFeature[];
}[] {
  const byCategory = new Map<string, WeightedFeature[]>();
  for (const [key, value] of Object.entries(prefs)) {
    if (value === 0 || !isTrackedFeature(key)) continue;
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
    if (value === 0 || !isTrackedFeature(key)) continue;
    learnedCount++;
    if (!topFeature || Math.abs(value) > Math.abs(topFeature.value)) {
      topFeature = { ...describeFeature(key), value };
    }
  }
  return { learnedCount, topFeature };
}
