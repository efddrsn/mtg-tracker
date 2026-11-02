import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  useHubStore,
  makeDeck,
  listText,
  toCard,
  binderText,
  parseHubList,
} from "../deck/hubStore";
import type { HubCard } from "../deck/hubStore";
import {
  HubLayout,
  Brand,
  panel,
  field,
  button,
  ghost,
} from "../components/HubLayout";
import { api, copy, download } from "../deck/hubApi";
import { CardTutorExport } from "../components/CardTutorExport";

type GalleryItem = {
  id: string;
  title: string;
  nickname: string;
  count: number;
  image: string;
  createdAt: string;
};
type Share = {
  id: string;
  title: string;
  nickname: string;
  cards: HubCard[];
  public?: boolean;
  createdAt: string;
  deletedAt?: string;
};
const shell = "hub-page";
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
      {children}
    </span>
  );
}
export function EventHub() {
  const allDecks = useHubStore((s) => s.decks);
  const decks = allDecks.filter((d) => !d.deletedAt).slice(0, 3);
  const [status, setStatus] = useState("");
  return (
    <HubLayout>
      <section className="space-y-5 py-5">
        <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          Seu Magic,
          <br />
          <span className="text-indigo-300">num só lugar.</span>
        </h1>
        <p className="max-w-lg text-sm leading-relaxed text-slate-300">
          Seus decks, novas cartas e tudo para levar a lista à mesa. Importe uma
          vez e continue de onde parou.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link className={button} to="/decks/new">
            Importar meu deck
          </Link>
          <Link className={ghost} to="/decks">
            Meus decks
          </Link>
        </div>
      </section>
      <section>
        <div className="mb-3 flex justify-between">
          <h2 className="text-xl font-semibold">Ferramentas</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              to: "/swipe",
              icon: "✦",
              title: "Descobrir cartas",
              desc: "Descubra cartas para seus decks, organize pilhas e consulte lojas.",
            },
            {
              to: "/tracker",
              icon: "◎",
              title: "Tracker de partida",
              desc: "Vida, mana, storm, turnos e contadores na mesa.",
            },
            {
              to: "/print",
              icon: "▤",
              title: "Print Binder",
              desc: "Leve seu deck, escolha versões e gere PDFs.",
            },
            {
              to: "/community",
              icon: "↗",
              title: "Explorar decks",
              desc: "Abra listas compartilhadas e salve uma cópia sua.",
            },
          ].map((t) => (
            <Link
              className={
                panel +
                " flex flex-col gap-3 transition-colors hover:bg-white/10"
              }
              key={t.to}
              to={t.to}
            >
              <span className="text-2xl text-indigo-300">{t.icon}</span>
              <h3 className="font-semibold">{t.title}</h3>
              <p className="text-xs leading-relaxed text-slate-400">{t.desc}</p>
            </Link>
          ))}
        </div>
      </section>
      {!!decks.length && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Continuar um deck</h2>
          {decks.map((d) => (
            <Link
              className={panel + " flex items-center justify-between"}
              key={d.id}
              to={"/decks/" + d.id}
            >
              <span className="font-medium">{d.title}</span>
              <span className="text-xs text-slate-400">
                {d.cards.reduce((n, c) => n + c.quantity, 0)} cartas →
              </span>
            </Link>
          ))}
        </section>
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        <button
          className="text-indigo-300"
          onClick={() =>
            void copy(window.location.origin + "/")
              .then(setStatus)
              .catch((e: Error) => setStatus(e.message))
          }
        >
          Copiar link do app
        </button>
        <Link to="/feedback" className="text-slate-400">
          Novidades e feedback
        </Link>
      </div>
      {status && <p role="status">{status}</p>}
      <p className="text-[11px] text-slate-500">
        Projeto independente, não afiliado à Wizards of the Coast. Dados e
        imagens via Scryfall.
      </p>
    </HubLayout>
  );
}
export function Community() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    api<{ shares: GalleryItem[] }>("gallery")
      .then((d) => {
        if (active) setGallery(d.shares);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);
  const filtered = gallery.filter((s) =>
    (s.title + " " + s.nickname).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <HubLayout>
      <div>
        <p className="hub-eyebrow">IDEIAS DE OUTROS JOGADORES</p>
        <h1 className="text-3xl font-bold">Explorar decks</h1>
        <p className="mt-2 text-sm text-slate-400">
          Listas que seus autores escolheram publicar. Abra, copie ou adapte uma
          para você.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className={button} to="/decks/new">
          Importar meu deck
        </Link>
        <Link className={ghost} to="/decks">
          Gerenciar meus decks
        </Link>
      </div>
      <input
        className={field}
        aria-label="Buscar decks públicos"
        value={query}
        placeholder="Buscar por deck ou jogador"
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && <p role="status">Carregando decks…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button
            className={ghost}
            onClick={() => {
              setLoading(true);
              setError("");
              setAttempt(attempt + 1);
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}
      {!loading && !error && !filtered.length && (
        <p className={panel}>
          {query
            ? "Nenhum deck encontrado."
            : "Ainda não há decks publicados. Seus decks podem continuar privados até você decidir compartilhar."}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((s) => (
          <Link
            key={s.id}
            to={"/share/" + s.id}
            className={panel + " flex gap-4 hover:bg-white/10"}
          >
            {s.image && (
              <img
                src={s.image}
                alt=""
                loading="lazy"
                className="h-28 w-20 rounded-lg object-cover"
              />
            )}
            <div className="min-w-0">
              <h2 className="break-words font-semibold">{s.title}</h2>
              <p className="mt-2 text-xs text-slate-400">
                {s.nickname} · {s.count} cartas
              </p>
            </div>
          </Link>
        ))}
      </div>
    </HubLayout>
  );
}
export function SharedList() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [share, setShare] = useState<Share | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [stores, setStores] = useState(false);
  const [manual, setManual] = useState("");
  const own = useHubStore((s) =>
    s.decks.find((d) => d.shareId === id && !d.deletedAt),
  );
  useEffect(() => {
    let active = true;
    api<{ share: Share }>("shares/" + encodeURIComponent(id || ""))
      .then(({ share }) => {
        if (active)
          setShare({
            ...share,
            cards: share.cards.map((c) => ({
              ...c,
              quantity: c.quantity || 1,
              section: c.section || "main",
            })),
          });
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  function saveCopy(print = false) {
    if (!share) return;
    const d = {
      ...makeDeck(share.title, share.cards),
      nickname: share.nickname,
    };
    useHubStore.getState().save(d);
    navigate(print ? "/print?deck=" + d.id : "/decks/" + d.id);
  }
  return (
    <HubLayout>
      <Link className="text-sm text-indigo-300" to="/community">
        ← Explorar decks
      </Link>
      {error && (
        <div className={panel} role="alert">
          <h1 className="text-xl font-bold">Este link não está disponível</h1>
          <p className="mt-2 text-sm text-slate-400">
            Ele pode ter sido desativado ou removido pelo autor.
          </p>
          <Link className={ghost + " mt-4"} to="/decks">
            Meus decks
          </Link>
        </div>
      )}
      {!share && !error && <p role="status">Carregando deck…</p>}
      {share && (
        <>
          <div>
            <p className="hub-eyebrow">DECK COMPARTILHADO</p>
            <h1 className="text-3xl font-bold">{share.title}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {share.nickname} ·{" "}
              {share.cards.reduce((n, c) => n + c.quantity, 0)} cartas
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {own ? (
              <Link className={button} to={"/decks/" + own.id}>
                Editar meu deck
              </Link>
            ) : (
              <button className={button} onClick={() => saveCopy()}>
                Salvar uma cópia em Meus decks
              </button>
            )}
            <button
              className={ghost}
              onClick={() =>
                void copy(window.location.href)
                  .then(setStatus)
                  .catch((e: Error) => setStatus(e.message))
              }
            >
              Copiar link
            </button>
            <button
              className={ghost}
              onClick={() => {
                void copy(listText(share.cards))
                  .then((message) => {
                    setStatus(message);
                    setManual("");
                  })
                  .catch((e: Error) => {
                    setManual(listText(share.cards));
                    setStatus(e.message);
                  });
              }}
            >
              Copiar lista
            </button>
            <button
              className={ghost}
              onClick={() => {
                download(share.title + ".txt", listText(share.cards));
                setStatus("Download iniciado.");
              }}
            >
              Baixar TXT
            </button>
            <button className={ghost} onClick={() => setStores(true)}>
              Links de lojas
            </button>
            <button
              className={ghost}
              onClick={() =>
                own ? navigate("/print?deck=" + own.id) : saveCopy(true)
              }
            >
              Imprimir / PDF
            </button>
          </div>
          {status && (
            <p role="status" className="text-sm text-indigo-200">
              {status}
            </p>
          )}
          {manual && (
            <textarea
              className={field}
              readOnly
              aria-label="Lista para copiar"
              value={manual}
              onFocus={(e) => e.target.select()}
            />
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {share.cards.map((c, i) => (
              <a
                href={toCard(c).scryfallUri}
                target="_blank"
                rel="noreferrer"
                key={i}
                className="space-y-2"
              >
                {c.image ? (
                  <img
                    src={c.image}
                    loading="lazy"
                    alt={c.name}
                    className="w-full rounded-lg"
                  />
                ) : (
                  <div className="flex aspect-[5/7] items-center justify-center rounded-lg bg-indigo-500/10 p-3 text-center text-sm">
                    {c.name}
                  </div>
                )}
                <p className="text-xs">
                  {c.quantity}× {c.name}
                </p>
                <p className="text-[10px] text-slate-500">
                  {c.section === "commander"
                    ? "Comandante · "
                    : c.section === "sideboard"
                      ? "Sideboard · "
                      : ""}
                  {c.setCode?.toUpperCase()} {c.collectorNumber}
                </p>
              </a>
            ))}
          </div>
          {stores && (
            <CardTutorExport
              cards={share.cards.map((c) => ({ ...toCard(c), addedAt: 0 }))}
              onClose={() => setStores(false)}
            />
          )}
        </>
      )}
    </HubLayout>
  );
}
export function PrintBinder() {
  const [search] = useSearchParams();
  const decks = useHubStore((s) => s.decks);
  const available = decks.filter(d=>!d.deletedAt);
  const [selectedId,setSelectedId] = useState(search.get("deck") || "");
  const d = available.find(d=>d.id===selectedId);
  const [zone,setZone] = useState<"all" | "main" | "sideboard" | "maybe">("all");
  const selectedCards = d?.cards.filter(c=>zone==="all" || c.section===zone || (zone==="main"&&c.section==="commander")) || [];
  const frame = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState("");
  const fill = () => {
    if (!d) return;
    try {
      const input =
        frame.current?.contentDocument?.querySelector<HTMLTextAreaElement>(
          "textarea",
        );
      if (input) {
        const name =
          frame.current?.contentDocument?.querySelector<HTMLInputElement>(
            "#binder-name",
          );
        if (name) {
          name.value = d.title;
          name.dispatchEvent(new Event("input", { bubbles: true }));
        }
        input.value = binderText(selectedCards);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        setStatus(
          "Deck carregado no Binder. Confira a lista e avance para escolher versões.",
        );
      } else
        setStatus(
          "O Binder ainda está carregando. Tente carregar o deck novamente.",
        );
    } catch {
      setStatus("Copie a lista e cole no campo do Binder.");
    }
  };
  useEffect(() => {
    if (d) fill();
  }, [selectedId,zone]);
  return (
    <div className="hub-page flex h-full flex-col">
      <Brand />
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3 text-xs">
        <Link className="text-indigo-300" to={d ? "/decks/" + d.id : "/decks"}>
          ← {d ? d.title : "Meus decks"}
        </Link>
        <strong className="text-indigo-200">Print Studio</strong>
        <select aria-label="Escolher deck ou lista" className={field + " !w-auto !py-2"} value={selectedId}
          onChange={e=>setSelectedId(e.target.value)}>
          <option value="">Selecione um deck/lista</option>
          {available.map(deck=><option value={deck.id} key={deck.id}>{deck.title}</option>)}
        </select>
        <select aria-label="Seção para imprimir" className={field + " !w-auto !py-2"} value={zone}
          onChange={e=>setZone(e.target.value as typeof zone)}>
          <option value="all">Todas as seções</option>
          <option value="main">Main + comandante</option>
          <option value="sideboard">Side</option>
          <option value="maybe">Maybe</option>
        </select>
        {d && (
          <>
            <button className={ghost} onClick={fill}>
              Carregar deck no Binder
            </button>
            <button
              className={ghost}
              onClick={() =>
                void copy(listText(selectedCards))
                  .then(setStatus)
                  .catch((e: Error) => setStatus(e.message))
              }
            >
              Copiar lista
            </button>
          </>
        )}
        <a
          className="text-indigo-300 underline"
          href="/binder/"
          target="_blank"
          rel="noreferrer"
        >
          Tela cheia
        </a>
        {status && (
          <p role="status" className="w-full text-indigo-200">
            {status}
          </p>
        )}
      </div>
      <iframe
        ref={frame}
        title="Print Binder"
        src="/binder/"
        onLoad={() => {
          const doc = frame.current?.contentDocument;
          doc?.addEventListener(
            "click",
            (event) => {
              const target = event.target as HTMLElement;
              if (!target.closest("#direct-generate, #prepare-button")) return;
              const input =
                doc.querySelector<HTMLTextAreaElement>("#card-list");
              if (!input) return;
              try {
                input.value = binderText(parseHubList(input.value));
                input.dispatchEvent(new Event("input", { bubbles: true }));
              } catch (err) {
                event.preventDefault();
                event.stopImmediatePropagation();
                setStatus((err as Error).message);
              }
            },
            { capture: true },
          );
          fill();
        }}
        className="min-h-0 w-full flex-1 border-0"
      />
    </div>
  );
}
export function Feedback() {
  const [message, setMessage] = useState("");
  const [feature, setFeature] = useState("Geral");
  const [rating, setRating] = useState("5");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  async function send(e: FormEvent, register = false) {
    e.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      await api(
        register ? "register" : "feedback",
        "POST",
        register
          ? { name, email, consent }
          : { message, feature, rating: Number(rating) },
      );
      setStatus(
        register
          ? "Cadastro de novidades recebido. Isso não cria uma conta de acesso."
          : "Feedback enviado. Obrigado!",
      );
      if (!register) setMessage("");
    } catch (e) {
      setStatus((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <HubLayout>
      <h1 className="text-3xl font-bold">Ajude a melhorar</h1>
      <form className={panel + " space-y-4"} onSubmit={(e) => void send(e)}>
        <label className="block text-sm">
          Ferramenta
          <select
            className={field + " mt-2"}
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
          >
            {[
              "Geral",
              "Meus decks",
              "Swiper",
              "Tracker",
              "Print Binder",
              "Lojas",
              "Compartilhamento",
              "Conta",
            ].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Nota
          <select
            className={field + " mt-2"}
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          O que você mudaria?
          <textarea
            className={field + " mt-2 min-h-28"}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            minLength={8}
            maxLength={1500}
          />
        </label>
        <button className={button} disabled={busy}>
          Enviar feedback
        </button>
      </form>
      <details className={panel}>
        <summary className="cursor-pointer font-semibold">
          Receber novidades por email (opcional)
        </summary>
        <form className="mt-4 space-y-4" onSubmit={(e) => void send(e, true)}>
          <label className="block text-sm">
            Nome
            <input
              className={field + " mt-2"}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={90}
            />
          </label>
          <label className="block text-sm">
            Email
            <input
              className={field + " mt-2"}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
            />
          </label>
          <label className="flex gap-2 text-xs">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            Autorizo contato sobre o projeto. Meus dados não serão publicados.
          </label>
          <button className={ghost} disabled={busy || !consent}>
            Receber novidades
          </button>
        </form>
      </details>
      {status && <p role="status">{status}</p>}
    </HubLayout>
  );
}
export function EventAdmin() {
  const [secret, setSecret] = useState("");
  const [data, setData] = useState<{
    leads: {
      name: string;
      email: string;
      nickname: string;
      createdAt: string;
    }[];
    feedback: {
      message: string;
      feature: string;
      rating: number;
      createdAt: string;
    }[];
    shares: Share[];
  } | null>(null);
  const [error, setError] = useState("");
  async function loadAdmin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      const r = await fetch("/api/event/admin", {
        headers: { "x-admin-key": secret },
        cache: "no-store",
      });
      if (!r.ok) throw new Error("Acesso negado ou falha na conexão.");
      setData(await r.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro.");
    }
  }
  async function moderateShare(id: string, restore = false) {
    setError("");
    try {
      const response = await fetch("/api/event/shares/" + id, {
        method: restore ? "PUT" : "DELETE",
        headers: { "x-admin-key": secret, "Content-Type": "application/json" },
        body: restore ? JSON.stringify({ restore: true }) : undefined,
      });
      if (!response.ok)
        throw new Error("Não foi possível alterar esta publicação.");
      const fresh = await fetch("/api/event/admin", {
        headers: { "x-admin-key": secret },
        cache: "no-store",
      });
      if (!fresh.ok) throw new Error("Não foi possível atualizar a lista.");
      setData(await fresh.json());
    } catch (err) {
      setError((err as Error).message);
    }
  }
  function exportData() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "magic-hub-event.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className={shell}>
      <Brand />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <h1 className="text-2xl font-bold">Área do organizador</h1>
        <form onSubmit={(e) => void loadAdmin(e)} className="flex gap-2">
          <input
            className={field}
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Chave de administração"
            aria-label="Chave de administração"
          />
          <button className={button}>Entrar</button>
        </form>
        {error && (
          <p role="alert" className="text-rose-300">
            {error}
          </p>
        )}
        {data && (
          <>
            <div className="flex flex-wrap gap-3">
              <Pill>{data.leads.length} cadastros</Pill>
              <Pill>{data.feedback.length} feedbacks</Pill>
              <Pill>{data.shares.length} listas</Pill>
            </div>
            <button className={button} onClick={exportData}>
              Baixar todos os dados (JSON)
            </button>
            <h2 className="text-xl font-semibold">Gerenciar publicações</h2>
            <p className="text-xs text-slate-400">
              Inclui links antigos do evento, que ainda não tinham controle de
              autor. Remover desativa o link e permite restaurar depois.
            </p>
            <div className="space-y-2">
              {data.shares
                .slice()
                .reverse()
                .map((x) => (
                  <div
                    key={x.id}
                    className={panel + " flex flex-wrap justify-between gap-3"}
                  >
                    <div>
                      <b>{x.title}</b>
                      <p className="text-xs text-slate-400">
                        {x.nickname} ·{" "}
                        {x.deletedAt
                          ? "Removido"
                          : x.public
                            ? "Público"
                            : "Não listado"}
                      </p>
                    </div>
                    <button
                      className={ghost}
                      onClick={() => void moderateShare(x.id, !!x.deletedAt)}
                    >
                      {x.deletedAt ? "Restaurar link" : "Remover publicação"}
                    </button>
                  </div>
                ))}
            </div>
            <h2 className="text-xl font-semibold">Cadastros</h2>
            <div className="space-y-2">
              {data.leads
                .slice()
                .reverse()
                .map((x) => (
                  <div key={x.email} className={panel}>
                    <b>{x.name}</b>
                    <p className="break-all text-sm text-slate-300">
                      {x.email}
                    </p>
                    <p className="text-xs text-slate-500">
                      {x.nickname} · {x.createdAt}
                    </p>
                  </div>
                ))}
            </div>
            <h2 className="text-xl font-semibold">Feedbacks</h2>
            <div className="space-y-2">
              {data.feedback
                .slice()
                .reverse()
                .map((x, i) => (
                  <div key={i} className={panel}>
                    <p>{x.message}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {x.feature} · nota {x.rating} · {x.createdAt}
                    </p>
                  </div>
                ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
