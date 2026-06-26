import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type DeckCard,
  type DeckConfig,
  type CardKind,
  type ColorCode,
  type DeckFormat,
  DEFAULT_CONFIG,
} from './scryfall';
import { applyToPrefs, type Prefs } from './recommender';

export interface SavedCard extends DeckCard {
  addedAt: number;
}

// Number of opening swipes that use the "distinctive" seed query before the
// feed broadens to the full pool (non-commander formats only).
export const SEED_LIMIT = 12;
// How strongly the chosen commander biases the preference model.
const COMMANDER_SEED_WEIGHT = 2;

interface DeckState {
  config: DeckConfig;
  deck: SavedCard[];
  commander: SavedCard | null;
  // Oracle ids of rejected / already-saved cards so we never re-surface them.
  rejected: string[];
  // Learned preference vector + counters that drive the adaptive feed.
  prefs: Prefs;
  swipeCount: number;
  // Bumped when the feed must restart (config/commander change).
  configVersion: number;
  // Bumped when prefs change so the feed can re-rank without refetching.
  prefsVersion: number;

  setFormat: (format: DeckFormat) => void;
  toggleColor: (color: ColorCode) => void;
  setColorRule: (rule: DeckConfig['colorRule']) => void;
  toggleKind: (kind: CardKind) => void;
  setTheme: (theme: string) => void;
  setHideBasics: (hide: boolean) => void;
  resetConfig: () => void;

  setCommander: (card: DeckCard) => void;
  clearCommander: () => void;

  addToDeck: (card: DeckCard) => void;
  reject: (card: DeckCard) => void;
  // Pass on a card without training the preference model (used for commanders).
  skip: (card: DeckCard) => void;
  // Import a pasted decklist: adds to deck, seeds the preference model, and
  // (when no commander is set) sets the color filter from the cards' identities.
  importCards: (cards: DeckCard[]) => void;
  removeFromDeck: (oracleId: string) => void;
  clearDeck: () => void;

  isSeen: (oracleId: string) => boolean;
}

const REJECTED_CAP = 4000;

