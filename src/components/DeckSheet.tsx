import { useMemo, useState } from 'react';
import { useDeckStore } from '../deck/deckStore';
import { groupDeckCards } from '../deck/deckPresentation';
import { AddCardSearch } from './AddCardSearch';

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
  const [addOpen, setAddOpen] = useState(false);

  const totalPrice = useMemo(
    () =>
      deck.reduce((sum, c) => sum + (c.priceUsd ? parseFloat(c.priceUsd) : 0), 0),
    [deck],
  );
  const groupedDeck = useMemo(() => groupDeckCards(deck), [deck]);

  const exportList = () => {
    const text = groupedDeck
      .map(({ card, count }) => `${count} ${card.name}`)
      .join('\n');
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
            <button type="button" className="sheet-text-btn" onClick={() => setAddOpen(true)}>
              + Add
            </button>
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
            groupedDeck.map(({ card, count }) => (
              <div key={card.oracleId} className="deck-row">
                {card.image && (
                  <img
                    src={card.image}
                    alt=""
                    className="deck-row-thumb"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                )}
                <div className="deck-row-main">
                  <span className="deck-row-name">
                    {card.name}
                    {count > 1 && <span className="deck-row-quantity"> ×{count}</span>}
                  </span>
                  <span className="deck-row-meta">
                    {manaSymbols(card.manaCost)} · {card.typeLine.split('—')[0].trim()}
                  </span>
                </div>
                <button
                  type="button"
                  className="deck-row-remove"
                  onClick={() => removeFromDeck(card.oracleId)}
                  aria-label={`Remove ${card.name}`}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>
      {addOpen && <AddCardSearch onClose={() => setAddOpen(false)} />}
    </>
  );
}
