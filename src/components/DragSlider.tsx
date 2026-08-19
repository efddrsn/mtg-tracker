import { useRef } from 'react';

interface DragSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  // Diverging bars grow from a centered zero-line (green right / red left) —
  // for the learned-weight rows. Non-diverging bars fill from the left in a
  // single accent color — for the algorithm dials.
  diverging?: boolean;
}

function valueFromClientX(rect: DOMRect, clientX: number, min: number, max: number, step: number) {
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const raw = min + ratio * (max - min);
  const snapped = Math.round(raw / step) * step;
  return Math.max(min, Math.min(max, snapped));
}

// A touch-friendly, tap-to-jump + drag-to-scrub slider, styled either as a
// single fill bar or a diverging (center-anchored) one. Built custom rather
// than a native <input type="range"> so the diverging fill and the track
// itself can be styled and grabbed anywhere along its length.
export function DragSlider({ value, min, max, step, onChange, diverging }: DragSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    onChange(valueFromClientX(el.getBoundingClientRect(), clientX, min, max, step));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch { /* ignore */ }
    update(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    update(e.clientX);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const pct = ((value - min) / (max - min)) * 100;
  const zeroPct = ((0 - min) / (max - min)) * 100;
  const positive = value >= 0;

  const fillStyle: React.CSSProperties = diverging
    ? {
        left: `${Math.min(zeroPct, pct)}%`,
        width: `${Math.abs(pct - zeroPct)}%`,
        background: positive ? 'var(--color-weight-pos)' : 'var(--color-weight-neg)',
      }
    : { left: 0, width: `${pct}%`, background: 'var(--color-accent)' };

  return (
    <div
      ref={trackRef}
      className="drag-slider"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="slider"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      tabIndex={0}
    >
      {diverging && <div className="drag-slider-zero" style={{ left: `${zeroPct}%` }} />}
      <div className="drag-slider-fill" style={fillStyle} />
      <div className="drag-slider-thumb" style={{ left: `${pct}%` }} />
    </div>
  );
}
