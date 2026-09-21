import { useEffect, useMemo, useState } from 'react';
import { useDeckStore, type CardList, type SavedCard } from '../deck/deckStore';
import { fetchPrintings, type DeckCard } from '../deck/scryfall';
import { BrazilPriceBadge } from './BrazilPriceBadge';

interface VersionPickerProps {
  card: SavedCard;
  list: CardList;
  onClose: () => void;
}

function printingTags(card: DeckCard): string[] {
  const tags = [...(card.frameEffects ?? [])];
  if (card.borderColor === 'borderless') tags.unshift('borderless');
  if (tags.length === 0) tags.push('classic');
  return [...new Set(tags)].slice(0, 4);
}

export function VersionPicker({ card, list, onClose }: VersionPickerProps) {
  const update = useDeckStore((s) => s.updateCardPrinting);
  const [printings, setPrintings] = useState<DeckCard[]>([]);
  const [selectedId, setSelectedId] = useState(card.id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchPrintings(card.name, ctrl.signal)
      .then((cards) => {
        setPrintings(cards);
        if (!cards.some((candidate) => candidate.id === card.id) && cards[0]) {
          setSelectedId(cards[0].id);
        }
      })
      .catch(() => setError('Não consegui carregar as versões agora.'))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [card.id, card.name]);

  const selected = useMemo(
    () => printings.find((candidate) => candidate.id === selectedId) ?? printings[0],
    [printings, selectedId],
  );

  const choose = () => {
    if (!selected) return;
    update(list, card.oracleId, selected);
    onClose();
  };

  return (
    <div className="version-picker" role="dialog" aria-modal="true" aria-label={`Versões de ${card.name}`}>
      <button className="version-picker-scrim" type="button" onClick={onClose} aria-label="Fechar" />
      <section className="version-picker-panel">
        <header className="version-picker-header">
          <div>
            <small>ESCOLHA A IMPRESSÃO</small>
            <h2>{card.name}</h2>
          </div>
          <button type="button" className="version-close" onClick={onClose}>×</button>
        </header>

        {loading && <div className="version-status"><div className="feed-spinner" /> Buscando versões…</div>}
        {error && <div className="version-status">{error}</div>}

        {!loading && selected && (
          <>
            <div className="version-hero">
              {selected.image && <img src={selected.image} alt={selected.name} />}
              <div className="version-info">
                <h3>{selected.setName || selected.setCode?.toUpperCase()}</h3>
                <p>
                  {(selected.setCode ?? '').toUpperCase()} #{selected.collectorNumber}
                  {selected.language ? ` · ${selected.language.toUpperCase()}` : ''}
                </p>
                <div className="version-tags">
                  {printingTags(selected).map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                {selected.artist && <em>Arte: {selected.artist}</em>}
                <BrazilPriceBadge name={selected.name} />
              </div>
            </div>

            <div className="version-strip" aria-label="Todas as versões">
              {printings.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={`version-thumb ${candidate.id === selected.id ? 'version-thumb-on' : ''}`}
                  onClick={() => setSelectedId(candidate.id)}
                >
                  {candidate.image && <img src={candidate.image} alt="" loading="lazy" />}
                  <span>{(candidate.setCode ?? '').toUpperCase()}</span>
                </button>
              ))}
            </div>

            <button type="button" className="version-choose" onClick={choose}>
              Selecionar esta versão · {printings.indexOf(selected) + 1}/{printings.length}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
