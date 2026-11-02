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
} from "../deck/hubStore";
import type { HubDeck, HubCard } from "../deck/hubStore";
import { api, copy, download, publish, useAccount } from "../deck/hubApi";
import { useDeckStore } from "../deck/deckStore";
import {
  DEFAULT_CONFIG,
  type DeckFormat,
  fetchHubCards,
} from "../deck/scryfall";
import { CardTutorExport } from "../components/CardTutorExport";

export function MyDecks() {
  const decks = useHubStore((s) => s.decks);
  const [query, setQuery] = useState("");
  const [trash, setTrash] = useState(false);
  const [message, setMessage] = useState("");
  const user = useAccount((s) => s.user);
  const wishlistCount = useDeckStore((s) => s.deck.length);
  const ownedCount = useDeckStore((s) => s.owned.length);
  const visible = decks
    .filter(
      (d) =>
        !!d.deletedAt === trash &&
        `${d.title} ${d.format} ${d.kind}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
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
        "Deck restaurado. O link voltou a funcionar sem aparecer na galeria.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function capture(list: "wishlist" | "owned") {
    const source = useDeckStore.getState();
    const cards = list === "wishlist" ? source.deck : source.owned;
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
      <div className="grid gap-3 sm:grid-cols-2">
        {visible.map((d) => (
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
              <h2 className="break-words text-lg font-semibold">{d.title}</h2>
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
                <Link className={ghost} to={"/decks/" + d.id}>
                  Abrir deck
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
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
    draft.kind !== existing?.kind;
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
      if (isNew && window.location.pathname === '/decks/new' && useHubStore.getState().decks.some(d=>d.id===draft.id)) navigate('/decks/'+draft.id,{replace:true});
    }
  }
  async function resolve(d: HubDeck): Promise<HubDeck> {
    const { cards, notFound } = await fetchHubCards(d.cards);
    const enriched = d.cards.map((c) => {
      const result = cards.find(
        (x) =>
          x.name.toLowerCase() === c.name.toLowerCase() ||
          x.name.split(" // ")[0].toLowerCase() === c.name.toLowerCase() ||
          (c.setCode === x.setCode &&
            c.collectorNumber &&
            c.collectorNumber === x.collectorNumber),
      );
      return result
        ? {
            ...c,
            name: result.name,
            image: result.image || undefined,
            oracleId: result.oracleId,
            setCode: c.setCode || result.setCode,
            collectorNumber: c.collectorNumber || result.collectorNumber,
            details: result,
          }
        : c;
    });
    const next = { ...d, cards: enriched, updatedAt: Date.now() };
    useHubStore.getState().save(next);
    setDraft(next);
    setText(listText(enriched));
    setMessage(
      notFound.length
        ? `Deck salvo. Não encontramos: ${notFound.join(", ")}. Essas cartas continuam na lista.`
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
              Tipo
              <select
                className={field + " mt-2"}
                value={draft.kind}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    kind: e.target.value as HubDeck["kind"],
                  })
                }
              >
                <option value="deck">Deck</option>
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
            versões (SET) número. Quantidades são preservadas.
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
                    setManualCopy(output);
                    setMessage(await copy(output));
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
                    const source = useDeckStore.getState();
                    source.saveRevision("Antes de abrir " + d.title);
                    useDeckStore.setState({
                      deck: [],
                      commander: null,
                      rejected: [],
                      config: {
                        ...DEFAULT_CONFIG,
                        format: ({
                          Commander: "commander",
                          Modern: "modern",
                          Standard: "standard",
                          Historic: "historic",
                          Brawl: "standardbrawl",
                          Pioneer: "pioneer",
                          Pauper: "pauper",
                          Legacy: "legacy",
                        }[d.format] || "commander") as DeckFormat,
                      },
                    });
                    source.importCards(
                      d.cards
                        .filter((c) => c.section !== "sideboard")
                        .map(toCard),
                    );
                    const commander = d.cards.find(
                      (c) => c.section === "commander",
                    );
                    if (commander) source.setCommander(toCard(commander));
                    useHubStore.getState().setActive(d.id);
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
