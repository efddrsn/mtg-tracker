import { useNavigate } from 'react-router-dom';
import { useHubStore, makeDeck, fromCards } from '../deck/hubStore';
import { copy, download } from '../deck/hubApi';
import { useRef, useState } from 'react';
import { useDeckStore, type CardList, type SavedCard } from '../deck/deckStore';
import { AddCardSearch } from './AddCardSearch';
import { BrazilPriceBadge } from './BrazilPriceBadge';
import { CardTutorExport } from './CardTutorExport';
import { VersionPicker } from './VersionPicker';

interface DeckSheetProps {
  open: boolean;
  dragY: number;
  onClose: () => void;
  onReview?: (list: CardList) => void;
}

function manaSymbols(cost: string): string {
  return cost.replace(/[{}]/g, '');
}

function listLine(card: SavedCard): string {
  const version = card.setCode && card.collectorNumber
    ? ` (${card.setCode.toUpperCase()}) ${card.collectorNumber}`
    : '';
  return `${card.quantity || 1} ${card.name}${version}`;
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
          <BrazilPriceBadge
            name={card.name}
            setCode={card.setCode}
            collectorNumber={card.collectorNumber}
          />
          <button type="button" onClick={() => onVersion(card)}>Versão</button>
        </div>
      </div>
      <button
        type="button"
        className="deck-row-remove"
        onClick={() => remove(list, card.oracleId, card)}
        aria-label={`Remover ${card.name}`}
      >
        ✕
      </button>
    </div>
  );
}

export function DeckSheet({ open, dragY, onClose, onReview }: DeckSheetProps) {
  const navigate=useNavigate();
  const activeDeck=useHubStore(s=>s.decks.find(d=>d.id===s.activeDeckId&&!d.deletedAt));
  const [status,setStatus]=useState('');
  const [manual,setManual]=useState('');
  const deck = useDeckStore((s) => s.deck);
  const wishlist = useDeckStore((s) => s.wishlist);
  const maybe = useDeckStore((s) => s.maybe);
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
  const [storeExportOpen, setStoreExportOpen] = useState(false);
  const cards = { deck, wishlist, maybe, owned }[active];

  const exportList = () => {
    const text=cards.map(listLine).join('\n');setManual(text);void copy(text).then(setStatus).catch((e:Error)=>setStatus(e.message));
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
        aria-modal={open || undefined}
        inert={!open && dragY===0}
        aria-label="Suas cartas"
      >
        <div className="sheet-grabber" />
        <div className="sheet-header collections-header">
          <h2>{activeDeck?.title || 'Minhas listas'}</h2>
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
          {([
            ['deck', 'Deck', deck.length],
            ['wishlist', 'Wishlist', wishlist.length],
            ['maybe', 'Talvez', maybe.length],
            ['owned', 'Já tenho', owned.length],
          ] as const).map(([list, title, count]) => (
            <button
              type="button"
              key={list}
              className={active === list ? 'collection-tab-on' : ''}
              onClick={() => setActive(list)}
            >
              {title} <b>{count}</b>
            </button>
          ))}
        </div>

        <div className="collection-actions">
          <button type="button" onClick={exportList} disabled={cards.length === 0}>Copiar lista</button>
          <button type="button" onClick={() => { onReview?.(active); onClose(); }} disabled={!cards.length}>
            Revisar no centro
          </button>
          {active === 'wishlist' && (
            <button type="button" onClick={() => setStoreExportOpen(true)} disabled={cards.length === 0}>
              Links de compra
            </button>
          )}
          <button type="button" onClick={() => {saveRevision('Antes de limpar');clearList(active);setStatus('Lista limpa. Restaure pelo Histórico se precisar.');}} disabled={cards.length === 0}>Limpar</button>
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

        <div className="collection-actions">
          {active === 'deck' ? (
            <button type="button" onClick={()=>{onClose();navigate(activeDeck?'/decks/'+activeDeck.id:'/decks');}}>
              Abrir em Meus decks
            </button>
          ) : (
            <button type="button" disabled={!cards.length} onClick={()=>{
              const additions=fromCards(cards);
              const d=makeDeck(active==='wishlist'?'Minha wishlist':active==='maybe'?'Talvez':'Minha coleção',
                additions,active==='wishlist'?'wishlist':'collection');
              useHubStore.getState().save(d);onClose();navigate('/decks/'+d.id);
            }}>
              Salvar como lista independente
            </button>
          )}
          <button type="button" disabled={!cards.length} onClick={()=>{download('minhas-cartas.txt',cards.map(listLine).join('\n'));setStatus('Download iniciado.');}}>Baixar TXT</button>
          <button type="button" onClick={onClose}>Fechar lista</button>
        </div>
        {status&&<p role="status" className="px-5 text-xs text-indigo-200">{status}</p>}
        {manual&&<textarea className="mx-4 rounded bg-black/20 p-2 text-xs" aria-label="Lista do Swiper para copiar" readOnly value={manual} onFocus={e=>e.target.select()}/>}
        <div className="deck-list">
          {cards.length === 0 ? (
            <div className="deck-empty">
              <p>{active === 'deck' ? 'Este deck está vazio.' :
                active === 'wishlist' ? 'Sua wishlist está vazia.' :
                active === 'maybe' ? 'Nenhuma carta em Talvez.' : 'Nenhuma carta marcada como já tenho.'}</p>
              <p className="deck-empty-hint">Use o gesto diagonal para a direita no feed.</p>
            </div>
          ) : cards.map((card, index) => (
            <CardRow
              key={`${card.oracleId}:${card.setCode || ''}:${card.collectorNumber || ''}:${index}`}
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
      {storeExportOpen && (
        <CardTutorExport cards={wishlist} onClose={() => setStoreExportOpen(false)} />
      )}
    </>
  );
}
