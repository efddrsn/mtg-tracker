import { useEffect, useRef, useState } from 'react';
import type { SavedCard } from '../deck/deckStore';
import { STORES, initialStoreResults, availableListings, cardTutorCsv,
  fetchCardTutorResults, lowestAvailablePrice, type StoreId, type CardTutorResult, loadCustomStores, saveCustomStores, type StoreDefinition } from '../stores/cardtutor';

function downloadCsv(results: CardTutorResult[], storeId: string) {
  const url = URL.createObjectURL(new Blob([`\uFEFF${cardTutorCsv(results)}`], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `wishlist-${storeId}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function StorePanel({ cards, storeId, custom }: { cards: SavedCard[]; storeId: StoreId; custom?: StoreDefinition }) {
  const [results, setResults] = useState(() => initialStoreResults(cards, storeId, custom));
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [manualCopy, setManualCopy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const urls = results.map((result) => result.url).join('\n');
  const checked = results.filter((result) => result.status === 'checked').length;
  const blocked = results.some((result) => result.error === 'blocked');
  const unavailable = results.some((result) => result.error === 'store_unavailable' || result.error === 'timeout');

  const consult = async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setRunning(true);
    setMessage('');
    try {
      await fetchCardTutorResults(cards, current.signal, storeId, setResults, custom);
    } catch {
      if (!current.signal.aborted) setMessage('Consulta interrompida. Os links continuam disponíveis.');
    } finally {
      if (!current.signal.aborted) setRunning(false);
    }
  };

  const copyUrls = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard indisponível');
      await navigator.clipboard.writeText(urls);
      setMessage('Links copiados!');
    } catch {
      setManualCopy(true);
      setMessage('Selecione e copie os links abaixo.');
    }
  };

  return <>
    <div className="store-export-actions">
      <button type="button" onClick={copyUrls} disabled={!cards.length}>Copiar URLs</button>
      <button type="button" onClick={() => downloadCsv(results, storeId)} disabled={!cards.length}>Exportar CSV</button>
      <button type="button" onClick={consult} disabled={running || !cards.length}>Consultar preço e estoque</button>
      {running && <button type="button" onClick={() => { controller.current?.abort(); setRunning(false); }}>Parar consulta</button>}
    </div>
    <p className="store-export-note">
      Links prontos para todas as cartas. Busca exata quando o produto ainda não foi confirmado.
      Preços consultados são da oferta disponível mais barata, não necessariamente da versão escolhida. Frete não incluído.
    </p>
    <p className="store-export-note" role="status">
      {running ? `Consultando… ${checked}/${cards.length} cartas verificadas.`
        : blocked ? 'A loja bloqueou a consulta automática. Os links individuais de busca funcionam no navegador; preços e estoques não foram verificados.'
          : unavailable ? 'Não foi possível consultar a loja agora. Os links de compra continuam disponíveis, mas o estoque não foi verificado.'
            : `${checked}/${cards.length} cartas com ofertas verificadas. Estoque desconhecido não significa esgotado.`}
      {message && ` ${message}`}
    </p>
    {manualCopy && <textarea aria-label="URLs para copiar" value={urls} readOnly rows={6} onFocus={(event) => event.target.select()} />}
    <div className="store-export-list">
      {results.map((result, index) => {
        const offers = availableListings(result);
        const price = lowestAvailablePrice(result);
        return <article key={`${result.oracleId}-${index}`} className="store-export-row">
          <div>
            <b>{result.name}</b>
            <span>{result.setCode ? `${result.setCode.toUpperCase()} #${result.collectorNumber} · ` : ''}
              {offers.length ? `${offers.length} ofertas em estoque`
                : result.status === 'checked' ? 'Sem estoque nas ofertas consultadas'
                  : result.error === 'blocked' ? 'Verificação bloqueada pela loja · abrir link'
                    : result.error ? 'Estoque não verificado · abrir link' : 'Preço/estoque não verificados'}
            </span>
          </div>
          {result.method && <small>{['direct', 'tls'].includes(result.method) ? 'Consulta direta' : result.method === 'browser' ? 'Navegador' : result.method === 'tinyfish' ? 'TinyFish' : 'Firecrawl'}</small>}
          {price != null && <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price)}</strong>}
          <a href={result.url} target="_blank" rel="noreferrer">{result.matched ? 'Produto' : 'Buscar'}</a>
        </article>;
      })}
    </div>
  </>;
}

