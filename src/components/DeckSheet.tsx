import { useMemo } from 'react';
import { useDeckStore } from '../deck/deckStore';

interface DeckSheetProps {
  open: boolean;
  dragY: number; // live drag offset while opening (negative = pulling up)
  onClose: () => void;
}

function manaSymbols(cost: string): string {
  // Convert "{2}{U}{U}" into a compact "2UU" for the list view.
  return cost.replace(/[{}]/g, '');
}

export function DeckSheet({ open, dragY, onClose }: DeckSheetProps) {
  const deck = useDeckStore((s) => s.deck);
  const removeFromDeck = useDeckStore((s) => s.removeFromDeck);
  const clearDeck = useDeckStore((s) => s.clearDeck);

  const totalPrice = useMemo(
    () =>
      deck.reduce((sum, c) => sum + (c.priceUsd ? parseFloat(c.priceUsd) : 0), 0),
    [deck],
  );

  const exportList = () => {
    const text = deck.map((c) => `1 ${c.name}`).join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <>
      <div
        className={`sheet-scrim ${open ? 'sheet-scrim-on' : ''}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="deck-sheet"
        style={{
          transform: open
            ? 'translateY(0)'
            : `translateY(calc(100% + ${dragY}px))`,
          transition: dragY === 0 ? 'transform 0.3s cubic-bezier(0.22,0.61,0.36,1)' : 'none',
        }}
        role="dialog"
        aria-label="Your deck"
      >
        <div className="sheet-grabber" />
        <div className="sheet-header">
          <h2>
            Deck <span className="deck-count">{deck.length}</span>
          </h2>
          <div className="deck-header-actions">
            {totalPrice > 0 && (
              <span className="deck-price">${totalPrice.toFixed(2)}</span>
            )}
            {deck.length > 0 && (
              <>
                <button type="button" className="sheet-text-btn" onClick={exportList}>
                  Copy
                </button>
                <button
                  type="button"
                  className="sheet-text-btn sheet-text-danger"
                  onClick={clearDeck}
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        <div className="deck-list">
          {deck.length === 0 ? (
            <div className="deck-empty">
              <p>No cards yet.</p>
              <p className="deck-empty-hint">Swipe right on cards you like.</p>
            </div>
          ) : (
            deck.map((c) => (
              <div key={c.oracleId} className="deck-row">
                {c.image && (
                  <img
                    src={c.image}
                    alt=""
                    className="deck-row-thumb"
                    loading="lazy"
                    draggable={false}
                  />
                )}
                <div className="deck-row-main">
                  <span className="deck-row-name">{c.name}</span>
                  <span className="deck-row-meta">
                    {manaSymbols(c.manaCost)} · {c.typeLine.split('—')[0].trim()}
                  </span>
                </div>
                <button
                  type="button"
                  className="deck-row-remove"
                  onClick={() => removeFromDeck(c.oracleId)}
                  aria-label={`Remove ${c.name}`}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
