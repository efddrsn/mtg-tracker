import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { makeDeck, useHubStore, type HubDeck, type SwipeCorner, type SwipePile, type SwipeSource } from '../deck/hubStore';
import { configureSwiperDeck, ensureSwiperWorkspace, loadSwiperDeck, persistSwiperDeck, switchSwiperDeck, swipeSessionFor } from '../deck/swiperWorkspace';
import { useNavigate } from 'react-router-dom';
import { SwipeCard } from '../components/SwipeCard';
import { ConfigSheet } from '../components/ConfigSheet';
import { DeckSheet } from '../components/DeckSheet';
import { CommanderSearch } from '../components/CommanderSearch';
import { useRecommendationFeed } from '../deck/useFeed';
import { useDeckStore } from '../deck/deckStore';
import type { DeckCard } from '../deck/scryfall';

function vibrate(ms: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate?.(ms);
  }
}

type Axis = 'h' | 'v' | null;
type Decision = 'keep' | 'reject' | SwipePile;
const PILES: { id: SwipePile; title: string }[] = [
  { id: 'deck', title: 'Deck' }, { id: 'wishlist', title: 'Wishlist' },
  { id: 'owned', title: 'Já tenho' }, { id: 'maybe', title: 'Talvez' },
];
const SOURCE_OPTIONS: { id: SwipeSource; title: string }[] = [
  { id: 'recommendations', title: 'Recomendações' }, ...PILES,
];
const CORNERS: { id: SwipeCorner; title: string }[] = [
  { id: 'nw', title: 'Superior esquerdo' }, { id: 'ne', title: 'Superior direito' },
  { id: 'sw', title: 'Inferior esquerdo' }, { id: 'se', title: 'Inferior direito' },
];

const AXIS_LOCK = 10; // px before we commit to an axis
const FLY_MS = 320;

