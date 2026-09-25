import { useEffect, useMemo, useState } from 'react';
import type { SavedCard } from '../deck/deckStore';
import {
  availableListings,
  cardTutorCsv,
  fetchCardTutorResults,
  lowestAvailablePrice,
  type CardTutorResult,
} from '../stores/cardtutor';

interface CardTutorExportProps {
  cards: SavedCard[];
  onClose: () => void;
}

function brl(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function downloadCsv(results: CardTutorResult[]) {
  const blob = new Blob([`\uFEFF${cardTutorCsv(results)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'wishlist-cardtutor.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CardTutorExport({ cards, onClose }: CardTutorExportProps) {
  const [results, setResults] = useState<CardTutorResult[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchCardTutorResults(cards, controller.signal)
      .then(setResults)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Não foi possível consultar o CardTutor.');
        }
      });
    return () => controller.abort();
  }, [cards]);

  const ready = results.length === cards.length;
  const urls = useMemo(() => results.map((result) => result.url).join('\n'), [results]);

  const copyUrls = () => {
    navigator.clipboard?.writeText(urls).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  return (
    <div className="store-export" role="dialog" aria-modal="true" aria-label="Links do CardTutor">
      <button type="button" className="store-export-scrim" onClick={onClose} aria-label="Fechar" />
      <section className="store-export-panel">
        <header className="store-export-header">
          <div>
            <small>COMPRAR WISHLIST</small>
            <h2>Links do CardTutor</h2>
          </div>
          <button type="button" className="version-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        {error ? <div className="store-export-status">{error}</div> : !ready ? (
          <div className="store-export-status"><span className="spinner" />Buscando cartas e ofertas…</div>
        ) : (
          <>
            <div className="store-export-actions">
              <button type="button" onClick={copyUrls}>{copied ? 'Copiado!' : 'Copiar URLs'}</button>
              <button type="button" onClick={() => downloadCsv(results)}>Exportar CSV</button>
            </div>
            <p className="store-export-note">
              O link abre todas as versões da carta. O CSV usa a oferta disponível mais barata.
            </p>
            <div className="store-export-list">
              {results.map((result) => {
                const offers = availableListings(result);
                const price = lowestAvailablePrice(result);
                return (
                  <article key={result.oracleId} className="store-export-row">
                    <div>
                      <b>{result.name}</b>
                      <span>
                        {result.setCode ? `${result.setCode.toUpperCase()} #${result.collectorNumber} · ` : ''}
                        {offers.length > 0
                          ? `${offers.length} oferta${offers.length === 1 ? '' : 's'} em estoque`
                          : result.matched ? 'Sem estoque' : 'Busca no CardTutor'}
                      </span>
                    </div>
                    {price != null && <strong>{brl(price)}</strong>}
                    <a href={result.url} target="_blank" rel="noreferrer">Abrir</a>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
