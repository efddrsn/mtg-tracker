import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDeckStore } from '../deck/deckStore';

type GalleryItem = { id: string; title: string; nickname: string; count: number; image: string; createdAt: string };
type SharedCard = { name: string; oracleId?: string; image?: string; setCode?: string; collectorNumber?: string };
type Share = { id: string; title: string; nickname: string; cards: SharedCard[]; createdAt: string };
const shell = 'min-h-screen w-full overflow-y-auto bg-[#0c0f18] text-white';
const panel = 'rounded-2xl border border-white/10 bg-white/[0.055] p-5';
const field = 'w-full rounded-xl border border-white/20 bg-black/30 px-3 py-3 text-sm text-white outline-none focus:border-indigo-400';
const button = 'rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50';
const ghost = 'rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-medium text-white hover:bg-white/20';

function Brand() {
  return <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
    <Link to="/" className="text-lg font-extrabold tracking-tight text-white">magic<span className="text-indigo-300">hub</span><span className="ml-2 text-[10px] font-semibold tracking-widest text-indigo-300">BETA</span></Link>
    <Link to="/community" className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white">Comunidade</Link>
  </header>;
}
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full border border-indigo-400/25 bg-indigo-400/10 px-2.5 py-1 text-xs font-medium text-indigo-200">{children}</span>;
}
function ToolCard({ to, label, desc, tag, children }: { to: string; label: string; desc: string; tag: string; children: React.ReactNode }) {
  return <Link to={to} className="flex min-h-36 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.065] p-4 transition-colors hover:bg-white/10">
    <div className="flex items-start justify-between gap-2"><span className="text-2xl">{children}</span><span className="text-[10px] font-medium text-emerald-300">{tag}</span></div>
    <div><div className="mt-4 text-base font-bold">{label}</div><p className="mt-1 text-xs leading-relaxed text-slate-400">{desc}</p></div>
  </Link>;
}
export function EventHub() {
  const wishlist = useDeckStore((s) => s.deck);
  const owned = useDeckStore((s) => s.owned);
  const commander = useDeckStore((s) => s.commander);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [consent, setConsent] = useState(false);
  const [registration, setRegistration] = useState('');
  const [feedback, setFeedback] = useState('');
  const [feature, setFeature] = useState('Geral');
  const [rating, setRating] = useState('5');
  const [feedbackStatus, setFeedbackStatus] = useState('');
  const [shareTitle, setShareTitle] = useState('');
  const [showPublic, setShowPublic] = useState(false);
  const [shareStatus, setShareStatus] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [hubShareStatus, setHubShareStatus] = useState('');
  async function shareHub() {
    const url = window.location.origin + '/';
    if (navigator.share) {
      try { await navigator.share({ title: 'Magic Hub — ferramentas gratuitas de MTG', url }); return; }
      catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); setHubShareStatus('Link do Magic Hub copiado!'); }
    catch { setHubShareStatus(url); }
  }

  async function register(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setRegistration('');
    try {
      const r = await fetch('/api/event/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, nickname, consent }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setRegistration('Cadastro recebido. Obrigado por participar!');
    } catch (err) { setRegistration(err instanceof Error ? err.message : 'Erro de conexão.'); }
    finally { setBusy(false); }
  }
  async function sendFeedback(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setFeedbackStatus('');
    try {
      const r = await fetch('/api/event/feedback', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: feedback, feature, rating: Number(rating) }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setFeedback(''); setFeedbackStatus('Feedback enviado. Obrigado!');
    } catch (err) { setFeedbackStatus(err instanceof Error ? err.message : 'Erro de conexão.'); }
    finally { setBusy(false); }
  }
  async function share(list: 'wishlist' | 'owned') {
    const cards = list === 'wishlist' ? wishlist : owned;
    if (!cards.length) { setShareStatus('Adicione cartas à sua lista no Swiper primeiro.'); return; }
    setBusy(true); setShareStatus(''); setShareUrl('');
    try {
      const r = await fetch('/api/event/shares', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: shareTitle.trim() || ((commander?.name || 'Meu deck') + ' — ' + (list === 'wishlist' ? 'wishlist' : 'coleção')),
          nickname, public: showPublic, cards: cards.map((c) => ({ name: c.name, oracleId: c.oracleId,
            image: c.image, setCode: c.setCode, collectorNumber: c.collectorNumber })) }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      const url = window.location.origin + '/share/' + data.id;
      setShareUrl(url); setShareStatus('Link público criado! Ele mostra apenas as cartas da lista.');
      if (navigator.share) {
        try { await navigator.share({ title: shareTitle || 'Meu deck', url }); } catch { /* dismiss */ }
      } else if (navigator.clipboard) { await navigator.clipboard.writeText(url).catch(() => {}); }
    } catch (err) { setShareStatus(err instanceof Error ? err.message : 'Erro ao compartilhar.'); }
    finally { setBusy(false); }
  }
  return <div className={shell}>
    <Brand />
    <main className="mx-auto max-w-3xl space-y-8 px-4 pb-16 pt-8 sm:px-6">
      <section className="space-y-4">
        <Pill>Grátis · Criado para jogadores · Early access</Pill>
        <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">Seu Magic, <span className="text-indigo-300">num só lugar.</span></h1>
        <p className="max-w-lg text-sm leading-relaxed text-slate-300">Descubra cartas, monte listas, consulte lojas e imprima seu binder. Use sem conta; cadastre-se se quiser acompanhar as novidades e participar da comunidade.</p>
        <div className="flex flex-wrap gap-2"><a href="#apps" className={button}>Explorar ferramentas</a><button type="button" onClick={() => void shareHub()} className={ghost}>Compartilhar app</button><a href="#cadastro" className={ghost}>Entrar na comunidade</a></div>{hubShareStatus && <p className="break-all text-xs text-indigo-300" role="status">{hubShareStatus}</p>}
      </section>
      <section id="apps" className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Ferramentas</h2><span className="text-xs text-slate-400">Sem cobrança por IA</span></div>
        <div className="grid grid-cols-2 gap-3">
          <ToolCard to="/swipe" label="Descobrir cartas" desc="Swipe, wishlist, coleção, preços e lojas." tag="GRÁTIS">✦</ToolCard>
          <ToolCard to="/tracker" label="Tracker de partida" desc="Vida, mana, storm, turnos e contadores." tag="GRÁTIS">◎</ToolCard>
          <ToolCard to="/print" label="Print Binder" desc="Escolha edições e gere binder em PDF." tag="GRÁTIS">▤</ToolCard>
          <ToolCard to="/community" label="Decks da comunidade" desc="Veja listas compartilhadas por jogadores." tag="NOVO">♧</ToolCard>
        </div>
      </section>
      <section className={panel + ' space-y-4'}>
        <div><Pill>Compartilhe no evento</Pill><h2 className="mt-3 text-xl font-bold">Compartilhe suas cartas</h2>
        <p className="mt-1 text-sm text-slate-400">Crie um link de uma lista do Swiper para enviar pelo WhatsApp ou copiar. Nenhum email é divulgado.</p></div>
        <div className="flex gap-3 text-sm"><span>Wishlist: <b>{wishlist.length}</b></span><span>Minhas cartas: <b>{owned.length}</b></span></div>
        <input className={field} value={shareTitle} onChange={(e) => setShareTitle(e.target.value)} maxLength={90} placeholder="Título da lista (opcional)" aria-label="Título da lista" />
        <input className={field} value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={40} placeholder="Seu nick (opcional)" aria-label="Seu nick" />
        <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={showPublic} onChange={(e) => setShowPublic(e.target.checked)} /> Mostrar esta lista na galeria pública da comunidade</label>
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => void share('wishlist')}>Compartilhar wishlist</button><button className={ghost} disabled={busy} onClick={() => void share('owned')}>Compartilhar coleção</button></div>
        {shareStatus && <p role="status" className="text-sm text-indigo-200">{shareStatus}</p>}
        {shareUrl && <div className="flex flex-wrap items-center gap-2"><a className="break-all text-sm text-sky-300 underline" href={shareUrl}>{shareUrl}</a><button className={ghost} onClick={() => void navigator.clipboard?.writeText(shareUrl)}>Copiar</button></div>}
      </section>
      <section id="cadastro" className={panel + ' space-y-3'}>
        <div><h2 className="text-xl font-bold">Participe do projeto</h2><p className="mt-1 text-sm text-slate-400">Receba novidades e ajude a escolher as próximas funcionalidades.</p></div>
        <form onSubmit={(e) => void register(e)} className="space-y-3">
          <input className={field} value={name} onChange={(e) => setName(e.target.value)} required maxLength={90} placeholder="Seu nome" autoComplete="name" />
          <input className={field} value={email} onChange={(e) => setEmail(e.target.value)} type="email" required maxLength={254} placeholder="Seu email" autoComplete="email" />
          <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-300"><input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" /> Autorizo guardar meu nome e email para receber contato sobre este projeto e convites para feedback. Meus dados não aparecerão publicamente.</label>
          <button className={button + ' w-full'} disabled={busy || !consent}>Quero participar</button>
          {registration && <p role="status" className="text-sm text-indigo-200">{registration}</p>}
        </form>
      </section>
      <section className={panel + ' space-y-3'}>
        <div><h2 className="text-xl font-bold">O que você mudaria?</h2><p className="mt-1 text-sm text-slate-400">Um minuto de feedback já ajuda muito.</p></div>
        <form onSubmit={(e) => void sendFeedback(e)} className="space-y-3">
          <select className={field} value={feature} onChange={(e) => setFeature(e.target.value)} aria-label="Ferramenta">
            <option>Geral</option><option>Swiper</option><option>Tracker</option><option>Print Binder</option><option>Comunidade</option>
          </select>
          <select className={field} value={rating} onChange={(e) => setRating(e.target.value)} aria-label="Nota">
            <option value="5">5 — Adorei</option><option value="4">4 — Gostei</option><option value="3">3 — Mediano</option><option value="2">2 — Precisa melhorar</option><option value="1">1 — Não funcionou</option>
          </select>
          <textarea className={field + ' min-h-28'} value={feedback} onChange={(e) => setFeedback(e.target.value)} required minLength={8} maxLength={1500} placeholder="O que faltou? O que foi mais útil?" />
          <button className={ghost + ' w-full'} disabled={busy}>Enviar feedback</button>
          {feedbackStatus && <p role="status" className="text-sm text-indigo-200">{feedbackStatus}</p>}
        </form>
      </section>
      <footer className="space-y-2 border-t border-white/10 pt-4 text-xs leading-relaxed text-slate-500"><p>Projeto independente, não afiliado à Wizards of the Coast. Dados de cartas e imagens via Scryfall; serviços externos sujeitos a limites e disponibilidade.</p><p>O cadastro é opcional. Nome e email são usados apenas para contato sobre o projeto. Listas só aparecem na galeria com sua autorização.</p><Link to="/admin" className="underline">Área do organizador</Link></footer>
    </main>
  </div>;
}
export function Community() {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/event/gallery').then((r) => { if (!r.ok) throw new Error('Falha ao consultar galeria.'); return r.json(); })
      .then((data: { shares: GalleryItem[] }) => setGallery(data.shares))
      .catch((err: Error) => setError(err.message));
  }, []);
  return <div className={shell}><Brand /><main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
    <div><h1 className="text-3xl font-bold">Decks da comunidade</h1><p className="mt-2 text-sm text-slate-400">Listas compartilhadas voluntariamente pelos jogadores. Compartilhe a sua a partir da página inicial.</p></div>
    <Link className={button + ' inline-block'} to="/">Compartilhar minhas cartas</Link>
    {error && <p role="alert">{error}</p>}
    {!error && !gallery.length && <p className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">Seja o primeiro a compartilhar uma lista!</p>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{gallery.map((s) =>
      <Link key={s.id} to={'/share/' + s.id} className="flex gap-4 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10">
        {s.image ? <img src={s.image} alt="" loading="lazy" className="h-24 w-16 rounded object-cover" /> : <div className="h-24 w-16 rounded bg-indigo-900" />}
        <div className="min-w-0"><h2 className="break-words font-semibold">{s.title}</h2><p className="mt-2 text-xs text-slate-400">{s.nickname} · {s.count} cartas</p></div>
      </Link>)}</div>
  </main></div>;
}
export function SharedList() {
  const { id } = useParams();
  const [share, setShare] = useState<Share | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    fetch('/api/event/shares/' + encodeURIComponent(id || ''))
      .then((r) => { if (!r.ok) throw new Error('Lista não encontrada.'); return r.json(); })
      .then((data: { share: Share }) => setShare(data.share))
      .catch((err: Error) => setError(err.message));
  }, [id]);
  return <div className={shell}><Brand /><main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
    {error && <p role="alert">{error}</p>}
    {!share && !error && <p>Carregando...</p>}
    {share && <><div><h1 className="text-2xl font-bold">{share.title}</h1><p className="text-sm text-slate-400">{share.nickname} · {share.cards.length} cartas · Snapshot compartilhado</p></div>
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">{share.cards.map((c, i) =>
      <div key={c.oracleId + String(i)} className="space-y-1">{c.image ? <img src={c.image} loading="lazy" alt={c.name} className="w-full rounded-md" /> : <div className="aspect-[5/7] rounded bg-white/10" />}
      <p className="break-words text-[11px] leading-tight">{c.name}</p><p className="text-[10px] text-slate-500">{c.setCode?.toUpperCase()} {c.collectorNumber}</p></div>)}</div>
    <div className="flex flex-wrap gap-2"><button className={ghost} onClick={() => void navigator.clipboard?.writeText(window.location.href)}>Copiar link</button>
      <button className={ghost} onClick={() => void navigator.clipboard?.writeText(share.cards.map((c) => '1 ' + c.name).join('\n'))}>Copiar lista</button>
      <Link to="/swipe" className={button}>Descobrir cartas</Link></div></>}
  </main></div>;
}
export function PrintBinder() {
  return <div className="flex h-screen flex-col overflow-hidden bg-[#0c0f18] text-white"><Brand />
    <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2 text-xs text-slate-300"><span>Print Binder · selecionar versões e gerar PDF</span><a href="/binder/" target="_blank" rel="noreferrer" className="text-indigo-300 underline">Abrir tela cheia</a></div>
    <iframe title="Print Binder" src="/binder/" className="min-h-0 w-full flex-1 border-0" />
  </div>;
}
export function EventAdmin() {
  const [secret, setSecret] = useState('');
  const [data, setData] = useState<{ leads: { name: string; email: string; nickname: string; createdAt: string }[]; feedback: { message: string; feature: string; rating: number; createdAt: string }[]; shares: Share[] } | null>(null);
  const [error, setError] = useState('');
  async function loadAdmin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('');
    try {
      const r = await fetch('/api/event/admin', { headers: { 'x-admin-key': secret }, cache: 'no-store' });
      if (!r.ok) throw new Error('Acesso negado ou falha na conexão.');
      setData(await r.json());
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro.'); }
  }
  function exportData() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'magic-hub-event.json'; a.click();
    URL.revokeObjectURL(url);
  }
  return <div className={shell}><Brand /><main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
    <h1 className="text-2xl font-bold">Área do organizador</h1>
    <form onSubmit={(e) => void loadAdmin(e)} className="flex gap-2"><input className={field} type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Chave de administração" aria-label="Chave de administração" /><button className={button}>Entrar</button></form>
    {error && <p role="alert" className="text-rose-300">{error}</p>}
    {data && <><div className="flex flex-wrap gap-3"><Pill>{data.leads.length} cadastros</Pill><Pill>{data.feedback.length} feedbacks</Pill><Pill>{data.shares.length} listas</Pill></div>
      <button className={button} onClick={exportData}>Baixar todos os dados (JSON)</button>
      <h2 className="text-xl font-semibold">Cadastros</h2><div className="space-y-2">{data.leads.slice().reverse().map((x) => <div key={x.email} className={panel}><b>{x.name}</b><p className="break-all text-sm text-slate-300">{x.email}</p><p className="text-xs text-slate-500">{x.nickname} · {x.createdAt}</p></div>)}</div>
      <h2 className="text-xl font-semibold">Feedbacks</h2><div className="space-y-2">{data.feedback.slice().reverse().map((x, i) => <div key={i} className={panel}><p>{x.message}</p><p className="mt-2 text-xs text-slate-400">{x.feature} · nota {x.rating} · {x.createdAt}</p></div>)}</div>
    </>}
  </main></div>;
}
