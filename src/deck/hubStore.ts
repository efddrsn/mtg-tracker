import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DeckCard } from "./scryfall";

export type HubCard = {
  name: string;
  quantity: number;
  section: "main" | "commander" | "sideboard";
  image?: string;
  oracleId?: string;
  setCode?: string;
  collectorNumber?: string;
  details?: DeckCard;
};
export type HubDeck = {
  id: string;
  title: string;
  kind: "deck" | "wishlist" | "collection";
  format: string;
  nickname: string;
  cards: HubCard[];
  updatedAt: number;
  createdAt: number;
  deletedAt?: number;
  shareId?: string;
  ownerToken?: string;
  publishedPublic?: boolean;
  publishedAt?: number;
};
interface HubState {
  decks: HubDeck[];
  activeDeckId: string | null;
  nickname: string;
  save: (deck: HubDeck) => void;
  merge: (decks: HubDeck[]) => void;
  setNickname: (name: string) => void;
  restore: (id: string) => void;
  setActive: (id: string | null) => void;
}
export const useHubStore = create<HubState>()(
  persist(
    (set) => ({
      decks: [],
      activeDeckId: null,
      nickname: "",
      save: (deck) =>
        set((s) => ({
          decks: [deck, ...s.decks.filter((d) => d.id !== deck.id)],
        })),
      merge: (decks) =>
        set((s) => {
          const merged = new Map(s.decks.map((d) => [d.id, d]));
          for (const d of decks)
            if (
              validDeck(d) &&
              (!merged.has(d.id) || d.updatedAt > merged.get(d.id)!.updatedAt)
            )
              merged.set(d.id, d);
          return { decks: [...merged.values()] };
        }),
      restore: (id) =>
        set((s) => ({
          decks: s.decks.map((d) =>
            d.id === id
              ? {
                  ...d,
                  deletedAt: undefined,
                  publishedPublic: false,
                  updatedAt: Date.now(),
                }
              : d,
          ),
        })),
      setNickname: (nickname) => set({ nickname }),
      setActive: (activeDeckId) => set({ activeDeckId }),
    }),
    { name: "magic-hub-library", version: 1 },
  ),
);

export function validDeck(d: unknown): d is HubDeck {
  if (!d || typeof d !== "object") return false;
  const item = d as HubDeck;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    Array.isArray(item.cards) &&
    item.cards.length <= 250 &&
    Number.isFinite(item.updatedAt) &&
    item.cards.every(
      (c) =>
        typeof c.name === "string" &&
        Number.isInteger(c.quantity) &&
        c.quantity > 0 &&
        c.quantity <= 999 &&
        ["main", "sideboard", "commander"].includes(c.section),
    )
  );
}
export function makeDeck(
  title = "Meu deck",
  cards: HubCard[] = [],
  kind: HubDeck["kind"] = "deck",
): HubDeck {
  return {
    id: crypto.randomUUID(),
    title,
    cards,
    kind,
    format: "Commander",
    nickname: useHubStore.getState().nickname,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
export function parseHubList(text: string): HubCard[] {
  const cards: HubCard[] = [];
  let section: HubCard["section"] = "main";
  for (let line of text.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;
    const heading = line
      .replace(/^\/\/\s*/, "")
      .replace(/:$/, "")
      .toLowerCase();
    if (["commander", "comandante", "command zone"].includes(heading)) {
      section = "commander";
      continue;
    }
    if (
      [
        "deck",
        "main",
        "mainboard",
        "maindeck",
        "companheiro",
        "companion",
      ].includes(heading)
    ) {
      section = "main";
      continue;
    }
    if (["sideboard", "side", "maybeboard"].includes(heading)) {
      section = "sideboard";
      continue;
    }
    if (/^(\/\/|#)/.test(line)) continue;
    const sb = /^sb:\s*/i.test(line);
    line = line.replace(/^sb:\s*/i, "");
    const qty = /^(\d+)\s*x?\s+/i.exec(line);
    const quantity = qty ? Number(qty[1]) : 1;
    line = line
      .replace(/^\d+\s*x?\s+/i, "")
      .replace(/\s+\*?F\*?$/i, "")
      .replace(/\s*\[[^\]]*\]/g, "")
      .trim();
    const printing = /\s+\(([\w-]+)\)\s*([\w-]+)?$/.exec(line);
    const name = (printing ? line.slice(0, printing.index) : line).trim();
    if (!name || quantity < 1 || quantity > 999)
      throw new Error("Use quantidades entre 1 e 999.");
    const part = sb ? "sideboard" : section;
    const existing = cards.find(
      (c) =>
        c.name.toLowerCase() === name.toLowerCase() &&
        c.section === part &&
        c.setCode === printing?.[1]?.toLowerCase() &&
        c.collectorNumber === printing?.[2],
    );
    if (existing) {
      existing.quantity += quantity;
      if (existing.quantity > 999) throw new Error("Quantidade acima de 999.");
    } else
      cards.push({
        name,
        quantity,
        section: part,
        setCode: printing?.[1]?.toLowerCase(),
        collectorNumber: printing?.[2],
      });
  }
  if (cards.length > 250)
    throw new Error("Use até 250 cartas diferentes por lista.");
  return cards;
}
export function listText(cards: HubCard[], versions = true): string {
  const groups: [HubCard["section"], string][] = [
    ["commander", "Commander"],
    ["main", "Deck"],
    ["sideboard", "Sideboard"],
  ];
  return groups
    .filter(([s]) => cards.some((c) => c.section === s))
    .map(([section, label]) => {
      const lines = cards
        .filter((c) => c.section === section)
        .map(
          (c) =>
            `${c.quantity} ${c.name}${versions && c.setCode ? ` (${c.setCode.toUpperCase()})${c.collectorNumber ? ` ${c.collectorNumber}` : ""}` : ""}`,
        );
      return `${label}\n${lines.join("\n")}`;
    })
    .join("\n\n");
}
export function fromCards(cards: DeckCard[]): HubCard[] {
  return cards.map((c) => ({
    name: c.name,
    quantity: 1,
    section: "main",
    image: c.image || undefined,
    oracleId: c.oracleId,
    setCode: c.setCode,
    collectorNumber: c.collectorNumber,
    details: c,
  }));
}
export function toCard(c: HubCard): DeckCard {
  return (
    c.details || {
      id: c.oracleId || c.name,
      oracleId: c.oracleId || c.name,
      name: c.name,
      typeLine: "",
      manaCost: "",
      cmc: 0,
      colors: [],
      colorIdentity: [],
      rarity: "",
      keywords: [],
      themes: [],
      edhrecRank: null,
      image: c.image || null,
      backImage: null,
      priceUsd: null,
      setCode: c.setCode,
      collectorNumber: c.collectorNumber,
      scryfallUri:
        "https://scryfall.com/search?q=" +
        encodeURIComponent('!"' + c.name + '"'),
      oracleText: "",
      games: [],
      legalities: {},
    }
  );
}
