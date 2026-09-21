import { useState } from 'react';
import type { DeckCard } from '../deck/scryfall';
import { BrazilPriceBadge } from './BrazilPriceBadge';

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
  // Label shown on the right-swipe badge (e.g. "ADD" or "COMMANDER").
  addLabel?: string;
}

// Visual rotation follows horizontal drag, Tinder-style.
function rotation(dx: number): number {
  return Math.max(-18, Math.min(18, dx / 14));
}

export function SwipeCard({
  card,
  dx,
  dy,
  animate,
  depth,
  interactive,
  addLabel = 'ADD',
}: SwipeCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const img = flipped && card.backImage ? card.backImage : card.image;

  const scale = depth === 0 ? 1 : 1 - depth * 0.05;
  const translateY = depth === 0 ? dy : depth * 14 + dy * 0.4;
  const translateX = depth === 0 ? dx : 0;

  // Right-up and right-down are two distinct positive decisions. Keeping the
  // labels visible during the drag makes the diagonal gesture discoverable.
  const rightOpacity = interactive ? Math.max(0, Math.min(1, dx / 110)) : 0;
  const commanderMode = addLabel === 'COMMANDER';
  const wishOpacity = commanderMode
    ? rightOpacity
    : rightOpacity * Math.max(0, Math.min(1, (-dy + 34) / 78));
  const ownedOpacity = commanderMode
    ? 0
    : rightOpacity * Math.max(0, Math.min(1, (dy + 34) / 78));
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
        {commanderMode ? (
          <div className="swipe-badge swipe-badge-add swipe-badge-wide" style={{ opacity: wishOpacity }}>
            COMMANDER
          </div>
        ) : (
          <>
            <div className="swipe-badge swipe-badge-wishlist" style={{ opacity: wishOpacity }}>
              WISHLIST ↗
            </div>
            <div className="swipe-badge swipe-badge-owned" style={{ opacity: ownedOpacity }}>
              JÁ TENHO ↘
            </div>
          </>
        )}
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
        {depth === 0 && (
          <BrazilPriceBadge
            name={card.name}
            setCode={card.setCode}
            collectorNumber={card.collectorNumber}
            className="swipe-price"
          />
        )}
      </div>
    </div>
  );
}
