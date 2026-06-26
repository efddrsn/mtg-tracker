import { useState } from 'react';
import type { DeckCard } from '../deck/scryfall';

export type SwipeDecision = 'add' | 'reject';

interface SwipeCardProps {
  card: DeckCard;
  // Live drag offset in px (top card only).
  dx: number;
  dy: number;
  // True while a programmatic fly-off / snap transition should animate.
  animate: boolean;
  // Stacking position: 0 = top, 1 = behind, etc.
  depth: number;
  // Whether this card receives the live overlay tint.
  interactive: boolean;
}

// Visual rotation follows horizontal drag, Tinder-style.
function rotation(dx: number): number {
  return Math.max(-18, Math.min(18, dx / 14));
}

export function SwipeCard({ card, dx, dy, animate, depth, interactive }: SwipeCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const img = flipped && card.backImage ? card.backImage : card.image;

  const scale = depth === 0 ? 1 : 1 - depth * 0.05;
  const translateY = depth === 0 ? dy : depth * 14 + dy * 0.4;
  const translateX = depth === 0 ? dx : 0;

  // Overlay opacity derived from horizontal drag magnitude.
  const addOpacity = interactive ? Math.max(0, Math.min(1, dx / 110)) : 0;
  const nopeOpacity = interactive ? Math.max(0, Math.min(1, -dx / 110)) : 0;

  return (
    <div
      className="swipe-card"
      style={{
        transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${
          depth === 0 ? rotation(dx) : 0
        }deg) scale(${scale})`,
        transition: animate
          ? 'transform 0.32s cubic-bezier(0.22, 0.61, 0.36, 1)'
          : 'none',
        zIndex: 100 - depth,
        opacity: depth > 1 ? 0 : 1,
      }}
    >
      <div className="swipe-card-inner">
        {img ? (
          <img
            src={img}
            alt={card.name}
            className="swipe-card-img"
            draggable={false}
            onLoad={() => setLoaded(true)}
            style={{ opacity: loaded ? 1 : 0 }}
          />
        ) : (
          <div className="swipe-card-fallback">{card.name}</div>
        )}

        {!loaded && img && <div className="swipe-card-skeleton" />}

        {/* Decision overlays */}
        <div className="swipe-badge swipe-badge-add" style={{ opacity: addOpacity }}>
          ADD
        </div>
        <div className="swipe-badge swipe-badge-nope" style={{ opacity: nopeOpacity }}>
          NOPE
        </div>

        {/* Double-faced flip control */}
        {card.backImage && depth === 0 && (
          <button
            type="button"
            className="swipe-flip-btn"
            onClick={(e) => {
              e.stopPropagation();
              setFlipped((f) => !f);
            }}
            aria-label="Flip card"
          >
            ⟳
          </button>
        )}
      </div>
    </div>
  );
}
