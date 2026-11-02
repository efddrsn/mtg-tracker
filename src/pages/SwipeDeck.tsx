import { useCallback, useEffect, useRef, useState } from 'react';
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
  const decks=useHubStore(s=>s.decks.filter(d=>!d.deletedAt));
  const active=useHubStore(s=>s.decks.find(d=>d.id===s.activeDeckId&&!d.deletedAt));
  const feed = useRecommendationFeed();
  const moveCard = useDeckStore((s) => s.moveCard);
  const reject = useDeckStore((s) => s.reject);
  const skip = useDeckStore((s) => s.skip);
  const setCommander = useDeckStore((s) => s.setCommander);
  const removeFromList = useDeckStore((s) => s.removeFromList);
  const wishlistCount = useDeckStore((s) => s.wishlist.length);
  const deckCount = useDeckStore((s) => s.deck.length);

  const commander = useDeckStore((s) => s.commander);
  const deckCards = useDeckStore(s=>s.deck);
  const wishlistCards = useDeckStore(s=>s.wishlist);
  const maybeCards = useDeckStore(s=>s.maybe);
  const ownedCards = useDeckStore(s=>s.owned);
  const collections = { deck: deckCards, wishlist: wishlistCards, maybe: maybeCards, owned: ownedCards };
  const [source, setSource] = useState<SwipeSource>('recommendations');
  const [reviewIndex, setReviewIndex] = useState(0);
  const [corners, setCorners] = useState<Record<SwipeCorner, SwipePile>>({
    nw: 'maybe', ne: 'wishlist', sw: 'deck', se: 'owned',
  });
  const [loadedId, setLoadedId] = useState<string | null>(null);
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

  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [animate, setAnimate] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [configDragY, setConfigDragY] = useState(0);
  const [deckDragY, setDeckDragY] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  // Auto-offer the commander search once when entering the commander phase.
  const autoOffered = useRef(false);

  // Offer the name search the first time we land in the commander phase; the
  // player can dismiss it and swipe instead.
  useEffect(() => {
    if (pickingCommander && !autoOffered.current) {
      autoOffered.current = true;
      setSearchOpen(true);
    }
    if (!pickingCommander) autoOffered.current = false;
  }, [pickingCommander]);

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
    (decision: Decision) => {
      const card = feed.queue[0];
      if (!card || busy.current) return;
      busy.current = true;
      vibrate(decision === 'reject' ? 10 : 18);

      if (decision !== 'reject') {
        // A "yes" in the commander phase locks in the commander and pivots the
        // whole feed to its color identity; otherwise it's a normal deck add.
        if (pickingCommander) setCommander(card);
        else if (decision === 'owned') addToOwned(card);
        else addToWishlist(card);
      } else {
        // Passing on a commander shouldn't train the preference model.
        if (pickingCommander) skip(card);
        else reject(card);
      }
      history.current.push({ card, decision });

      const w = window.innerWidth || 400;
      setAnimate(true);
      const h = window.innerHeight || 700;
      setDrag({
        x: decision === 'reject' ? -w * 1.3 : w * 1.3,
        y: decision === 'wishlist' ? -h * 0.42 : decision === 'owned' ? h * 0.42 : 0,
      });

      window.setTimeout(() => {
        feed.advance();
        setAnimate(false);
        setDrag({ x: 0, y: 0 });
        busy.current = false;
      }, FLY_MS);
    },
    [addToWishlist, addToOwned, reject, skip, setCommander, pickingCommander, feed],
  );

  const undo = useCallback(() => {
    if (busy.current) return;
    const last = history.current.pop();
    if (!last) return;
    vibrate(8);
    // Reverse the store side-effect (removeFromDeck also clears any rejected
    // flag), then re-show the card on top of the feed.
    removeFromList(last.decision === 'owned' ? 'owned' : 'wishlist', last.card.oracleId);
    feed.pushFront(last.card);
    setAnimate(false);
    setDrag({ x: 0, y: 0 });
  }, [removeFromList, feed]);

  // --- Pointer gesture handling ---------------------------------------------

  const onPointerDown = (e: React.PointerEvent) => {
    if (sheetOpen || busy.current || !top) return;
    pointerId.current = e.pointerId;
    start.current = { x: e.clientX, y: e.clientY };
    axis.current = null;
    setAnimate(false);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId || busy.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (axis.current === null) {
      if (Math.abs(dx) < AXIS_LOCK && Math.abs(dy) < AXIS_LOCK) return;
      axis.current = Math.abs(dx) > Math.abs(dy) * 0.55 ? 'h' : 'v';
      try {
        (e.target as Element).setPointerCapture?.(e.pointerId);
      } catch { /* ignore */ }
    }

    if (axis.current === 'h') {
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

    if (locked === 'h') {
      const threshold = (window.innerWidth || 400) * 0.26;
      if (dx > threshold) {
        commit(pickingCommander || dy <= 0 ? 'wishlist' : 'owned');
      } else if (dx < -threshold) {
        commit('reject');
      } else {
        setAnimate(true);
        setDrag({ x: 0, y: 0 });
      }
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
    if (feed.error && feed.queue.length === 0) {
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

    if (!top && feed.loading) {
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
            {pickingCommander ? 'No commanders match' : "That's everything"}
          </p>
          <p className="feed-message-sub">
            {pickingCommander
              ? 'Try different colors, or clear them to see every commander.'
              : 'No more matches. Swipe down to widen your filters.'}
          </p>
          <button type="button" className="feed-retry" onClick={() => setConfigOpen(true)}>
            Open filters
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
      {/* Top bar: minimal — title cue + filters affordance */}
      <header className="swipe-topbar">
        <button
          type="button"
          className="topbar-btn"
          onClick={() => setConfigOpen(true)}
          aria-label="Filters"
        >
          ⚙
        </button>
        <button
          type="button"
          className="topbar-btn topbar-tracker"
          onClick={() => navigate(activeId?'/decks/'+activeId:'/')}
          aria-label={active?'Voltar ao deck':'Magic Hub'}
        >
          ⟵ {active?'Meu deck':'Magic Hub'}
        </button>
        <button
          type="button"
          className="topbar-btn deck-pill"
          onClick={() => setDeckOpen(true)}
          aria-label="Deck"
        >
          ♡ {wishlistCount} · ✓ {ownedCount}
        </button>
      </header>

      {!pickingCommander && <div className="px-4 py-1 text-center text-[10px] text-text-dim" role="status">{feed.loading&&!top?'Buscando sinergias…':feed.source==='model'?'Sinergia com seu deck · Recommander':feed.source==='commander-top-picks'?'Top picks do comandante · sinergia temporariamente indisponível':'Populares no formato · sem recomendação personalizada'}</div>}
      {/* Context banner: what the feed is currently doing */}
      {pickingCommander ? (
        <button
          type="button"
          className="feed-banner feed-banner-commander"
          onClick={() => setSearchOpen(true)}
        >
          ⚜ Choose your commander
          <span className="feed-banner-change">🔍 search</span>
        </button>
      ) : commander ? (
        <button
          type="button"
          className="feed-banner feed-banner-active"
          onClick={() => { vibrate(10); setSearchOpen(true); }}
        >
          <span className="feed-banner-label">⚜ {commander.name}</span>
          <span className="feed-banner-change">change</span>
        </button>
      ) : null}

      <div
        className="card-stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        {renderStack()}
        {top && Math.abs(drag.x) > 8 && (
          <div
            className={`swipe-decision-overlay ${drag.x > 0 ? 'swipe-decision-positive' : 'swipe-decision-negative'}`}
            style={{ opacity: Math.min(1, Math.abs(drag.x) / 100) }}
            aria-hidden="true"
          >
            {drag.x < 0 ? 'PASSAR' : pickingCommander ? 'COMANDANTE' : drag.y > 0 ? 'JÁ TENHO' : 'WISHLIST'}
          </div>
        )}

        {/* Edge hints — suppressed when a context banner occupies that edge */}
        <div className="swipe-hint swipe-hint-top">▼ filters</div>
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
      <DeckSheet open={deckOpen} dragY={deckDragY} onClose={() => setDeckOpen(false)} />
      {searchOpen && <CommanderSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
