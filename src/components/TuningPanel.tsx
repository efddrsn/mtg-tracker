import { useRef, useState } from 'react';
import { useDeckStore } from '../deck/deckStore';

interface TuningPanelProps {
  open: boolean;
  dragX: number; // live drag offset while OPENING from the edge tab (negative = pulling in)
  onClose: () => void;
}

// A compact explanation of the recommendation context. The former local
// feature dials were removed when Recommander became the primary ranker.
export function TuningPanel({ open, dragX, onClose }: TuningPanelProps) {
  const swipeCount = useDeckStore((s) => s.swipeCount);
  const deckCount = useDeckStore((s) => s.deck.length);
  const rejectedCount = useDeckStore((s) => s.rejected.length);

  // Drag-to-close on the panel's own grabber — the mirror gesture to the edge
  // tab's drag-to-open, so the panel swipes in AND out.
  const [closeDrag, setCloseDrag] = useState(0);
  const closing = useRef(false);
  const closeStartX = useRef(0);

  const onGrabberDown = (e: React.PointerEvent) => {
    closing.current = true;
    closeStartX.current = e.clientX;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch { /* ignore */ }
  };
  const onGrabberMove = (e: React.PointerEvent) => {
    if (!closing.current) return;
    setCloseDrag(Math.max(0, e.clientX - closeStartX.current));
  };
  const onGrabberUp = () => {
    if (!closing.current) return;
    closing.current = false;
    const threshold = (window.innerWidth || 400) * 0.22;
    if (closeDrag > threshold) onClose();
    setCloseDrag(0);
  };

  const dragging = dragX !== 0 || closeDrag !== 0;

  return (
    <>
      <div
        className={`sheet-scrim ${open ? 'sheet-scrim-on' : ''}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="tune-panel"
        style={{
          transform: open
            ? `translateX(${closeDrag}px)`
            : `translateX(calc(100% + ${dragX}px))`,
          transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.22,0.61,0.36,1)',
        }}
        role="dialog"
        aria-label="Recommendation tuning"
      >
        <div
          className="tune-grabber"
          onPointerDown={onGrabberDown}
          onPointerMove={onGrabberMove}
          onPointerUp={onGrabberUp}
          onPointerCancel={onGrabberUp}
          aria-hidden
        />
        <div className="tune-body">
          <div className="sheet-header">
            <h2>🎛 Tuning</h2>
            <button type="button" className="sheet-text-btn" onClick={onClose}>
              Close
            </button>
          </div>

          <p className="tune-summary">
            {swipeCount} swipe{swipeCount === 1 ? '' : 's'} · {deckCount} selected ·{' '}
            {rejectedCount} passed
          </p>

          <section className="tune-section">
            <label className="cfg-label">🧠 How ranking adapts</label>
            <div className="tune-empty">
              <p>
                Cards you add become input to Recommander, so each “yes” refines the next
                suggestions around the deck you are actually building.
              </p>
              <p className="tune-empty-hint">
                A “no” excludes that exact card. It is not sent as a fake negative card because
                the API has no negative-feedback field; doing so would teach the opposite signal.
              </p>
              <p className="tune-empty-hint">
                If the service is unavailable, the feed automatically falls back to legal,
                EDHREC-ranked Scryfall cards.
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
