import { useRef, useState } from 'react';
import { useDeckStore, type CardList, type SavedCard } from '../deck/deckStore';
import { AddCardSearch } from './AddCardSearch';
import { BrazilPriceBadge } from './BrazilPriceBadge';
import { VersionPicker } from './VersionPicker';

interface DeckSheetProps {
  open: boolean;
  dragY: number;
  onClose: () => void;
}

function manaSymbols(cost: string): string {
  return cost.replace(/[{}]/g, '');
}

function listLine(card: SavedCard): string {
  const version = card.setCode && card.collectorNumber
    ? ` (${card.setCode.toUpperCase()}) ${card.collectorNumber}`
    : '';
  return `1 ${card.name}${version}`;
}

function CardRow({
  card,
  list,
  onPreview,
  onVersion,
}: {
  card: SavedCard;
  list: CardList;
  onPreview: (card: SavedCard) => void;
  onVersion: (card: SavedCard) => void;
}) {
  const remove = useDeckStore((s) => s.removeFromList);
  const timer = useRef<number | null>(null);

  const startHold = () => {
    timer.current = window.setTimeout(() => onPreview(card), 480);
  };
  const cancelHold = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <div
      className="deck-row"
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onPointerLeave={cancelHold}
    >
      {card.image && (
        <img src={card.image} alt="" className="deck-row-thumb" loading="lazy" draggable={false} />
      )}
      <div className="deck-row-main">
        <span className="deck-row-name">{card.name}</span>
        <span className="deck-row-meta">
          {manaSymbols(card.manaCost)} · {card.typeLine.split('—')[0].trim()}
          {card.setCode ? ` · ${card.setCode.toUpperCase()} #${card.collectorNumber}` : ''}
        </span>
        <div className="deck-row-tools">
          <BrazilPriceBadge name={card.name} />
          <button type="button" onClick={() => onVersion(card)}>Versão</button>
        </div>
      </div>
      <button
        type="button"
        className="deck-row-remove"
        onClick={() => remove(list, card.oracleId)}
        aria-label={`Remover ${card.name}`}
      >
        ✕
      </button>
    </div>
  );
}

export function DeckSheet({ open, dragY, onClose }: DeckSheetProps) {
  const wishlist = useDeckStore((s) => s.deck);
  const owned = useDeckStore((s) => s.owned);
  const revisions = useDeckStore((s) => s.revisions);
  const clearList = useDeckStore((s) => s.clearList);
  const saveRevision = useDeckStore((s) => s.saveRevision);
  const restoreRevision = useDeckStore((s) => s.restoreRevision);
  const deleteRevision = useDeckStore((s) => s.deleteRevision);
  const [active, setActive] = useState<CardList>('wishlist');
  const [addOpen, setAddOpen] = useState(false);
  const [preview, setPreview] = useState<SavedCard | null>(null);
  const [versionCard, setVersionCard] = useState<SavedCard | null>(null);
  const cards = active === 'wishlist' ? wishlist : owned;

  const exportList = () => {
    navigator.clipboard?.writeText(cards.map(listLine).join('\n')).catch(() => {});
  };

  const restore = (id: string) => {
    saveRevision('Antes de restaurar');
    restoreRevision(id);
  };

  return (
    <>
      <div className={`sheet-scrim ${open ? 'sheet-scrim-on' : ''}`} onClick={onClose} aria-hidden />
      <div
        className="deck-sheet"
        style={{
          transform: open ? 'translateY(0)' : `translateY(calc(100% + ${dragY}px))`,
          transition: dragY === 0 ? 'transform 0.3s cubic-bezier(0.22,0.61,0.36,1)' : 'none',
        }}
        role="dialog"
        aria-label="Suas cartas"
      >
        <div className="sheet-grabber" />
        <div className="sheet-header collections-header">
          <h2>Minhas cartas</h2>
          <div className="deck-header-actions">
            <button type="button" className="sheet-text-btn" onClick={() => saveRevision()}>
              Salvar versão
            </button>
            <button type="button" className="sheet-text-btn" onClick={() => setAddOpen(true)}>
              + Carta
            </button>
          </div>
        </div>

        <div className="collection-tabs">
          <button
            type="button"
            className={active === 'wishlist' ? 'collection-tab-on' : ''}
            onClick={() => setActive('wishlist')}
          >
            Wishlist <b>{wishlist.length}</b>
          </button>
          <button
            type="button"
            className={active === 'owned' ? 'collection-tab-on' : ''}
            onClick={() => setActive('owned')}
          >
            Já tenho <b>{owned.length}</b>
          </button>
        </div>

        <div className="collection-actions">
          <button type="button" onClick={exportList} disabled={cards.length === 0}>Copiar lista</button>
          <button type="button" onClick={() => clearList(active)} disabled={cards.length === 0}>Limpar</button>
          <details className="revision-menu">
            <summary>Histórico ({revisions.length})</summary>
            <div className="revision-popover">
              {revisions.length === 0 && <p>Salve uma versão para criar um ponto de restauração.</p>}
              {revisions.map((revision) => (
                <div key={revision.id} className="revision-row">
                  <span>
                    <b>{revision.label}</b>
                    <small>{new Date(revision.savedAt).toLocaleString('pt-BR')}</small>
                  </span>
                  <button type="button" onClick={() => restore(revision.id)}>Restaurar</button>
                  <button type="button" onClick={() => deleteRevision(revision.id)}>×</button>
                </div>
              ))}
            </div>
          </details>
        </div>

        <div className="deck-list">
          {cards.length === 0 ? (
            <div className="deck-empty">
              <p>{active === 'wishlist' ? 'Sua wishlist está vazia.' : 'Nenhuma carta marcada como já tenho.'}</p>
              <p className="deck-empty-hint">Use o gesto diagonal para a direita no feed.</p>
            </div>
          ) : cards.map((card) => (
            <CardRow
              key={card.oracleId}
              card={card}
              list={active}
              onPreview={setPreview}
              onVersion={setVersionCard}
            />
          ))}
        </div>
      </div>

      {addOpen && <AddCardSearch destination={active} onClose={() => setAddOpen(false)} />}
      {preview && (
        <div className="card-preview" role="dialog" aria-modal="true" onClick={() => setPreview(null)}>
          {preview.image && <img src={preview.image} alt={preview.name} />}
          <span>{preview.name}</span>
        </div>
      )}
      {versionCard && (
        <VersionPicker card={versionCard} list={active} onClose={() => setVersionCard(null)} />
      )}
    </>
  );
}