export function SwipeDeck() {
  const navigate = useNavigate();
  const activeId=useHubStore(s=>s.activeDeckId);
  const allDecks=useHubStore(s=>s.decks);
  const decks=allDecks.filter(d=>!d.deletedAt);
  const feed = useRecommendationFeed();
  const moveCard = useDeckStore((s) => s.moveCard);
  const reject = useDeckStore((s) => s.reject);
  const skip = useDeckStore((s) => s.skip);
  const setCommander = useDeckStore((s) => s.setCommander);
  const removeFromList = useDeckStore((s) => s.removeFromList);

  const commander = useDeckStore((s) => s.commander);
  const deckCards = useDeckStore(s=>s.deck);
  const wishlistCards = useDeckStore(s=>s.wishlist);
  const maybeCards = useDeckStore(s=>s.maybe);
  const ownedCards = useDeckStore(s=>s.owned);
  const collections = { deck: deckCards, wishlist: wishlistCards, maybe: maybeCards, owned: ownedCards };
  const pileCount = (pile: SwipePile) => collections[pile].reduce((count, card) => count + (card.quantity || 1), 0);
  const [source, setSource] = useState<SwipeSource>('recommendations');
  const [reviewIndex, setReviewIndex] = useState(0);
  const [corners, setCorners] = useState<Record<SwipeCorner, SwipePile>>({
    nw: 'maybe', ne: 'wishlist', sw: 'deck', se: 'owned',
  });
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [repositioning, setRepositioning] = useState(false);
  const [draggingCard, setDraggingCard] = useState(false);
  const ACTIVE_DISTANCE = 18;
  function destinationFor(x: number, y: number): SwipeCorner | 'reject' | null {
    if (Math.hypot(x,y) < ACTIVE_DISTANCE) return null;
    // Fixed discard lane: horizontal left or diagonal lower-left.
    if (x < -ACTIVE_DISTANCE && (y >= -28 || y > Math.abs(x) * .3)) return 'reject';
    if (x < -ACTIVE_DISTANCE && y < -28) return 'nw';
    if (x > ACTIVE_DISTANCE && y < -28) return 'ne';
    if (x > ACTIVE_DISTANCE && y >= -28) return 'se';
    return null;
  }
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [workspaceMenu, setWorkspaceMenu] = useState(false);
  const selectedDeck = decks.find(d => d.id === loadedId);
  function renameDeck() {
    const title = nameDraft.trim().slice(0, 100);
    if (title && selectedDeck && title !== selectedDeck.title) {
      useHubStore.getState().save({ ...selectedDeck, title, updatedAt: Date.now() });
    }
    setEditingName(false);
  }
  const loadedRef = useRef<string | null>(null);
  useEffect(() => {
    const current = ensureSwiperWorkspace();
    if (loadedRef.current === current.id) return;
    if (loadedRef.current) persistSwiperDeck(loadedRef.current);
    loadSwiperDeck(current);
    loadedRef.current = current.id;
    const session = swipeSessionFor(current);
    setSource(session.source);
    setReviewIndex(session.reviewIndex);
    setCorners(session.corners);
    setLoadedId(current.id);
  }, [activeId]);

  useEffect(() => {
    if (!loadedId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useDeckStore.subscribe(() => {
      clearTimeout(timer);
      timer = setTimeout(() => persistSwiperDeck(loadedId), 500);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
      if (loadedRef.current === loadedId) persistSwiperDeck(loadedId);
    };
  }, [loadedId]);

  function chooseSource(next: SwipeSource) {
    setSource(next);
    setReviewIndex(0);
    if (loadedId) configureSwiperDeck(loadedId, { source: next, reviewIndex: 0 });
    history.current = [];
  }
  function chooseCorner(corner: SwipeCorner, pile: SwipePile) {
    const updated = { ...corners, [corner]: pile };
    setCorners(updated);
    if (loadedId) configureSwiperDeck(loadedId, { corners: updated });
  }
  function advanceReview(index: number) {
    setReviewIndex(index);
    if (loadedId) configureSwiperDeck(loadedId, { reviewIndex: index });
  }
  function openWorkspace(deck: HubDeck) {
    if (deck.id === loadedRef.current) return;
    switchSwiperDeck(deck);
    loadedRef.current = deck.id;
    const session = swipeSessionFor(deck);
    setSource(session.source);
    setReviewIndex(session.reviewIndex);
    setCorners(session.corners);
    setLoadedId(deck.id);
    history.current = [];
  }
  function createWorkspace() {
    if (loadedId) persistSwiperDeck(loadedId);
    const created = makeDeck('Novo deck');
    useHubStore.getState().save(created);
    openWorkspace(created);
  }

  const pickingCommander = feed.phase === 'commander-select';

  // A default name follows the selected commander; custom deck titles remain untouched.
  useEffect(() => {
    if (!commander || !loadedId) return;
    const deck = useHubStore.getState().decks.find(d => d.id === loadedId);
    if (!deck || !/^(Novo deck|Meu deck)(?: \d+)?$/i.test(deck.title.trim())) return;
    useHubStore.getState().save({
      ...deck, title: commander.name, updatedAt: Date.now(),
    });
  }, [commander?.oracleId, commander?.name, loadedId]);

  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [animate, setAnimate] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [configDragY, setConfigDragY] = useState(0);
  const [deckDragY, setDeckDragY] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  function openCommanderSearch() {
    // iOS Safari requires focusing the input in the original user gesture.
    // A later effect/timeout opens the modal but does not raise the keyboard.
    flushSync(() => setSearchOpen(true));
    document.querySelector<HTMLInputElement>('.search-modal .search-input')?.focus();
  }
  // Auto-offer the commander search once when entering the commander phase.
  const autoOffered = useRef(false);

  // Offer the name search the first time we land in the commander phase; the
  // player can dismiss it and swipe instead.
  useEffect(() => {
    if (pickingCommander && source === 'recommendations' && !autoOffered.current) {
      autoOffered.current = true;
      setSearchOpen(true);
    }
    if (!pickingCommander || source !== 'recommendations') autoOffered.current = false;
  }, [pickingCommander, source]);

  // Transient gesture state kept in refs to avoid stale-closure bugs.
  const start = useRef({ x: 0, y: 0 });
  const axis = useRef<Axis>(null);
  const pointerId = useRef<number | null>(null);
  const busy = useRef(false);
  const history = useRef<{
    card: DeckCard; source: SwipeSource; index: number;
    state: ReturnType<typeof snapshot>;
  }[]>([]);
  const reviewCards = source === 'recommendations' ? [] : collections[source];
  const top: DeckCard | undefined = source === 'recommendations' ? feed.queue[0] : reviewCards[reviewIndex];
  const second: DeckCard | undefined = source === 'recommendations' ? feed.queue[1] : reviewCards[reviewIndex + 1];
  function snapshot() {
    const state = useDeckStore.getState();
    return {
      deck: [...state.deck], wishlist: [...state.wishlist],
      maybe: [...state.maybe], owned: [...state.owned],
      rejected: [...state.rejected], commander: state.commander,
      swipeCount: state.swipeCount, config: state.config,
      configVersion: state.configVersion,
    };
  }

  const sheetOpen = configOpen || deckOpen;

  const commit = useCallback(
    (decision: Decision, chosenCorner?: SwipeCorner) => {
      if (!top || busy.current || !loadedId) return;
      busy.current = true;
      vibrate(decision === 'reject' ? 10 : 18);
      history.current.push({ card: top, source, index: reviewIndex, state: snapshot() });
      const reviewing = source !== 'recommendations';
      // Defer the state mutation until after the current card has left the
      // screen. Otherwise review mode would animate the next card instead.
      const applyDecision = () => {
        if (decision === 'keep') {
          if (reviewing) advanceReview(reviewIndex + 1);
        } else if (decision === 'reject') {
          if (reviewing) removeFromList(source, top.oracleId, top);
          else if (pickingCommander) skip(top);
          else reject(top);
        } else if (pickingCommander && !reviewing) {
          setCommander(top);
        } else {
          moveCard(top, source, decision);
          if (reviewing && (decision === source || source === 'owned' || decision === 'owned')) {
            advanceReview(reviewIndex + 1);
          }
        }
      };
      const w = window.innerWidth || 400, h = window.innerHeight || 700;
      const corner = chosenCorner || (decision === 'keep' ? null
        : CORNERS.find(c => corners[c.id] === decision)?.id);
      setAnimate(true);
      setDrag({
        x: decision === 'reject' ? -w * 1.3
          : decision === 'keep' ? w * 1.3
          : corner?.endsWith('e') ? w * 1.3 : -w * 1.3,
        y: corner?.startsWith('n') ? -h * 0.35 : corner?.startsWith('s') ? h * 0.35 : 0,
      });
      window.setTimeout(() => {
        applyDecision();
        if (!reviewing) feed.advance();
        setAnimate(false);
        setDrag({ x: 0, y: 0 });
        busy.current = false;
      }, FLY_MS);
    },
    [top, source, loadedId, reviewIndex, corners, pickingCommander,
      reject, skip, setCommander, moveCard, removeFromList, feed],
  );

  const undo = useCallback(() => {
    if (busy.current) return;
    const last = history.current.pop();
    if (!last) return;
    vibrate(8);
    useDeckStore.setState(last.state);
    if (last.source === 'recommendations') feed.pushFront(last.card);
    setSource(last.source);
    advanceReview(last.index);
    setAnimate(false);
    setDrag({ x: 0, y: 0 });
  }, [feed, loadedId]);

  // Keyboard alternatives to the removed bottom buttons. Controls that edit
  // text or choose a pile retain their native keyboard handling.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (configOpen || deckOpen || searchOpen || repositioning || !top) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,select,textarea,button,[contenteditable="true"]')) return;
      const destinations: Record<string, SwipeCorner> = {
        '1': 'nw', '2': 'ne', '3': 'se',
      };
      if (event.key in destinations) {
        event.preventDefault();
        const corner = destinations[event.key];
        commit(corners[corner], corner);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        commit('reject');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (source === 'recommendations') commit(corners.ne, 'ne');
        else commit('keep');
      } else if (event.key === 'Backspace' || (event.key.toLowerCase() === 'z' && (event.metaKey || event.ctrlKey))) {
        event.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [configOpen, deckOpen, searchOpen, repositioning, top, commit, corners, source, undo]);

  // --- Pointer gesture handling ---------------------------------------------

  const onPointerDown = (e: React.PointerEvent) => {
    if (sheetOpen || repositioning || busy.current || !top) return;
    pointerId.current = e.pointerId;
    start.current = { x: e.clientX, y: e.clientY };
    axis.current = null;
    setAnimate(false);
    setDraggingCard(false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId || busy.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (axis.current === null) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      axis.current = (dx < -AXIS_LOCK && dy > AXIS_LOCK) || Math.abs(dx) > Math.abs(dy) * 0.35 ? 'h' : 'v';
      try {
        (e.target as Element).setPointerCapture?.(e.pointerId);
      } catch { /* ignore */ }
    }

    if (axis.current === 'h') {
      setDraggingCard(true);
      setDrag({ x: dx, y: dy });
    } else if (dy > 0) {
      setConfigDragY(Math.min(dy, window.innerHeight));
    } else {
      setDeckDragY(Math.max(dy, -window.innerHeight));
    }
  };

  const endGesture = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    pointerId.current = null;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    const locked = axis.current;
    axis.current = null;

    setDraggingCard(false);
    if (locked === 'h') {
      const threshold = (window.innerWidth || 400) * .23;
      if (Math.hypot(dx, dy) > threshold) {
        const dest = destinationFor(dx,dy);
        if (dest === 'reject') commit('reject');
        else if (dest) commit(corners[dest], dest);
        else { setAnimate(true); setDrag({ x:0, y:0 }); }
      } else { setAnimate(true); setDrag({ x:0, y:0 }); }
    } else if (locked === 'v') {
      const openThreshold = (window.innerHeight || 700) * 0.16;
      if (dy > openThreshold) {
        setConfigOpen(true);
        vibrate(12);
      } else if (dy < -openThreshold) {
        setDeckOpen(true);
        vibrate(12);
      }
      setConfigDragY(0);
      setDeckDragY(0);
    }
  };

  // --- Render ----------------------------------------------------------------

  const renderStack = () => {
    if (source === 'recommendations' && feed.error && feed.queue.length === 0) {
      return (
        <div className="feed-message">
          <p className="feed-message-title">Couldn't load cards</p>
          <p className="feed-message-sub">{feed.error}</p>
          <button type="button" className="feed-retry" onClick={() => feed.retry()}>
            Retry
          </button>
        </div>
      );
    }

    if (!top && feed.loading && source === 'recommendations') {
      return (
        <div className="feed-message">
          <div className="feed-spinner" />
          <p className="feed-message-sub">
            {pickingCommander ? 'Finding commanders…' : 'Finding recommendations…'}
          </p>
        </div>
      );
    }

    if (!top) {
      return (
        <div className="feed-message">
          <p className="feed-message-title">
            {source === 'recommendations' ? (pickingCommander ? 'No commanders match' : "That's everything") : 'Fim desta pilha'}
          </p>
          <p className="feed-message-sub">
            {source !== 'recommendations'
              ? 'Escolha outra pilha ou volte às recomendações.'
              : pickingCommander ? 'Try different colors, or clear them to see every commander.'
              : 'No more matches. Swipe down to widen your filters.'}
          </p>
          <button type="button" className="feed-retry" onClick={() => source === 'recommendations' ? setConfigOpen(true) : chooseSource('recommendations')}>
            {source === 'recommendations' ? 'Abrir filtros' : 'Ver recomendações'}
          </button>
        </div>
      );
    }

    return (
      <>
        {second && (
          <SwipeCard
            key={second.id}
            card={second}
            dx={0}
            dy={0}
            animate={false}
            depth={1}
          />
        )}
        <SwipeCard
          key={top.id}
          card={top}
          dx={drag.x}
          dy={drag.y}
          animate={animate}
          depth={0}
        />
      </>
    );
  };

  return (
    <div className="swipe-page">
      <header className="swipe-topbar swipe-topbar-compact">
        <button type="button" className="swipe-nav-icon" onClick={() => navigate('/decks')} aria-label="Meus decks">←</button>
        {editingName ? (
          <input className="swipe-deck-name-input" aria-label="Nome do deck"
            value={nameDraft} maxLength={100} autoFocus
            onChange={e => setNameDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') renameDeck(); if (e.key === 'Escape') setEditingName(false); }}
            onBlur={renameDeck}
          />
        ) : (
          <button type="button" className="swipe-deck-name" aria-label="Renomear deck"
            onClick={() => { setNameDraft(selectedDeck?.title || 'Novo deck'); setEditingName(true); }}>
            {selectedDeck?.title || 'Deck'} <span aria-hidden="true">✎</span>
          </button>
        )}
        <button type="button" className="swipe-nav-icon" aria-label="Escolher outro deck" onClick={() => setWorkspaceMenu(!workspaceMenu)}>⌄</button>
        <button type="button" className="swipe-nav-icon" aria-label="Filtros" onClick={() => setConfigOpen(true)}>⚙</button>
        <button type="button" className="swipe-nav-icon" aria-label="Minhas pilhas" onClick={() => setDeckOpen(true)}>☷</button>
      </header>
      {workspaceMenu && (
        <div className="swipe-workspace-menu">
          <select aria-label="Trocar deck" value={loadedId || ''} onChange={e => {
            const selected = decks.find(d => d.id === e.target.value);
            if (selected) openWorkspace(selected);
            setWorkspaceMenu(false);
          }}>
            {decks.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
          <button type="button" onClick={() => { createWorkspace(); setWorkspaceMenu(false); }}>+ Novo deck</button>
          <button type="button" onClick={() => navigate('/decks/' + loadedId)}>Editar lista</button>
        </div>
      )}

      <div
        key={source}
        className="card-stage swipe-table"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        {renderStack()}
        <div className="swipe-floating-context" onPointerDown={e=>e.stopPropagation()}>
          <button type="button" className="swipe-commander-chip"
            onClick={openCommanderSearch}>
            {commander ? commander.name : pickingCommander ? 'Escolher comandante' : 'Comandante'}
          </button>
          <select aria-label="Pilha no centro" value={source}
            onChange={e => chooseSource(e.target.value as SwipeSource)}>
            {SOURCE_OPTIONS.map(option => <option key={option.id} value={option.id}>
              {option.title} {option.id === 'recommendations' ? '∞' : pileCount(option.id)}
            </option>)}
          </select>
        </div>
        <div
          className={`swipe-corner swipe-corner-sw swipe-trash ${draggingCard && destinationFor(drag.x,drag.y)==='reject' ? 'swipe-target-active' : ''}`}
          aria-label="Descarte fixo: arraste à esquerda ou abaixo à esquerda"
          title="Descarte: esquerda ou diagonal inferior esquerda">
          <span>Descartar</span><span>×</span>
        </div>
        {CORNERS.filter(c=>c.id!=='sw').map(corner => (
          <button type="button"
            className={`swipe-corner swipe-corner-${corner.id} ${draggingCard && destinationFor(drag.x,drag.y)===corner.id ? 'swipe-target-active' : ''} ${source===corners[corner.id] ? 'swipe-target-center' : ''}`}
            key={corner.id}
            onClick={() => chooseSource(corners[corner.id])}
            onPointerDown={e=>e.stopPropagation()}
            aria-label={`Centralizar ${PILES.find(p=>p.id===corners[corner.id])?.title}`}
            title="Toque para centralizar">
            <span>{PILES.find(p=>p.id===corners[corner.id])?.title}</span>
            <span>{pileCount(corners[corner.id])}</span>
          </button>
        ))}
        <button type="button" className="swipe-pile-arrange"
          onPointerDown={e=>e.stopPropagation()}
          onClick={()=>setRepositioning(!repositioning)}
          aria-expanded={repositioning}
          aria-label="Reorganizar pilhas">
          {repositioning ? 'Concluir' : 'Organizar'}
        </button>
        {repositioning && (
          <div className="swipe-pile-arranger" onPointerDown={e=>e.stopPropagation()}>
            <h3>Posição das pilhas</h3>
            <p>Toque em um destino para reposicioná-lo. O descarte permanece abaixo à esquerda.</p>
            {CORNERS.filter(c=>c.id!=='sw').map(c=>(
              <label key={c.id}>
                {c.title}
                <select value={corners[c.id]} onChange={e=>{
                  const next=e.target.value as SwipePile;
                  const old=corners[c.id];
                  const other=(['nw','ne','se'] as SwipeCorner[]).find(key=>key!==c.id && corners[key]===next);
                  const rearranged={...corners,[c.id]:next,...(other?{[other]:old}:{})};
                  setCorners(rearranged);
                  if(loadedId) configureSwiperDeck(loadedId,{corners:rearranged});
                }}>
                  {PILES.map(p=><option value={p.id} key={p.id}>{p.title}</option>)}
                </select>
              </label>
            ))}
            <button type="button" onClick={()=>setRepositioning(false)}>Concluir</button>
          </div>
        )}
        {top && Math.abs(drag.x) > 8 && (
          <div
            className={`swipe-decision-overlay ${drag.x > 0 ? 'swipe-decision-positive' : 'swipe-decision-negative'}`}
            style={{ opacity: Math.min(1, Math.abs(drag.x) / 100) }}
            aria-hidden="true"
          >
            {Math.abs(drag.y) > 35
              ? PILES.find(p => p.id === corners[drag.y < 0
                ? (drag.x < 0 ? 'nw' : 'ne')
                : (drag.x < 0 ? 'sw' : 'se')])?.title
              : drag.x < 0 ? 'PASSAR' : source !== 'recommendations' ? 'MANTER'
                : PILES.find(p => p.id === corners.ne)?.title}
          </div>
        )}

        {/* Edge hints — suppressed when a context banner occupies that edge */}
        <div className="swipe-hint swipe-hint-top">▼ filtros</div>
        {!pickingCommander && !commander && (
          <div className="swipe-hint swipe-hint-bottom">▲ deck</div>
        )}
      </div>

      {/* Swipe gestures handle decisions; keep only the undo action below the card. */}
      <footer className="swipe-actions swipe-actions-undo-only">
        <button
          type="button"
          className="action-btn action-undo"
          onClick={undo}
          disabled={history.current.length === 0 || busy.current}
          aria-label="Desfazer último swipe"
          title="Desfazer último swipe"
        >
          ↺
        </button>
      </footer>

      <ConfigSheet open={configOpen} dragY={configDragY} onClose={() => setConfigOpen(false)} />
      <DeckSheet open={deckOpen} dragY={deckDragY}
        onClose={() => setDeckOpen(false)}
        onReview={list => chooseSource(list)}
      />
      {searchOpen && <CommanderSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
