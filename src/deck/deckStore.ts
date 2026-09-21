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

export type CardList = 'wishlist' | 'owned';

export interface ListRevision {
  id: string;
  label: string;
  savedAt: number;
  wishlist: SavedCard[];
  owned: SavedCard[];
}

export interface DeckState {
  config: DeckConfig;
  // Kept as `deck` internally so the recommender continues to consume the
  // positive preference set. In the UI this is always the wishlist.
  deck: SavedCard[];
  owned: SavedCard[];
  revisions: ListRevision[];
  commander: SavedCard | null;
  rejected: string[];
  swipeCount: number;
  configVersion: number;

  setFormat: (format: DeckFormat) => void;
  toggleColor: (color: ColorCode) => void;
  setColorRule: (rule: DeckConfig['colorRule']) => void;
  toggleKind: (kind: CardKind) => void;
  setTheme: (theme: string) => void;
  setHideBasics: (hide: boolean) => void;
  setArenaOnly: (arenaOnly: boolean) => void;
  toggleRarity: (rarity: DeckConfig['rarities'][number]) => void;
  resetConfig: () => void;

  setCommander: (card: DeckCard) => void;
  clearCommander: () => void;

  addToWishlist: (card: DeckCard) => void;
  addToOwned: (card: DeckCard) => void;
  // Backwards-compatible name used by the recommender/search components.
  addToDeck: (card: DeckCard) => void;
  reject: (card: DeckCard) => void;
  skip: (card: DeckCard) => void;
  importCards: (cards: DeckCard[]) => void;
  removeFromList: (list: CardList, oracleId: string) => void;
  removeFromDeck: (oracleId: string) => void;
  clearList: (list: CardList) => void;
  clearDeck: () => void;
  updateCardPrinting: (list: CardList, oracleId: string, printing: DeckCard) => void;
  saveRevision: (label?: string) => void;
  restoreRevision: (id: string) => void;
  deleteRevision: (id: string) => void;

  isSeen: (oracleId: string) => boolean;
}

const REJECTED_CAP = 4000;
const REVISION_CAP = 12;

