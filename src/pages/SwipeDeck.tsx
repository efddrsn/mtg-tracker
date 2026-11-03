import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { makeDeck, useHubStore, toCard, type HubDeck, type ListLabel, type SwiperPileDefinition, type SwipeSource } from '../deck/hubStore';
import { configureSwiperDeck, loadSwiperDeck, persistSwiperDeck, swipeSessionFor } from '../deck/swiperWorkspace';
import { addPile, aggregateTaggedCards, assignCustomPile, changePile, findRadialTarget, fromRecommendationCard, isRightSide, normalizePiles, removeCustomCard } from '../deck/swiperPiles';
import { SwiperRadialPiles } from '../components/SwiperRadialPiles';
import { SwiperWorkspaceChooser } from '../components/SwiperWorkspaceChooser';
import { useLocation, useNavigate } from 'react-router-dom';
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
const CORE_SECTIONS = ['deck', 'sideboard', 'maybe'] as const;
const CORE_STATUS = ['wishlist', 'owned', 'none'] as const;
const cardIdentity = (a: { oracleId?: string; name: string }, b: { oracleId?: string; name: string }) =>
  a.oracleId && b.oracleId ? a.oracleId === b.oracleId : a.name === b.name;

const AXIS_LOCK = 10; // px before we commit to an axis
const FLY_MS = 320;

