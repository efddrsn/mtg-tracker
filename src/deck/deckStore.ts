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

export interface SavedCard extends DeckCard {
  addedAt: number;
}

interface DeckState {
  config: DeckConfig;
  deck: SavedCard[];
  // Oracle ids of rejected / already-saved cards so we never re-surface them.
  rejected: string[];
  // Increments whenever config changes so the feed knows to restart.
  configVersion: number;

  setFormat: (format: DeckFormat) => void;
  toggleColor: (color: ColorCode) => void;
  setColorRule: (rule: DeckConfig['colorRule']) => void;
  toggleKind: (kind: CardKind) => void;
  setTheme: (theme: string) => void;
  setHideBasics: (hide: boolean) => void;
  resetConfig: () => void;

  addToDeck: (card: DeckCard) => void;
  reject: (card: DeckCard) => void;
  removeFromDeck: (oracleId: string) => void;
  clearDeck: () => void;
  clearRejected: () => void;

  isSeen: (oracleId: string) => boolean;
}

const REJECTED_CAP = 4000;

function bumpConfig(set: (fn: (s: DeckState) => Partial<DeckState>) => void) {
  set((s) => ({ configVersion: s.configVersion + 1 }));
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_CONFIG },
      deck: [],
      rejected: [],
      configVersion: 0,

      setFormat: (format) => {
        set((s) => ({ config: { ...s.config, format } }));
        bumpConfig(set);
      },
      toggleColor: (color) => {
        set((s) => {
          const has = s.config.colors.includes(color);
          const colors = has
            ? s.config.colors.filter((c) => c !== color)
            : [...s.config.colors, color];
          return { config: { ...s.config, colors } };
        });
        bumpConfig(set);
      },
      setColorRule: (colorRule) => {
        set((s) => ({ config: { ...s.config, colorRule } }));
        bumpConfig(set);
      },
      toggleKind: (kind) => {
        set((s) => {
          const has = s.config.kinds.includes(kind);
          const kinds = has
            ? s.config.kinds.filter((k) => k !== kind)
            : [...s.config.kinds, kind];
          return { config: { ...s.config, kinds } };
        });
        bumpConfig(set);
      },
      setTheme: (theme) => {
        set((s) => ({ config: { ...s.config, theme } }));
        bumpConfig(set);
      },
      setHideBasics: (hideBasics) => {
        set((s) => ({ config: { ...s.config, hideBasics } }));
        bumpConfig(set);
      },
      resetConfig: () => {
        set({ config: { ...DEFAULT_CONFIG } });
        bumpConfig(set);
      },

      addToDeck: (card) => {
        const { deck, rejected } = get();
        if (deck.some((c) => c.oracleId === card.oracleId)) return;
        set({
          deck: [{ ...card, addedAt: Date.now() }, ...deck],
          rejected: rejected.includes(card.oracleId)
            ? rejected
            : [card.oracleId, ...rejected].slice(0, REJECTED_CAP),
        });
      },
      reject: (card) => {
        set((s) => ({
          rejected: s.rejected.includes(card.oracleId)
            ? s.rejected
            : [card.oracleId, ...s.rejected].slice(0, REJECTED_CAP),
        }));
      },
      removeFromDeck: (oracleId) => {
        set((s) => ({
          deck: s.deck.filter((c) => c.oracleId !== oracleId),
          // Allow it to be recommended again after removal.
          rejected: s.rejected.filter((id) => id !== oracleId),
        }));
      },
      clearDeck: () => set({ deck: [] }),
      clearRejected: () =>
        set((s) => ({ rejected: s.deck.map((c) => c.oracleId) })),

      isSeen: (oracleId) => {
        const { deck, rejected } = get();
        return rejected.includes(oracleId) || deck.some((c) => c.oracleId === oracleId);
      },
    }),
    {
      name: 'mtg-swipe-deck',
      version: 1,
      partialize: (s) => ({
        config: s.config,
        deck: s.deck,
        rejected: s.rejected,
      }),
    },
  ),
);