export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => {
      const bumpConfig = () => set((s) => ({ configVersion: s.configVersion + 1 }));

      return {
        config: { ...DEFAULT_CONFIG },
        deck: [],
        commander: null,
        rejected: [],
        prefs: {},
        swipeCount: 0,
        configVersion: 0,
        prefsVersion: 0,

        setFormat: (format) => {
          // Switching format invalidates a previously chosen commander.
          set((s) => ({
            config: { ...s.config, format },
            commander: format === 'commander' ? s.commander : null,
          }));
          bumpConfig();
        },
        toggleColor: (color) => {
          set((s) => {
            const has = s.config.colors.includes(color);
            const colors = has
              ? s.config.colors.filter((c) => c !== color)
              : [...s.config.colors, color];
            return { config: { ...s.config, colors } };
          });
          bumpConfig();
        },
        setColorRule: (colorRule) => {
          set((s) => ({ config: { ...s.config, colorRule } }));
          bumpConfig();
        },
        toggleKind: (kind) => {
          set((s) => {
            const has = s.config.kinds.includes(kind);
            const kinds = has
              ? s.config.kinds.filter((k) => k !== kind)
              : [...s.config.kinds, kind];
            return { config: { ...s.config, kinds } };
          });
          bumpConfig();
        },
        setTheme: (theme) => {
          set((s) => ({ config: { ...s.config, theme } }));
          bumpConfig();
        },
        setHideBasics: (hideBasics) => {
          set((s) => ({ config: { ...s.config, hideBasics } }));
          bumpConfig();
        },
        resetConfig: () => {
          set({ config: { ...DEFAULT_CONFIG }, commander: null });
          bumpConfig();
        },

        // Choosing a commander locks the deck's color identity to it, adds it to
        // the deck, and seeds the preference model toward its strategy so the
        // very next recommendations already lean the right way.
        setCommander: (card) => {
          set((s) => {
            const saved: SavedCard = { ...card, addedAt: Date.now() };
            const deck = s.deck.some((c) => c.oracleId === card.oracleId)
              ? s.deck
              : [saved, ...s.deck];
            return {
              commander: saved,
              config: { ...s.config, colors: card.colorIdentity, colorRule: 'within' },
              deck,
              rejected: s.rejected.includes(card.oracleId)
                ? s.rejected
                : [card.oracleId, ...s.rejected].slice(0, REJECTED_CAP),
              prefs: applyToPrefs(s.prefs, card, true, COMMANDER_SEED_WEIGHT),
            };
          });
          set((s) => ({ configVersion: s.configVersion + 1, prefsVersion: s.prefsVersion + 1 }));
        },
        clearCommander: () => {
          set({ commander: null });
          bumpConfig();
        },

        addToDeck: (card) => {
          const { deck, rejected } = get();
          if (deck.some((c) => c.oracleId === card.oracleId)) return;
          set((s) => ({
            deck: [{ ...card, addedAt: Date.now() }, ...deck],
            rejected: rejected.includes(card.oracleId)
              ? rejected
              : [card.oracleId, ...rejected].slice(0, REJECTED_CAP),
            prefs: applyToPrefs(s.prefs, card, true),
            swipeCount: s.swipeCount + 1,
            prefsVersion: s.prefsVersion + 1,
          }));
        },
        reject: (card) => {
          set((s) => ({
            rejected: s.rejected.includes(card.oracleId)
              ? s.rejected
              : [card.oracleId, ...s.rejected].slice(0, REJECTED_CAP),
            prefs: applyToPrefs(s.prefs, card, false),
            swipeCount: s.swipeCount + 1,
            prefsVersion: s.prefsVersion + 1,
          }));
        },
        skip: (card) => {
          set((s) => ({
            rejected: s.rejected.includes(card.oracleId)
              ? s.rejected
              : [card.oracleId, ...s.rejected].slice(0, REJECTED_CAP),
          }));
        },
        importCards: (cards) => {
          if (cards.length === 0) return;
          set((s) => {
            const existing = new Set(s.deck.map((c) => c.oracleId));
            const now = Date.now();
            const added = cards
              .filter((c) => !existing.has(c.oracleId))
              .map((c) => ({ ...c, addedAt: now }));

            let prefs = s.prefs;
            for (const c of cards) prefs = applyToPrefs(prefs, c, true);

            const rejected = [
              ...new Set([...cards.map((c) => c.oracleId), ...s.rejected]),
            ].slice(0, REJECTED_CAP);

            // Widen the color filter to cover the imported cards — unless a
            // commander already dictates the identity.
            let colors = s.config.colors;
            if (!s.commander) {
              const set5 = new Set<ColorCode>(colors);
              for (const c of cards) for (const ci of c.colorIdentity) set5.add(ci);
              colors = [...set5];
            }

            return {
              deck: [...added, ...s.deck],
              prefs,
              rejected,
              config: { ...s.config, colors },
              swipeCount: s.swipeCount + cards.length,
            };
          });
          set((s) => ({
            configVersion: s.configVersion + 1,
            prefsVersion: s.prefsVersion + 1,
          }));
        },
        removeFromDeck: (oracleId) => {
          set((s) => ({
            deck: s.deck.filter((c) => c.oracleId !== oracleId),
            commander:
              s.commander?.oracleId === oracleId ? null : s.commander,
            // Allow it to be recommended again after removal.
            rejected: s.rejected.filter((id) => id !== oracleId),
          }));
          // If the removed card was the commander, the feed must restart.
          if (get().commander === null) bumpConfig();
        },
        clearDeck: () => set({ deck: [], commander: null }),

        isSeen: (oracleId) => {
          const { deck, rejected } = get();
          return rejected.includes(oracleId) || deck.some((c) => c.oracleId === oracleId);
        },
      };
    },
    {
      name: 'mtg-swipe-deck',
      version: 2,
      partialize: (s) => ({
        config: s.config,
        deck: s.deck,
        commander: s.commander,
        rejected: s.rejected,
        prefs: s.prefs,
        swipeCount: s.swipeCount,
      }),
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<DeckState>;
        if (version < 2) {
          return {
            ...s,
            commander: null,
            prefs: {},
            swipeCount: 0,
            prefsVersion: 0,
          } as DeckState;
        }
        return s as DeckState;
      },
    },
  ),
);