export function CardTutorExport({ cards, onClose }: { cards: SavedCard[]; onClose: () => void }) {
  const [customStores, setCustomStores] = useState(loadCustomStores);
  const [adding, setAdding] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [storeError, setStoreError] = useState('');
  const [storeId, setStoreId] = useState<StoreId>('cardtutor');
  // Freeze this export's snapshot so background changes cannot restart requests.
  const [snapshot] = useState(() => [...cards]);
  return <div className="store-export" role="dialog" aria-modal="true" aria-label="Links de compra">
    <button type="button" className="store-export-scrim" onClick={onClose} aria-label="Fechar" />
    <section className="store-export-panel">
      <header className="store-export-header">
        <div><small>COMPRAR WISHLIST</small><h2>Links de compra</h2></div>
        <button type="button" className="version-close" onClick={onClose} aria-label="Fechar">×</button>
      </header>
      <div className="store-export-stores" role="group" aria-label="Loja">
        {[...STORES, ...customStores].map((store) => <button key={store.id} type="button" aria-pressed={storeId === store.id}
          onClick={() => setStoreId(store.id as StoreId)}>{store.name}</button>)}
      </div>
      <div className="store-export-actions">
        <button type="button" onClick={() => setAdding(!adding)}>+ Adicionar loja</button>
        {customStores.some((store) => store.id === storeId) && <button type="button" onClick={() => {
          try {
            const next = customStores.filter((store) => store.id !== storeId);
            saveCustomStores(next); setCustomStores(next); setStoreId('cardtutor');
          } catch { setStoreError('Não foi possível salvar a alteração neste navegador.'); }
        }}>Remover loja</button>}
      </div>
      {adding && <form className="store-export-form" onSubmit={(event) => {
        event.preventDefault();
        try {
          const url = new URL(storeUrl.includes('://') ? storeUrl : `https://${storeUrl}`);
          if (url.protocol !== 'https:' || url.username || url.password || url.port
            || !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname)) throw new Error();
          if ([...STORES, ...customStores].some((store) => new URL(store.origin).hostname === url.hostname)) {
            setStoreError('Esta loja já está cadastrada.'); return;
          }
          const store = { id: `custom-${crypto.randomUUID()}`, name: storeName.trim(), origin: `${url.origin}/` };
          if (!store.name) throw new Error();
          const next = [...customStores, store];
          saveCustomStores(next); setCustomStores(next); setStoreId(store.id);
          setAdding(false); setStoreName(''); setStoreUrl(''); setStoreError('');
        } catch { setStoreError('Confira o endereço HTTPS e permita salvar dados neste navegador.'); }
      }}>
        <p className="store-export-note">Lojas que usam a plataforma LigaMagic. Salvas neste navegador.</p>
        <label>Nome da loja<input required maxLength={60} value={storeName} onChange={(event) => setStoreName(event.target.value)} /></label>
        <label>Site da loja<input required inputMode="url" placeholder="https://www.loja.com.br" value={storeUrl} onChange={(event) => setStoreUrl(event.target.value)} /></label>
        <button type="submit">Salvar loja</button>
      </form>}
      {storeError && <p role="alert">{storeError}</p>}
      <StorePanel key={storeId} cards={snapshot} storeId={storeId} custom={customStores.find((store) => store.id === storeId)} />
    </section>
  </div>;
}
