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
  quantity?: number;
}

export type CardList = 'deck' | 'sideboard' | 'wishlist' | 'owned' | 'maybe';

export interface ListRevision {
  id: string;
  label: string;
  savedAt: number;
  wishlist: SavedCard[];
  owned: SavedCard[];
  deck?: SavedCard[];
  sideboard?: SavedCard[];
  maybe?: SavedCard[];
}

export interface DeckState {
  config: DeckConfig;
  // Deck membership is the Recommander positive set, separate from wanting
  // or physically owning a card. Lists are scoped to the active workspace deck.
  deck: SavedCard[];
  sideboard: SavedCard[];
  /** Positive recommendation examples, independent of actual deck membership. */
  positive: SavedCard[];
  wishlist: SavedCard[];
  maybe: SavedCard[];
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
  addToMaybe: (card: DeckCard) => void;
  moveCard: (card: DeckCard, source: CardList | 'recommendations', destination: CardList) => void;
  assignSection: (card: DeckCard, destination: 'deck' | 'sideboard' | 'maybe') => void;
  setInterest: (card: DeckCard, status: 'wishlist' | 'owned' | 'none') => void;
  reinforceCard: (card: DeckCard) => void;
  // Backwards-compatible name used by the recommender/search components.
  addToDeck: (card: DeckCard) => void;
  reject: (card: DeckCard) => void;
  skip: (card: DeckCard) => void;
  importCards: (cards: DeckCard[]) => void;
  removeFromList: (list: CardList, oracleId: string, exactCard?: DeckCard) => void;
  removeFromDeck: (oracleId: string) => void;
  clearList: (list: CardList) => void;
  clearDeck: () => void;
  updateCardPrinting: (list: CardList, oracleId: string, printing: DeckCard, original?: DeckCard) => void;
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

// Oracle identity answers "have I seen this name?"; print identity answers
// "which particular physical printing in this pile is being moved?".
function samePrinting(left: DeckCard, right: DeckCard): boolean {
  if (left.oracleId !== right.oracleId) return false;
  if (left.setCode || right.setCode || left.collectorNumber || right.collectorNumber)
    return left.setCode === right.setCode && left.collectorNumber === right.collectorNumber;
  return left.id === right.id;
}

export const useDeckStore = create<DeckState>()(
  persist(
    (set, get) => {
      const bumpConfig = () => set((s) => ({ configVersion: s.configVersion + 1 }));

      const addToList = (card: DeckCard, list: CardList) => {
        set((s) => {
          if (s[list].some((c) => samePrinting(c, card))) return s;
          return {
            [list]: [save(card), ...s[list]],
            rejected: s.rejected.includes(card.oracleId)
              ? s.rejected
              : [card.oracleId, ...s.rejected].slice(0, REJECTED_CAP),
            swipeCount: s.swipeCount + 1,
          };
        });
      };

      const removeFromList = (list: CardList, oracleId: string, exactCard?: DeckCard) => {
        set((s) => {
          const next = s[list].filter((c) => !(c.oracleId === oracleId &&
            (!exactCard || samePrinting(c, exactCard))));
          const remaining = (['deck', 'sideboard', 'wishlist', 'maybe', 'owned'] as const)
            .some((key) => (key === list ? next : s[key]).some((c) => c.oracleId === oracleId));
          return {
            [list]: next,
            commander: list === 'deck' && s.commander?.oracleId === oracleId &&
              (!exactCard || samePrinting(s.commander, exactCard))
              ? (next.find(c => c.oracleId === oracleId) || null)
              : s.commander,
            rejected: remaining
              ? s.rejected
              : s.rejected.filter((id) => id !== oracleId),
          };
        });
      };

      return {
        config: { ...DEFAULT_CONFIG },
        deck: [],
        sideboard: [],
        positive: [],
        wishlist: [],
        maybe: [],
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
        addToMaybe: (card) => addToList(card, 'maybe'),
        addToDeck: (card) => addToList(card, 'deck'),
        moveCard: (card, source, destination) => {
          set((s) => {
            const from = source === 'recommendations' ? null : source;
            const sourceCard = from ? s[from].find((c) => samePrinting(c, card)) : null;
            const saved = sourceCard || save(card);
            const moved = { ...s } as DeckState;
            // Owned is independent of membership. All other destinations
            // move an existing card unless the source is the recommendation feed.
            if (from && from !== destination && from !== 'owned' && destination !== 'owned') {
              moved[from] = s[from].filter((c) => !samePrinting(c, card));
            }
            if (!s[destination].some((c) => samePrinting(c, card))) {
              moved[destination] = [saved, ...s[destination]];
            }
            moved.rejected = s.rejected.includes(card.oracleId)
              ? s.rejected
              : [card.oracleId, ...s.rejected].slice(0, REJECTED_CAP);
            moved.swipeCount = s.swipeCount + 1;
            if (from === 'deck' && destination !== 'deck' && destination !== 'owned' &&
                s.commander?.oracleId === card.oracleId) {
              moved.commander = null;
              moved.configVersion = s.configVersion + 1;
            }
            return moved;
          });
        },
        assignSection: (card, destination) => set(s => {
          const sections = ['deck', 'sideboard', 'maybe'] as const;
          const from = sections.map(key => s[key].find(c => samePrinting(c, card)))
            .find(Boolean);
          const placed = from || save(card);
          const updates: Partial<DeckState> = {};
          for (const key of sections) {
            const remaining = s[key].filter(c => !samePrinting(c, card));
            updates[key] = key === destination
              ? [placed, ...remaining] : remaining;
          }
          updates.commander = destination === 'deck' ? s.commander
            : s.commander && samePrinting(s.commander, card) ? null : s.commander;
          updates.configVersion = updates.commander !== s.commander
            ? s.configVersion + 1 : s.configVersion;
          updates.rejected = [...new Set([card.oracleId, ...s.rejected])].slice(0, REJECTED_CAP);
          updates.swipeCount = s.swipeCount + 1;
          return updates;
        }),
        setInterest: (card, status) => set(s => {
          const previously = [...s.wishlist, ...s.owned].find(c => samePrinting(c, card));
          const saved = previously || save(card);
          const wishlist = s.wishlist.filter(c => !samePrinting(c, card));
          const owned = s.owned.filter(c => !samePrinting(c, card));
          return {
            wishlist: status === 'wishlist' ? [saved, ...wishlist] : wishlist,
            owned: status === 'owned' ? [saved, ...owned] : owned,
            rejected: [...new Set([card.oracleId, ...s.rejected])].slice(0, REJECTED_CAP),
            swipeCount: s.swipeCount + 1,
          };
        }),
        reinforceCard: card => set(s => (
          s.positive.some(c => c.oracleId === card.oracleId)
            ? s : { positive: [save(card), ...s.positive].slice(0, 150) }
        )),
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
        removeFromDeck: (oracleId) => removeFromList('deck', oracleId),
        clearList: (list) => set((s) => ({
          [list]: [],
          ...(list === 'deck' ? { commander: null, configVersion: s.configVersion + 1 } : {}),
        })),
        clearDeck: () => set({ deck: [], commander: null }),
        updateCardPrinting: (list, oracleId, printing, original) => {
          set((s) => {
            const replaceCard = (cards: SavedCard[]) => cards.map((card) =>
              card.oracleId === oracleId && (!original || samePrinting(card, original))
                ? { ...printing, addedAt: card.addedAt, quantity: card.quantity || 1 }
                : card,
            );
            return {
              [list]: replaceCard(s[list]),
              commander: list === 'deck' && s.commander?.oracleId === oracleId &&
                (!original || samePrinting(s.commander, original))
                ? { ...printing, addedAt: s.commander.addedAt }
                : s.commander,
            };
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
              deck: s.deck.map((c) => ({ ...c })),
              sideboard: s.sideboard.map((c) => ({ ...c })),
              wishlist: s.wishlist.map((c) => ({ ...c })),
              maybe: s.maybe.map((c) => ({ ...c })),
              owned: s.owned.map((c) => ({ ...c })),
            };
            return { revisions: [revision, ...s.revisions].slice(0, REVISION_CAP) };
          });
        },
        restoreRevision: (id) => {
          set((s) => {
            const revision = s.revisions.find((r) => r.id === id);
            if (!revision) return s;
            const deck = (revision.deck ?? revision.wishlist).map((c) => ({ ...c }));
            const sideboard = (revision.sideboard || []).map((c) => ({ ...c }));
            const wishlist = revision.wishlist.map((c) => ({ ...c }));
            const maybe = (revision.maybe || []).map((c) => ({ ...c }));
            const owned = revision.owned.map((c) => ({ ...c }));
            const commander = s.commander
              ? [...deck, ...owned].find((c) => c.oracleId === s.commander?.oracleId) ?? null
              : null;
            return {
              deck,
              sideboard,
              wishlist,
              maybe,
              owned,
              commander,
              rejected: [
                ...new Set([
                  ...deck.map((c) => c.oracleId),
                  ...sideboard.map((c) => c.oracleId),
                  ...wishlist.map((c) => c.oracleId),
                  ...maybe.map((c) => c.oracleId),
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
          const { deck, sideboard, wishlist, maybe, owned, rejected } = get();
          return rejected.includes(oracleId)
            || [deck, sideboard, wishlist, maybe, owned].some((list) =>
              list.some((c) => c.oracleId === oracleId));
        },
      };
    },
    {
      name: 'mtg-swipe-deck',
      version: 10,
      partialize: (s) => ({
        config: s.config,
        deck: s.deck,
        sideboard: s.sideboard,
        positive: s.positive,
        wishlist: s.wishlist,
        maybe: s.maybe,
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
        // Legacy `deck` meant Wishlist; never reinterpret it as deck
        // membership and accidentally change Recommander training inputs.
        if (version < 8) s = {
          ...s, wishlist: s.deck ?? [], maybe: [], deck: [],
          revisions: (s.revisions || []).map(r => ({
            ...r, deck: [], wishlist: r.wishlist, maybe: [],
          })),
        };
        if (version < 9) s = { ...s, sideboard: [] };
        if (version < 10) s = { ...s, positive: [] };
        return s as DeckState;
      },
    },
  ),
);
