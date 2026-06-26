import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SwipeCard } from '../components/SwipeCard';
import { ConfigSheet } from '../components/ConfigSheet';
import { DeckSheet } from '../components/DeckSheet';
import { useRecommendationFeed } from '../deck/useFeed';
import { useDeckStore } from '../deck/deckStore';
import type { DeckCard } from '../deck/scryfall';

function vibrate(ms: number) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate?.(ms);
  }
}

type Axis = 'h' | 'v' | null;
type Decision = 'add' | 'reject';

const AXIS_LOCK = 10; // px before we commit to an axis
const FLY_MS = 320;

export function SwipeDeck() {
  const navigate = useNavigate();
  const feed = useRecommendationFeed();
  const addToDeck = useDeckStore((s) => s.addToDeck);
  const reject = useDeckStore((s) => s.reject);
  const skip = useDeckStore((s) => s.skip);
  const setCommander = useDeckStore((s) => s.setCommander);
  const clearCommander = useDeckStore((s) => s.clearCommander);
  const removeFromDeck = useDeckStore((s) => s.removeFromDeck);
  const deckCount = useDeckStore((s) => s.deck.length);
  const commander = useDeckStore((s) => s.commander);

  const pickingCommander = feed.phase === 'commander-select';

  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [animate, setAnimate] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [configDragY, setConfigDragY] = useState(0);
  const [deckDragY, setDeckDragY] = useState(0);

  // Transient gesture state kept in refs to avoid stale-closure bugs.
  const start = useRef({ x: 0, y: 0 });
  const axis = useRef<Axis>(null);
  const pointerId = useRef<number | null>(null);
  const busy = useRef(false);
  const history = useRef<{ card: DeckCard; decision: Decision }[]>([]);

  const top: DeckCard | undefined = feed.queue[0];
  const second: DeckCard | undefined = feed.queue[1];

  const sheetOpen = configOpen || deckOpen;

  const commit = useCallback(
    (decision: Decision) => {
      const card = feed.queue[0];
      if (!card || busy.current) return;
      busy.current = true;
      vibrate(decision === 'add' ? 18 : 10);

      if (decision === 'add') {
        // A "yes" in the commander phase locks in the commander and pivots the
        // whole feed to its color identity; otherwise it's a normal deck add.
        if (pickingCommander) setCommander(card);
        else addToDeck(card);
      } else {
        // Passing on a commander shouldn't train the preference model.
        if (pickingCommander) skip(card);
        else reject(card);
      }
      history.current.push({ card, decision });

      const w = window.innerWidth || 400;
      setAnimate(true);
      setDrag({ x: decision === 'add' ? w * 1.3 : -w * 1.3, y: 0 });

      window.setTimeout(() => {
        feed.advance();
        setAnimate(false);
        setDrag({ x: 0, y: 0 });
        busy.current = false;
      }, FLY_MS);
    },
    [addToDeck, reject, skip, setCommander, pickingCommander, feed],
  );

  const undo = useCallback(() => {
    if (busy.current) return;
    const last = history.current.pop();
    if (!last) return;
    vibrate(8);
    // Reverse the store side-effect (removeFromDeck also clears any rejected
    // flag), then re-show the card on top of the feed.
    removeFromDeck(last.card.oracleId);
    feed.pushFront(last.card);
    setAnimate(false);
    setDrag({ x: 0, y: 0 });
  }, [removeFromDeck, feed]);

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
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      try {
        (e.target as Element).setPointerCapture?.(e.pointerId);
      } catch { /* ignore */ }
    }

    if (axis.current === 'h') {
      setDrag({ x: dx, y: dy * 0.15 });
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
        commit('add');
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
          <button type="button" className="feed-retry" onClick={() => feed.loadMore()}>
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
            interactive={false}
          />
        )}
        <SwipeCard
          key={top.id}
          card={top}
          dx={drag.x}
          dy={drag.y}
          animate={animate}
          depth={0}
          interactive
          addLabel={pickingCommander ? 'COMMANDER' : 'ADD'}
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
          onClick={() => navigate('/')}
          aria-label="Game tracker"
        >
          ⟵ Tracker
        </button>
        <button
          type="button"
          className="topbar-btn deck-pill"
          onClick={() => setDeckOpen(true)}
          aria-label="Deck"
        >
          ♥ {deckCount}
        </button>
      </header>

      {/* Context banner: what the feed is currently doing */}
      {pickingCommander ? (
        <div className="feed-banner feed-banner-commander">
          ⚜ Choose your commander
        </div>
      ) : commander ? (
        <button
          type="button"
          className="feed-banner feed-banner-active"
          onClick={() => { vibrate(10); clearCommander(); }}
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

        {/* Edge hints */}
        {!pickingCommander && !commander && (
          <div className="swipe-hint swipe-hint-top">▼ filters</div>
        )}
        <div className="swipe-hint swipe-hint-bottom">▲ deck</div>
      </div>

      {/* Action buttons (fallback / accessibility) */}
      <footer className="swipe-actions">
        <button
          type="button"
          className="action-btn action-nope"
          onClick={() => commit('reject')}
          disabled={!top}
          aria-label="Reject"
        >
          ✕
        </button>
        <button
          type="button"
          className="action-btn action-undo"
          onClick={undo}
          aria-label="Undo"
        >
          ↺
        </button>
        <button
          type="button"
          className="action-btn action-add"
          onClick={() => commit('add')}
          disabled={!top}
          aria-label="Add to deck"
        >
          ♥
        </button>
      </footer>

      <ConfigSheet open={configOpen} dragY={configDragY} onClose={() => setConfigOpen(false)} />
      <DeckSheet open={deckOpen} dragY={deckDragY} onClose={() => setDeckOpen(false)} />
    </div>
  );
}
