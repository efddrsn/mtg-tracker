import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  HubLayout,
  panel,
  field,
  button,
  ghost,
} from "../components/HubLayout";
import {
  useHubStore,
  makeDeck,
  parseHubList,
  listText,
  fromCards,
  toCard,
  labelOf,
  LABEL_NAMES,
  type ListLabel,
} from "../deck/hubStore";
import type { HubDeck, HubCard } from "../deck/hubStore";
import { api, copy, download, publish, useAccount } from "../deck/hubApi";
import { useDeckStore } from "../deck/deckStore";
import { loadSwiperDeck, persistSwiperDeck } from "../deck/swiperWorkspace";
import { fetchHubCards } from "../deck/scryfall";
import { CardTutorExport } from "../components/CardTutorExport";

export function MyDecks() {
  const decks = useHubStore((s) => s.decks);
  const [query, setQuery] = useState("");
  const [trash, setTrash] = useState(false);
  const [groupBy, setGroupBy] = useState<"list" | "label">("list");
  const [sortBy, setSortBy] = useState<"updated" | "name" | "cards">("updated");
  const [message, setMessage] = useState("");
  const user = useAccount((s) => s.user);
  const navigate = useNavigate();
  const [openingId, setOpeningId] = useState<string | null>(null);
  async function resume(d: HubDeck) {
    if (openingId) return;
    setOpeningId(d.id);
    let selected = d;
    try {
      // Text-only imports need resolved oracle/color identities before the
      // Recommander can use this deck as its actual recommendation context.
      if (d.cards.some(c => !c.details)) {
        const resolved = await fetchHubCards(d.cards);
        const cards = d.cards.map(c => {
          const match = resolved.cards.find(x =>
            x.name.toLowerCase() === c.name.toLowerCase() &&
            (!c.setCode || x.setCode === c.setCode) &&
            (!c.collectorNumber || x.collectorNumber === c.collectorNumber)
          );
          return match ? {
            ...c, details: match, image: match.image || undefined,
            oracleId: match.oracleId, setCode: match.setCode,
            collectorNumber: match.collectorNumber,
          } : c;
        });
        selected = { ...d, cards, updatedAt: Math.max(Date.now(), d.updatedAt + 1) };
        useHubStore.getState().save(selected);
      }
    } catch {
      // Existing saved text is still usable offline; it is never discarded.
    } finally {
      const active = useHubStore.getState().activeDeckId;
      if (active && active !== d.id) persistSwiperDeck(active);
      loadSwiperDeck(selected);
      setOpeningId(null);
      navigate('/swipe');
    }
  }
  const wishlistCount = useDeckStore((s) => s.wishlist.length);
  const ownedCount = useDeckStore((s) => s.owned.length);
  const visible = decks
    .filter(
      (d) =>
        !!d.deletedAt === trash &&
        `${d.title} ${d.format} ${d.kind}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => sortBy === "name" ? a.title.localeCompare(b.title)
      : sortBy === "cards" ? b.cards.reduce((n,c)=>n+c.quantity,0) - a.cards.reduce((n,c)=>n+c.quantity,0)
      : b.updatedAt - a.updatedAt);
  const groups = groupBy === "list"
    ? [{ title: "Decks e listas", entries: visible }]
    : (["wishlist", "collection", "none"] as ListLabel[]).map(label => ({
        title: LABEL_NAMES[label], entries: visible.filter(d => labelOf(d) === label),
      })).filter(group => group.entries.length);
  async function restore(d: HubDeck) {
    try {
      if (d.shareId)
        await api(
          "shares/" + d.shareId,
          "PUT",
          { restore: true },
          d.ownerToken,
        );
      useHubStore.getState().restore(d.id);
      setMessage(
        d.shareId ? "Deck restaurado. O link voltou a funcionar sem aparecer na galeria." : "Deck restaurado em Meus decks.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function capture(list: "wishlist" | "owned") {
    const source = useDeckStore.getState();
    const cards = list === "wishlist" ? source.wishlist : source.owned;
    const d = makeDeck(
      list === "wishlist" ? "Minha wishlist" : "Minha coleção",
      fromCards(cards),
      list === "wishlist" ? "wishlist" : "collection",
    );
    useHubStore.getState().save(d);
    setMessage("Lista do Swiper salva em Meus decks.");
  }
  return (
    <HubLayout>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="hub-eyebrow">SUA BIBLIOTECA</p>
          <h1 className="text-3xl font-bold">Meus decks</h1>
          <p className="mt-2 text-sm text-slate-400">
            {user
              ? "Seus decks e listas, com cópia na conta."
              : "Salvos neste navegador. Use uma conta ou baixe um backup para levar a outro aparelho."}
          </p>
        </div>
        <Link className={button} to="/decks/new">
          + Importar ou criar deck
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/swipe" className={ghost}>
          Descobrir cartas
        </Link>
        <button
          className={ghost}
          disabled={!wishlistCount}
          onClick={() => capture("wishlist")}
        >
          Salvar wishlist do Swiper
        </button>
        <button
          className={ghost}
          disabled={!ownedCount}
          onClick={() => capture("owned")}
        >
          Salvar coleção do Swiper
        </button>
      </div>
      <div className="flex gap-2">
        <input
          className={field}
          aria-label="Buscar meus decks"
          placeholder="Buscar por nome ou formato"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className={ghost} onClick={() => setTrash(!trash)}>
          {trash ? "Voltar aos decks" : "Lixeira"}
        </button>
      </div>
      {message && (
        <p role="status" className="text-sm text-indigo-200">
          {message}
        </p>
      )}
      {!visible.length && (
        <div className={panel + " space-y-3"}>
          <h2 className="font-semibold">
            {trash
              ? "A lixeira está vazia"
              : query
                ? "Nenhum deck encontrado"
                : "Comece com uma lista que você já joga"}
          </h2>
          <p className="text-sm text-slate-400">
            {trash
              ? "Decks excluídos podem ser restaurados aqui."
              : "Cole uma lista do Arena, importe um arquivo TXT ou salve suas escolhas do Swiper."}
          </p>
          {!trash && (
            <Link className={button} to="/decks/new">
              Importar deck
            </Link>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-slate-400">Agrupar
          <select className={field + " mt-1"} value={groupBy} onChange={e=>setGroupBy(e.target.value as typeof groupBy)}>
            <option value="list">Por lista/deck</option>
            <option value="label">Por classificação</option>
          </select>
        </label>
        <label className="text-xs text-slate-400">Ordenar
          <select className={field + " mt-1"} value={sortBy} onChange={e=>setSortBy(e.target.value as typeof sortBy)}>
            <option value="updated">Mais recente</option>
            <option value="name">Nome A–Z</option>
            <option value="cards">Número de cartas</option>
          </select>
        </label>
        <Link className={ghost} to="/print">Escolher versões e imprimir</Link>
      </div>
      {groups.map(group => <section key={group.title} className="space-y-3">
        <h2 className="text-sm font-semibold text-indigo-200">{group.title}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
        {group.entries.map((d) => (
          <article key={d.id} className={panel + " flex gap-4"}>
            {d.cards.find((c) => c.image)?.image && (
              <img
                className="h-28 w-20 rounded-lg object-cover"
                src={d.cards.find((c) => c.image)!.image}
                alt=""
                loading="lazy"
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-lg font-semibold">{d.title}</h3>
              {!trash && <label className="block text-xs text-slate-400">Classificação
                <select className={field + " mt-1 !py-1"} value={labelOf(d)}
                  onChange={e=>useHubStore.getState().save({...d,label:e.target.value as ListLabel,updatedAt:Date.now()})}>
                  <option value="none">Nenhum</option>
                  <option value="wishlist">Wishlist</option>
                  <option value="collection">Coleção</option>
                </select>
              </label>}
              <p className="my-2 text-xs text-slate-400">
                {d.format} · {d.cards.reduce((n, c) => n + c.quantity, 0)}{" "}
                cartas
                <br />
                {d.shareId
                  ? d.publishedPublic
                    ? "Publicado na galeria"
                    : "Acesso pelo link"
                  : "Só você"}{" "}
                · {new Date(d.updatedAt).toLocaleDateString("pt-BR")}
              </p>
              {trash ? (
                <button className={ghost} onClick={() => void restore(d)}>
                  Restaurar deck
                </button>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button className={button} type="button" disabled={openingId !== null} onClick={() => void resume(d)}>
                    {openingId === d.id ? 'Carregando…' : d.swiper ? 'Retomar Swiper' : 'Abrir no Swiper'}
                  </button>
                  <Link className={ghost} to={"/decks/" + d.id}>Editar</Link>
                </div>
              )}
            </div>
          </article>
        ))}
        </div>
      </section>)}
    </HubLayout>
  );
}

export function DeckEditor() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const decks = useHubStore((s) => s.decks);
  const existing = decks.find((d) => d.id === id && !d.deletedAt);
  const [draft, setDraft] = useState<HubDeck>(() => existing || makeDeck());
  const [text, setText] = useState(() => listText(existing?.cards || []));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPublic, setShowPublic] = useState(
    existing?.publishedPublic || false,
  );
  const [stores, setStores] = useState(search.has("stores"));
  const [preview, setPreview] = useState<HubCard | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [manualCopy, setManualCopy] = useState("");
  const isNew = id === "new";
  const dirty =
    text !== listText(existing?.cards || []) ||
    draft.title !== existing?.title ||
    draft.format !== existing?.format ||
    draft.nickname !== existing?.nickname ||
    draft.kind !== existing?.kind ||
    labelOf(draft) !== (existing ? labelOf(existing) : "none");
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty && text.trim()) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, text]);
  function save(): HubDeck {
    if (!draft.title.trim()) throw new Error("Dê um nome ao deck.");
    const parsed = parseHubList(text);
    const cards = parsed.map((c) => ({
      ...draft.cards.find(
        (old) =>
          old.name === c.name &&
          old.setCode === c.setCode &&
          old.collectorNumber === c.collectorNumber,
      ),
      ...c,
    }));
    const d = {
      ...draft,
      title: draft.title.trim(),
      cards,
      updatedAt: Date.now(),
    };
    useHubStore.getState().save(d);
    useHubStore.getState().setNickname(d.nickname);
    setDraft(d);
    setText(listText(cards));
    return d;
  }
  async function run(job: () => Promise<void> | void) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await job();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (
        isNew &&
        window.location.pathname === "/decks/new" &&
        useHubStore.getState().decks.some((d) => d.id === draft.id)
      )
        navigate("/decks/" + draft.id, { replace: true });
    }
  }
  async function resolve(d: HubDeck): Promise<HubDeck> {
    const { cards, notFound } = await fetchHubCards(d.cards);
    const unresolved: string[] = [...notFound];
    const enriched = d.cards.map((c) => {
      const result = cards.find((x) => {
        const sameName =
          x.name.toLowerCase() === c.name.toLowerCase() ||
          x.name.split(" // ")[0].toLowerCase() === c.name.toLowerCase();
        return (
          sameName &&
          (!c.setCode || c.setCode === x.setCode) &&
          (!c.collectorNumber || c.collectorNumber === x.collectorNumber)
        );
      });
      if (!result) {
        unresolved.push(c.name);
        return { ...c, image: undefined, details: undefined };
      }
      return {
        ...c,
        name: result.name,
        image: result.image || undefined,
        oracleId: result.oracleId,
        setCode: result.setCode,
        collectorNumber: result.collectorNumber,
        details: result,
      };
    });
    const next = { ...d, cards: enriched, updatedAt: Date.now() };
    useHubStore.getState().save(next);
    setDraft(next);
    setText(listText(enriched));
    setMessage(
      unresolved.length
        ? `Deck salvo. Não encontramos: ${[...new Set(unresolved)].join(", ")}. Essas cartas continuam na lista.`
        : "Deck salvo com imagens e versões.",
    );
    return next;
  }
  async function shareDeck() {
    let d = save();
    if (!d.cards.length)
      throw new Error("Adicione cartas antes de compartilhar.");
    if (d.cards.some((c) => !c.image)) {
      try {
        d = await resolve(d);
      } catch {
        /* Publishing text-only cards still works. */
      }
    }
    d = await publish(d, showPublic);
    setDraft(d);
    setMessage(
      showPublic
        ? "Link atualizado e deck publicado em Explorar."
        : "Link pronto. Somente quem receber o link poderá ver.",
    );
  }
  async function removeDeck() {
    if (draft.shareId)
      await api(
        "shares/" + draft.shareId,
        "DELETE",
        undefined,
        draft.ownerToken,
      );
    useHubStore
      .getState()
      .save({ ...draft, deletedAt: Date.now(), updatedAt: Date.now() });
    navigate("/decks");
  }
  if (!isNew && !existing)
    return (
      <HubLayout>
        <h1 className="text-2xl font-bold">
          Deck não encontrado neste aparelho
        </h1>
        <p>Entre na sua conta ou restaure o deck pela lixeira.</p>
        <Link to="/decks" className={button}>
          Meus decks
        </Link>
      </HubLayout>
    );
  const shareUrl = draft.shareId
    ? window.location.origin + "/share/" + draft.shareId
    : "";
  const savedCards = draft.cards;
  return (
    <HubLayout wide>
      <div>
        <Link to="/decks" className="text-sm text-indigo-300">
          ← Meus decks
        </Link>
        <h1 className="mt-3 text-3xl font-bold">
          {isNew ? "Importar ou criar deck" : draft.title}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {isNew
            ? "Cole a lista, confira as cartas e salve. Depois escolha como compartilhar."
            : "Edite sua lista aqui e leve o mesmo deck para as outras ferramentas."}
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
        <section className={panel + " space-y-4"}>
          <label className="block text-sm">
            Nome do deck
            <input
              className={field + " mt-2"}
              value={draft.title}
              maxLength={90}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              Formato
              <select
                className={field + " mt-2"}
                value={draft.format}
                onChange={(e) => setDraft({ ...draft, format: e.target.value })}
              >
                {[
                  "Commander",
                  "Modern",
                  "Standard",
                  "Historic",
                  "Brawl",
                  "Pioneer",
                  "Pauper",
                  "Legacy",
                  "Livre",
                ].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Classificação da lista
              <select className={field + " mt-2"} value={labelOf(draft)}
                onChange={e=>setDraft({...draft,label:e.target.value as ListLabel})}>
                <option value="none">Nenhum</option>
                <option value="wishlist">Wishlist</option>
                <option value="collection">Coleção</option>
              </select>
            </label>
          </div>
          <label className="block text-sm">
            Lista de cartas
            <textarea
              className={field + " hub-deck-text mt-2"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                "Commander\n1 Nome do comandante\n\nDeck\n33 Island\n1 Sol Ring (CMM) 396"
              }
            />
          </label>
          <p className="text-xs text-slate-400">
            Formato: quantidade + nome. Aceita Commander, Deck, Sideboard e
            versões (SET) número. Main, Side e Maybe são seções independentes; quantidades são preservadas.
          </p>
          <label className={ghost + " cursor-pointer"}>
            Importar arquivo TXT
            <input
              className="sr-only"
              type="file"
              accept=".txt,.dec,.dek,text/plain"
              aria-label="Importar arquivo de deck"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  if (file.size > 150000) {
                    setError("Use arquivo de até 150 KB.");
                    return;
                  }
                  void file.text().then(setText);
                }
              }}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className={button}
              disabled={busy}
              onClick={() =>
                void run(() => {
                  save();
                  setMessage("Deck salvo neste aparelho.");
                })
              }
            >
              {busy ? "Aguarde…" : "Salvar deck"}
            </button>
            <button
              className={ghost}
              disabled={busy || !text.trim()}
              onClick={() =>
                void run(async () => {
                  await resolve(save());
                })
              }
            >
              Carregar imagens
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {dirty ? "Há alterações para salvar." : "Alterações salvas."}{" "}
            {useAccount.getState().user
              ? useAccount.getState().status
              : "Sem conta, os decks ficam neste navegador."}
          </p>
        </section>
        <div className="space-y-5">
          <section className={panel + " space-y-4"}>
            <h2 className="text-lg font-semibold">Compartilhar</h2>
            <p className="text-sm text-slate-400">
              Crie um link para enviar. A galeria é opcional; o link mantém o
              mesmo endereço quando você atualiza.
            </p>
            <label className="block text-sm">
              Seu nick público
              <input
                className={field + " mt-2"}
                value={draft.nickname}
                maxLength={40}
                onChange={(e) =>
                  setDraft({ ...draft, nickname: e.target.value })
                }
                placeholder="Jogador"
              />
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={showPublic}
                onChange={(e) => setShowPublic(e.target.checked)}
                className="mt-1"
              />
              Também mostrar em Explorar decks
            </label>
            <button
              className={button}
              disabled={busy || !text.trim()}
              onClick={() => void run(shareDeck)}
            >
              {draft.shareId
                ? "Atualizar link e visibilidade"
                : "Criar link para compartilhar"}
            </button>
            {shareUrl && (
              <div className="space-y-3">
                <input
                  readOnly
                  className={field}
                  aria-label="Link compartilhável"
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    className={ghost}
                    onClick={() =>
                      void run(async () => setMessage(await copy(shareUrl)))
                    }
                  >
                    Copiar link
                  </button>
                  <a
                    className={ghost}
                    href={
                      "https://wa.me/?text=" +
                      encodeURIComponent(draft.title + " " + shareUrl)
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp
                  </a>
                  <Link className={ghost} to={"/share/" + draft.shareId}>
                    Ver compartilhado
                  </Link>
                </div>
                <button
                  className="text-sm text-rose-300 underline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api(
                        "shares/" + draft.shareId,
                        "DELETE",
                        undefined,
                        draft.ownerToken,
                      );
                      const d = {
                        ...draft,
                        shareId: undefined,
                        ownerToken: undefined,
                        publishedPublic: false,
                        updatedAt: Date.now(),
                      };
                      useHubStore.getState().save(d);
                      setDraft(d);
                      setShowPublic(false);
                      setMessage(
                        "Link desativado. O deck continua em Meus decks.",
                      );
                    })
                  }
                >
                  Desativar link e retirar da galeria
                </button>
              </div>
            )}
          </section>
          <section className={panel + " space-y-3"}>
            <h2 className="text-lg font-semibold">Usar este deck</h2>
            <div className="flex flex-wrap gap-2">
              <button
                className={ghost}
                disabled={busy || !text.trim()}
                onClick={() =>
                  void run(async () => {
                    const d = save();
                    const output = listText(d.cards);
                    try {
                      setMessage(await copy(output));
                      setManualCopy("");
                    } catch (err) {
                      setManualCopy(output);
                      throw err;
                    }
                  })
                }
              >
                Copiar lista
              </button>
              <button
                className={ghost}
                disabled={busy || !text.trim()}
                onClick={() =>
                  void run(() => {
                    const d = save();
                    download(d.title + ".txt", listText(d.cards));
                    setMessage("Download iniciado.");
                  })
                }
              >
                Baixar TXT
              </button>
              <button
                className={ghost}
                disabled={busy || !text.trim()}
                onClick={() =>
                  void run(() => {
                    save();
                    setStores(true);
                  })
                }
              >
                Links de lojas
              </button>
              <button
                className={ghost}
                disabled={busy || !text.trim()}
                onClick={() =>
                  void run(() => {
                    const d = save();
                    navigate("/print?deck=" + d.id);
                  })
                }
              >
                Imprimir / PDF
              </button>
              <button
                className={ghost}
                disabled={busy || !text.trim()}
                onClick={() =>
                  void run(async () => {
                    const d = await resolve(save());
                    const active = useHubStore.getState().activeDeckId;
                    if (active && active !== d.id) persistSwiperDeck(active);
                    loadSwiperDeck(d);
                    navigate("/swipe");
                  })
                }
              >
                Descobrir cartas para este deck
              </button>
            </div>
          </section>
          {!isNew && (
            <section className="flex flex-wrap gap-3">
              <button
                className={ghost}
                onClick={() => {
                  const d = {
                    ...draft,
                    id: crypto.randomUUID(),
                    title: draft.title + " (cópia)",
                    shareId: undefined,
                    ownerToken: undefined,
                    publishedPublic: false,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  };
                  useHubStore.getState().save(d);
                  navigate("/decks/" + d.id);
                }}
              >
                Duplicar deck
              </button>
              <button
                className="text-sm text-rose-300 underline"
                onClick={() => setConfirmDelete(true)}
              >
                Excluir deck
              </button>
            </section>
          )}
          {confirmDelete && (
            <div
              role="dialog"
              aria-label="Excluir deck"
              className={panel + " space-y-3"}
            >
              <p>
                Mover este deck para a lixeira? O link será desativado e ele
                sairá da galeria.
              </p>
              <button
                className={button}
                disabled={busy}
                onClick={() => void run(removeDeck)}
              >
                Mover para lixeira
              </button>{" "}
              <button className={ghost} onClick={() => setConfirmDelete(false)}>
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-xl bg-indigo-500/15 p-3 text-sm text-indigo-200"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-200"
        >
          {error}
        </p>
      )}
      {manualCopy && (
        <textarea
          className={field}
          aria-label="Lista para copiar manualmente"
          readOnly
          value={manualCopy}
          onFocus={(e) => e.target.select()}
        />
      )}
      {savedCards.length > 0 && (
        <section className={panel}>
          <h2 className="mb-4 text-lg font-semibold">
            {savedCards.reduce((n, c) => n + c.quantity, 0)} cartas ·{" "}
            {savedCards.length} entradas
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {savedCards.map((c, i) => (
              <button
                key={i}
                className="text-left"
                onClick={() => setPreview(c)}
                aria-label={"Ver " + c.name}
              >
                {c.image ? (
                  <img
                    src={c.image}
                    alt={c.name}
                    className="w-full rounded-lg"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-[5/7] items-center justify-center rounded-lg bg-indigo-500/10 p-3 text-center text-sm">
                    {c.name}
                  </div>
                )}
                <p className="mt-2 text-xs">
                  {c.quantity}× {c.name}
                </p>
                <p className="text-[10px] text-slate-500">
                  {c.section === "commander"
                    ? "Comandante"
                    : c.section === "sideboard"
                      ? "Sideboard"
                      : ""}{" "}
                  {c.setCode?.toUpperCase()} {c.collectorNumber}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}
      {preview && (
        <div
          className="hub-modal"
          role="dialog"
          aria-modal="true"
          aria-label={preview.name}
        >
          <div className="hub-modal-body">
            <button className={ghost} onClick={() => setPreview(null)}>
              Fechar carta
            </button>
            {preview.image && (
              <img
                src={preview.image}
                alt={preview.name}
                className="mx-auto max-h-[55vh] rounded-xl"
              />
            )}
            <h2 className="text-lg font-bold">{preview.name}</h2>
            <p className="whitespace-pre-wrap text-sm">
              {preview.details?.oracleText}
            </p>
            <a
              href={toCard(preview).scryfallUri}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-300 underline"
            >
              Abrir no Scryfall
            </a>
          </div>
        </div>
      )}
      {stores && (
        <CardTutorExport
          cards={savedCards.map((c) => ({
            ...toCard(c),
            addedAt: draft.createdAt,
          }))}
          onClose={() => setStores(false)}
        />
      )}
    </HubLayout>
  );
}
