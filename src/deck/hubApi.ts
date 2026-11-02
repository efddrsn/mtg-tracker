import { create } from "zustand";
import { useHubStore } from "./hubStore";
import type { HubDeck } from "./hubStore";

export async function api<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  body?: unknown,
  ownerToken?: string,
): Promise<T> {
  const response = await fetch("/api/event/" + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(ownerToken ? { "x-owner-token": ownerToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "Resposta inesperada. Tente novamente." }));
  if (!response.ok)
    throw new Error(
      data.error || "Não foi possível concluir. Tente novamente.",
    );
  return data;
}
type User = { id: string; name: string; email: string };
export const useAccount = create<{
  user: User | null;
  ready: boolean;
  status: string;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
}>((set, get) => ({
  user: null,
  ready: false,
  status: "",
  refresh: async () => {
    set({ ready: false });
    try {
      const { user } = await api<{ user: User | null }>("session");
      set({ user });
      if (user) {
        const { decks } = await api<{ decks: HubDeck[] }>("workspace");
        useHubStore.getState().merge(decks);
        await get().sync();
      }
    } catch (err) {
      set({ status: err instanceof Error ? err.message : "Sem conexão." });
    } finally {
      set({ ready: true });
    }
  },
  sync: async () => {
    if (!get().user) return;
    set({ status: "Salvando na conta…" });
    try {
      const { decks } = await api<{ decks: HubDeck[] }>("workspace", "PUT", {
        decks: useHubStore.getState().decks,
      });
      useHubStore.getState().merge(decks);
      set({ status: "Decks salvos na conta" });
    } catch (err) {
      set({
        status:
          (err instanceof Error ? err.message : "Sem conexão.") +
          " Seus decks continuam neste aparelho.",
      });
    }
  },
}));
export async function publish(
  deck: HubDeck,
  showPublic: boolean,
): Promise<HubDeck> {
  const body = {
    title: deck.title,
    nickname: deck.nickname,
    public: showPublic,
    cards: deck.cards.map(({ details, ...card }) => {
      void details;
      return card;
    }),
  };
  if (deck.shareId)
    await api("shares/" + deck.shareId, "PUT", body, deck.ownerToken);
  else {
    const data = await api<{ id: string; ownerToken: string }>(
      "shares",
      "POST",
      body,
    );
    deck = { ...deck, shareId: data.id, ownerToken: data.ownerToken };
  }
  const saved = {
    ...deck,
    publishedPublic: showPublic,
    publishedAt: Date.now(),
    updatedAt: Date.now(),
  };
  useHubStore.getState().save(saved);
  return saved;
}
export function download(
  name: string,
  text: string,
  type = "text/plain;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/[^\p{L}\p{N}._-]/gu, "-");
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function copy(text: string): Promise<string> {
  try {
    await navigator.clipboard.writeText(text);
    return "Copiado!";
  } catch {
    throw new Error(
      "Não foi possível copiar automaticamente. Selecione o texto abaixo para copiar.",
    );
  }
}
