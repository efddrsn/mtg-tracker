// Client-side, content-based recommender. Every swipe nudges a preference
// vector keyed by simple card features; the feed re-ranks upcoming cards by how
// well they match what you've liked (and avoids what you've rejected). No
// server, no model — just transparent feature weights persisted with the deck.

import type { DeckCard } from './scryfall';

export type Prefs = Record<string, number>;

// Weight applied to a liked card's features; rejections push the other way but
// more gently, so a few "no"s don't bury a whole strategy.
const LIKE_WEIGHT = 1;
const DISLIKE_WEIGHT = -0.55;
// Cap so a long session can't let one feature dominate the score.
const WEIGHT_CLAMP = 8;

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
  for (const st of subtypes(card.typeLine)) f.push(`sub:${st}`);
  f.push(`rarity:${card.rarity}`);
  return f;
}

// Fold a card into the preference vector. `weight` lets callers seed more
// strongly (e.g. the chosen commander).
export function applyToPrefs(
  prefs: Prefs,
  card: DeckCard,
  liked: boolean,
  weight = 1,
): Prefs {
  const delta = (liked ? LIKE_WEIGHT : DISLIKE_WEIGHT) * weight;
  const next: Prefs = { ...prefs };
  for (const feat of cardFeatures(card)) {
    const v = (next[feat] ?? 0) + delta;
    next[feat] = Math.max(-WEIGHT_CLAMP, Math.min(WEIGHT_CLAMP, v));
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