export function SwipeDeck() {
  const navigate = useNavigate();
  const location = useLocation();
  const explicitDeckId = (location.state as { selectedDeckId?: string } | null)?.selectedDeckId;
  const allDecks=useHubStore(s=>s.decks);
  const decks=allDecks.filter(d=>!d.deletedAt);
  const feed = useRecommendationFeed();

  const commander = useDeckStore((s) => s.commander);
  const deckCards = useDeckStore(s=>s.deck);
  const wishlistCards = useDeckStore(s=>s.wishlist);
  const maybeCards = useDeckStore(s=>s.maybe);
  const ownedCards = useDeckStore(s=>s.owned);
  const sideCards = useDeckStore(s=>s.sideboard);
  const collections = { deck: deckCards, sideboard: sideCards, wishlist: wishlistCards, maybe: maybeCards, owned: ownedCards };
  const [piles, setPiles] = useState<SwiperPileDefinition[]>(() => normalizePiles());
  const [choosingWorkspace, setChoosingWorkspace] = useState(!explicitDeckId);
  function pileCards(id: string) {
    if (id === 'recommendations' || id === 'none') return [] as DeckCard[];
    if (id === 'deck' || id === 'sideboard' || id === 'wishlist' || id === 'maybe' || id === 'owned') return collections[id];
    if (id.startsWith('aggregate:')) return aggregateTaggedCards(decks, id.slice(10)).map(toCard);
    return piles.find(p=>p.id===id)?.cards?.map(toCard) || [];
  }
  const pileCount = (id: string) => (pileCards(id) as (DeckCard & {quantity?:number})[]).reduce((count, card) => count + (card.quantity || 1), 0);
  function savePiles(updated: SwiperPileDefinition[]) {
    setPiles(updated);
    if (loadedRef.current) configureSwiperDeck(loadedRef.current,{piles:updated});
  }
  const [source, setSource] = useState<string>('recommendations');
  const [reviewIndex, setReviewIndex] = useState(0);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [draggingCard, setDraggingCard] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const selectedDeck = decks.find(d => d.id === loadedId);
  function renameDeck() {
    const title = nameDraft.trim().slice(0, 100);
    if (title && selectedDeck && title !== selectedDeck.title) {
      useHubStore.getState().save({ ...selectedDeck, title, updatedAt: Date.now() });
    }
    setEditingName(false);
  }
  const loadedRef = useRef<string | null>(null);
  // The Swiper never silently creates a deck or guesses the active one.
  // Explicit user selection keeps legacy deck/card state untouched until opened.
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

  function chooseSource(next: string) {
    setSource(next);
    setReviewIndex(0);
    if (loadedId && !next.startsWith('aggregate:'))
      configureSwiperDeck(loadedId, { source: next as SwipeSource, reviewIndex: 0 });
    history.current = [];
  }
  function advanceReview(index: number) {
    setReviewIndex(index);
    if (loadedId) configureSwiperDeck(loadedId, { reviewIndex: index });
  }
  function openWorkspace(deck: HubDeck) {
    if (loadedRef.current && loadedRef.current !== deck.id) persistSwiperDeck(loadedRef.current);
    loadSwiperDeck(deck);
    loadedRef.current = deck.id;
    const session = swipeSessionFor(deck);
    setSource(session.source);
    setReviewIndex(session.reviewIndex);
    setPiles(normalizePiles(session.piles));
    setLoadedId(deck.id);
    setChoosingWorkspace(false);
    history.current = [];
  }
  function createWorkspace(title = 'Nova lista', label: ListLabel = 'none') {
    const created = { ...makeDeck(title), label };
    useHubStore.getState().save(created);
    openWorkspace(created);
  }
  useEffect(() => {
    if (!explicitDeckId || loadedRef.current === explicitDeckId) return;
    const selected = useHubStore.getState().decks.find(d=>d.id===explicitDeckId && !d.deletedAt);
    if (selected) openWorkspace(selected);
  }, [explicitDeckId, decks.length]);
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
    if (!choosingWorkspace && pickingCommander && source === 'recommendations' && !autoOffered.current) {
      autoOffered.current = true;
      setSearchOpen(true);
    }
    if (!pickingCommander || source !== 'recommendations') autoOffered.current = false;
  }, [pickingCommander, source, choosingWorkspace]);

  // Transient gesture state kept in refs to avoid stale-closure bugs.
  const start = useRef({ x: 0, y: 0 });
  const axis = useRef<Axis>(null);
  const pointerId = useRef<number | null>(null);
  const busy = useRef(false);
  const history = useRef<{
    card: DeckCard; source: string; index: number;
    state: ReturnType<typeof snapshot>; piles: SwiperPileDefinition[];
  }[]>([]);
  const reviewCards = source === 'recommendations' ? [] : pileCards(source);
  const top: DeckCard | undefined = source === 'recommendations' ? feed.queue[0] : reviewCards[reviewIndex];
  const second: DeckCard | undefined = source === 'recommendations' ? feed.queue[1] : reviewCards[reviewIndex + 1];
  function snapshot() {
    const state = useDeckStore.getState();
    return {
      deck: [...state.deck], sideboard: [...state.sideboard], positive: [...state.positive], wishlist: [...state.wishlist],
      maybe: [...state.maybe], owned: [...state.owned],
      rejected: [...state.rejected], commander: state.commander,
      swipeCount: state.swipeCount, config: state.config,
      configVersion: state.configVersion,
    };
  }

  const sheetOpen = configOpen || deckOpen;


  const commit = useCallback((destination: string) => {
    if (!top || busy.current || !loadedId || choosingWorkspace) return;
    const target = piles.find(p => p.id === destination);
    if (destination !== 'reject' && destination !== 'keep' && (!target || target.deleted)) return;
    busy.current = true;
    vibrate(destination === 'reject' ? 10 : 18);
    history.current.push({ card: top, source, index: reviewIndex, state: snapshot(), piles });
    const reviewing = source !== 'recommendations';
    const apply = () => {
      const store = useDeckStore.getState();
      let changed = piles;
      if (destination === 'keep') {
        if (reviewing) advanceReview(reviewIndex + 1);
      } else if (destination === 'reject') {
        if (reviewing) {
          if (source === 'deck' || source === 'sideboard' || source === 'maybe' ||
              source === 'wishlist' || source === 'owned') {
            store.removeFromList(source, top.oracleId, top);
          } else if (source.startsWith('aggregate:')) {
            store.skip(top);
          } else {
            changed = removeCustomCard(piles, source, fromRecommendationCard(top));
            savePiles(changed);
          }
        } else if (pickingCommander) store.skip(top);
        else store.reject(top);
      } else if (target) {
        // Commander choice always belongs to Main, independent of the radial
        // sorting destination. Don't accidentally move the commander to Side.
        if (pickingCommander && !reviewing) {
          store.setCommander(top);
          if (target.id === 'wishlist' || target.id === 'owned' || target.id === 'none') {
            store.setInterest(top, target.id);
          } else if (![...store.wishlist, ...store.owned].some(c => cardIdentity(c, top))) {
            store.setInterest(top, 'wishlist');
          }
          if (isRightSide(target.angle)) store.reinforceCard(top);
          return;
        }
        const isSection = CORE_SECTIONS.some(id => id === target.id);
        const isStatus = CORE_STATUS.some(id => id === target.id);
        const inSection = [...store.deck, ...store.sideboard, ...store.maybe]
          .some(c => cardIdentity(c, top));
        const explicitNone = piles.find(p => p.id === 'none')?.cards
          ?.some(c => cardIdentity(c, top));
        const hasInterest = [...store.wishlist, ...store.owned]
          .some(c => cardIdentity(c, top)) || explicitNone;
        if (isSection) {
          store.assignSection(top, target.id as 'deck' | 'sideboard' | 'maybe');
          changed = changed.map(p => p.cards && p.linkedGroup === 'sections'
            ? { ...p, cards: p.cards.filter(c => !cardIdentity(c, top)) } : p);
          if (!hasInterest) store.setInterest(top, 'wishlist');
        } else if (isStatus) {
          store.setInterest(top, target.id as 'wishlist' | 'owned' | 'none');
          if (!inSection) store.assignSection(top, 'deck');
          const nonePile = changed.find(p => p.id === 'none');
          changed = changed.map(p => p.id === 'none' && p.cards
            ? { ...p, cards: p.cards.filter(c => !cardIdentity(c, top)) } : p);
          if (target.id === 'none' && nonePile) changed = assignCustomPile(changed, 'none', fromRecommendationCard(top));
          changed = changed.map(p=>p.cards && p.linkedGroup === 'interest' && p.id !== target.id
            ? { ...p, cards:p.cards.filter(c=>!cardIdentity(c,top)) } : p);
        } else {
          // Membership can coexist across independent groups.
          // Linked groups remove a previous classification in that group.
          if (target.linkedGroup === 'sections') {
            for (const section of CORE_SECTIONS) {
              if (pileCards(section).some(c => cardIdentity(c, top)))
                store.removeFromList(section, top.oracleId, top);
            }
          }
          if (target.linkedGroup === 'interest') {
            store.setInterest(top, 'none');
            if (!inSection) store.assignSection(top, 'deck');
          } else if (target.linkedGroup === 'sections' && !hasInterest) {
            store.setInterest(top, 'wishlist');
          }
          changed = assignCustomPile(changed, target.id, fromRecommendationCard(top));
        }
        if (changed !== piles) savePiles(changed);
        if (isRightSide(target.angle)) store.reinforceCard(top);
      }
      if (reviewing && destination !== 'keep') {
        const updated = useDeckStore.getState();
        const remains = source.startsWith('aggregate:') ? true :
          source === 'deck' || source === 'sideboard' || source === 'maybe' ||
          source === 'wishlist' || source === 'owned'
            ? updated[source].some(c => cardIdentity(c, top))
            : (changed.find(p=>p.id===source)?.cards || []).some(c=>cardIdentity(c,top));
        advanceReview(reviewIndex + (remains ? 1 : 0));
      }
    };
    const w = window.innerWidth || 390, h = window.innerHeight || 700;
    const rad = (target?.angle || 270) * Math.PI / 180;
    setAnimate(true);
    setDrag({
      x: destination === 'reject' ? -w * 1.35 : destination === 'keep' ? w * 1.25 : Math.sin(rad) * w * 1.4,
      y: destination === 'reject' ? h * .2 : destination === 'keep' ? 0 : -Math.cos(rad) * h * .56,
    });
    window.setTimeout(() => {
      // Do not apply a delayed swipe to another deck after a fast switch.
      if (loadedRef.current === loadedId) {
        apply();
        if (!reviewing) feed.advance();
      }
      setAnimate(false);
      setDrag({ x:0, y:0 });
      busy.current = false;
    }, FLY_MS);
  }, [top, loadedId, choosingWorkspace, piles, source, reviewIndex, pickingCommander, feed]);

  const undo = useCallback(() => {
    if (busy.current) return;
    const last = history.current.pop();
    if (!last) return;
    vibrate(8);
    useDeckStore.setState(last.state);
    savePiles(last.piles);
    if (last.source === 'recommendations') feed.pushFront(last.card);
    setSource(last.source);
    advanceReview(last.index);
    setAnimate(false);
    setDrag({ x:0, y:0 });
  }, [feed, loadedId]);
  // Keyboard support mirrors the radial clock in clockwise order.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (choosingWorkspace || configOpen || deckOpen || searchOpen || !top) return;
      if ((event.target as HTMLElement | null)?.closest('input,select,textarea,button,[contenteditable="true"]')) return;
      const clockwise = piles.filter(p => p.visible && !p.deleted).sort((a,b) => a.angle-b.angle);
      const index = Number(event.key)-1;
      if (Number.isInteger(index) && index>=0 && index<clockwise.length) {
        event.preventDefault(); commit(clockwise[index].id);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault(); commit('reject');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        const target = clockwise.find(p => isRightSide(p.angle));
        if (target) commit(target.id); else commit('keep');
      } else if (event.key === 'Backspace' ||
        (event.key.toLowerCase() === 'z' && (event.metaKey || event.ctrlKey))) {
        event.preventDefault(); undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [choosingWorkspace, configOpen, deckOpen, searchOpen, top, piles, commit, undo]);

  // --- Pointer gesture handling ---------------------------------------------

  const onPointerDown = (e: React.PointerEvent) => {
    if (choosingWorkspace || sheetOpen || busy.current || !top) return;
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
      // The entire clock, including vertical sectors, is available to swipe.
      // Filters and collection drawer remain accessible from the header.
      axis.current = 'h';
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
        const dest = findRadialTarget(piles, dx, dy);
        if (dest) commit(dest);
        else { setAnimate(true); setDrag({ x:0, y:0 }); }
      } else { setAnimate(true); setDrag({ x:0, y:0 }); }
    }
    setConfigDragY(0);
    setDeckDragY(0);
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

  if (choosingWorkspace) return (
    <SwiperWorkspaceChooser decks={decks} onOpen={openWorkspace}
      onCreate={createWorkspace} onBack={()=>navigate('/decks')} />
  );

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
        <button type="button" className="swipe-nav-icon" aria-label="Escolher outro deck" onClick={() => setChoosingWorkspace(true)}>⌄</button>
        <button type="button" className="swipe-nav-icon" aria-label="Filtros" onClick={() => setConfigOpen(true)}>⚙</button>
        <button type="button" className="swipe-nav-icon" aria-label="Minhas pilhas" onClick={() => setDeckOpen(true)}>☷</button>
      </header>
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
          <button type="button" className="swipe-commander-chip" onClick={openCommanderSearch}>
            {commander ? commander.name : pickingCommander ? 'Escolher comandante' : 'Comandante'}
          </button>
          <select aria-label="Pilha central" value={source}
            onChange={e=>chooseSource(e.target.value)}>
            <option value="recommendations">Recomendações ∞</option>
            {piles.filter(p=>!p.deleted && p.id!=='none').map(p=>
              <option value={p.id} key={p.id}>{p.name} {pileCount(p.id)}</option>)}
            {source.startsWith('aggregate:') && <option value={source}>Todas #{source.slice(10)}</option>}
          </select>
        </div>
        <SwiperRadialPiles piles={piles} activeSource={source}
          activeTarget={draggingCard ? findRadialTarget(piles,drag.x,drag.y) : null}
          dragging={draggingCard} count={pileCount} onCenter={chooseSource}
          onAggregate={tag=>chooseSource('aggregate:'+tag)}
          onUpdate={(id,changes)=>savePiles(changePile(piles,id,changes))}
          onAdd={(name,tag,angle,group)=>savePiles(addPile(piles,{
            name,tag,angle,linkedGroup:group,
          }))}/>
        {top && Math.hypot(drag.x, drag.y) > 8 && (
          <div className={`swipe-decision-overlay ${findRadialTarget(piles,drag.x,drag.y)==='reject' ? 'swipe-decision-negative' : 'swipe-decision-positive'}`}
            style={{opacity:Math.min(1,Math.hypot(drag.x,drag.y)/110)}} aria-hidden="true">
            {findRadialTarget(piles,drag.x,drag.y)==='reject'
              ? 'DESCARTAR'
              : piles.find(p=>p.id===findRadialTarget(piles,drag.x,drag.y))?.name || ''}
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