function save(card: DeckCard): SavedCard {
  return { ...card, addedAt: Date.now() };
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => {
      const bumpConfig = () => set((s) => ({ configVersion: s.configVersion + 1 }));

      const addToList = (card: DeckCard, list: CardList) => {
        set((s) => {
          const target = list === 'wishlist' ? s.deck : s.owned;
          if (target.some((c) => c.oracleId === card.oracleId)) return s;
          const saved = save(card);
          const deck = list === 'wishlist'
            ? [saved, ...s.deck]
            : s.deck.filter((c) => c.oracleId !== card.oracleId);
          const owned = list === 'owned'
            ? [saved, ...s.owned]
            : s.owned.filter((c) => c.oracleId !== card.oracleId);
          return {
            deck,
            owned,
            rejected: s.rejected.includes(card.oracleId)
              ? s.rejected
              : [card.oracleId, ...s.rejected].slice(0, REJECTED_CAP),
            swipeCount: s.swipeCount + 1,
          };
        });
      };

      const removeFromList = (list: CardList, oracleId: string) => {
        set((s) => {
          const deck = list === 'wishlist'
            ? s.deck.filter((c) => c.oracleId !== oracleId)
            : s.deck;
          const owned = list === 'owned'
            ? s.owned.filter((c) => c.oracleId !== oracleId)
            : s.owned;
          const remainsSaved = deck.some((c) => c.oracleId === oracleId)
            || owned.some((c) => c.oracleId === oracleId);
          return {
            deck,
            owned,
            commander: s.commander?.oracleId === oracleId && !remainsSaved
              ? null
              : s.commander,
            rejected: remainsSaved
              ? s.rejected
              : s.rejected.filter((id) => id !== oracleId),
          };
        });
      };

      return {
        config: { ...DEFAULT_CONFIG },
        deck: [],
        owned: [],
        revisions: [],
        commander: null,
        rejected: [],
        swipeCount: 0,
        configVersion: 0,

        setFormat: (format) => {
          set((s) => ({
            config: { ...s.config, format },
            commander: format === 'commander' ? s.commander : null,
          }));
          bumpConfig();
        },
        toggleColor: (color) => {
          set((s) => {
            const colors = s.config.colors.includes(color)
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
            const kinds = s.config.kinds.includes(kind)
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
        setArenaOnly: (arenaOnly) => {
          set((s) => ({ config: { ...s.config, arenaOnly } }));
          bumpConfig();
        },
        toggleRarity: (rarity) => {
          set((s) => {
            const rarities = s.config.rarities.includes(rarity)
              ? s.config.rarities.filter((r) => r !== rarity)
              : [...s.config.rarities, rarity];
            return { config: { ...s.config, rarities } };
          });
          bumpConfig();
        },
        resetConfig: () => {
          set({ config: { ...DEFAULT_CONFIG }, commander: null });
          bumpConfig();
        },

        setCommander: (card) => {
          set((s) => {
            const saved = save(card);
            return {
              commander: saved,
              config: { ...s.config, colors: card.colorIdentity, colorRule: 'within' },
              deck: s.deck.some((c) => c.oracleId === card.oracleId)
                ? s.deck
                : [saved, ...s.deck],
              owned: s.owned.filter((c) => c.oracleId !== card.oracleId),
              rejected: s.rejected.includes(card.oracleId)
                ? s.rejected
                : [card.oracleId, ...s.rejected].slice(0, REJECTED_CAP),
            };
          });
          bumpConfig();
        },
        clearCommander: () => {
          set({ commander: null });
          bumpConfig();
        },

        addToWishlist: (card) => addToList(card, 'wishlist'),
        addToOwned: (card) => addToList(card, 'owned'),
        addToDeck: (card) => addToList(card, 'wishlist'),
        reject: (card) => {
          set((s) => ({
            rejected: s.rejected.includes(card.oracleId)
              ? s.rejected
              : [card.oracleId, ...s.rejected].slice(0, REJECTED_CAP),
            swipeCount: s.swipeCount + 1,
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
            const rejected = [
              ...new Set([...cards.map((c) => c.oracleId), ...s.rejected]),
            ].slice(0, REJECTED_CAP);
            let colors = s.config.colors;
            if (!s.commander) {
              const set5 = new Set<ColorCode>(colors);
              for (const c of cards) for (const ci of c.colorIdentity) set5.add(ci);
              colors = [...set5];
            }
            return {
              deck: [...added, ...s.deck],
              owned: s.owned.filter((c) => !cards.some((x) => x.oracleId === c.oracleId)),
              rejected,
              config: { ...s.config, colors },
              swipeCount: s.swipeCount + cards.length,
            };
          });
          bumpConfig();
        },
        removeFromList,
        removeFromDeck: (oracleId) => removeFromList('wishlist', oracleId),
        clearList: (list) => set(list === 'wishlist'
          ? { deck: [], commander: null }
          : { owned: [] }),
        clearDeck: () => set({ deck: [], commander: null }),
        updateCardPrinting: (list, oracleId, printing) => {
          set((s) => {
            const replace = (cards: SavedCard[]) => cards.map((card) =>
              card.oracleId === oracleId
                ? { ...printing, addedAt: card.addedAt }
                : card,
            );
            const deck = list === 'wishlist' ? replace(s.deck) : s.deck;
            const owned = list === 'owned' ? replace(s.owned) : s.owned;
            const commander = s.commander?.oracleId === oracleId
              ? { ...printing, addedAt: s.commander.addedAt }
              : s.commander;
            return { deck, owned, commander };
          });
        },
        saveRevision: (label) => {
          set((s) => {
            const number = s.revisions.length + 1;
            const now = Date.now();
            const revision: ListRevision = {
              id: `${now}-${number}`,
              label: label?.trim() || `Versão ${number}`,
              savedAt: now,
              wishlist: s.deck.map((c) => ({ ...c })),
              owned: s.owned.map((c) => ({ ...c })),
            };
            return { revisions: [revision, ...s.revisions].slice(0, REVISION_CAP) };
          });
        },
        restoreRevision: (id) => {
          set((s) => {
            const revision = s.revisions.find((r) => r.id === id);
            if (!revision) return s;
            const deck = revision.wishlist.map((c) => ({ ...c }));
            const owned = revision.owned.map((c) => ({ ...c }));
            const commander = s.commander
              ? [...deck, ...owned].find((c) => c.oracleId === s.commander?.oracleId) ?? null
              : null;
            return {
              deck,
              owned,
              commander,
              rejected: [
                ...new Set([
                  ...deck.map((c) => c.oracleId),
                  ...owned.map((c) => c.oracleId),
                  ...s.rejected,
                ]),
              ].slice(0, REJECTED_CAP),
              configVersion: s.configVersion + 1,
            };
          });
        },
        deleteRevision: (id) => set((s) => ({
          revisions: s.revisions.filter((r) => r.id !== id),
        })),

        isSeen: (oracleId) => {
          const { deck, owned, rejected } = get();
          return rejected.includes(oracleId)
            || deck.some((c) => c.oracleId === oracleId)
            || owned.some((c) => c.oracleId === oracleId);
        },
      };
    },
    {
      name: 'mtg-swipe-deck',
      version: 7,
      partialize: (s) => ({
        config: s.config,
        deck: s.deck,
        owned: s.owned,
        revisions: s.revisions,
        commander: s.commander,
        rejected: s.rejected,
        swipeCount: s.swipeCount,
      }),
      migrate: (persisted, version) => {
        let s = (persisted ?? {}) as Partial<DeckState>;
        if (version < 2) s = { ...s, commander: null, swipeCount: 0 };
        if (version < 3) s = { ...s, config: { ...DEFAULT_CONFIG, ...s.config } };
        if (version < 7) s = { ...s, owned: [], revisions: [] };
        return s as DeckState;
      },
    },
  ),
);
