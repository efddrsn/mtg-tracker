import { useRef, useState } from 'react';
import { useDeckStore } from '../deck/deckStore';
import {
  DEFAULT_TUNING,
  TUNING_FIELDS,
  groupLearnedFeatures,
  summarizePrefs,
} from '../deck/recommender';
import { DragSlider } from './DragSlider';

interface TuningPanelProps {
  open: boolean;
  dragX: number; // live drag offset while OPENING from the edge tab (negative = pulling in)
  onClose: () => void;
}

// The recommender's inspection/tuning surface: every learned weight the model
// has picked up from your swipes, shown as draggable diverging bars grouped
// by category, plus the algorithm's own knobs (like/dislike strength, clamp,
// tribal threshold, …) as draggable dials. Nothing here is read-only — drag
// any bar to correct the model on the spot.
export function TuningPanel({ open, dragX, onClose }: TuningPanelProps) {
  const prefs = useDeckStore((s) => s.prefs);
  const tuning = useDeckStore((s) => s.tuning);
  const swipeCount = useDeckStore((s) => s.swipeCount);
  const setPrefWeight = useDeckStore((s) => s.setPrefWeight);
  const resetPrefs = useDeckStore((s) => s.resetPrefs);
  const setTuningValue = useDeckStore((s) => s.setTuningValue);
  const resetTuning = useDeckStore((s) => s.resetTuning);

  const groups = groupLearnedFeatures(prefs);
  const { learnedCount, topFeature } = summarizePrefs(prefs);

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
            {swipeCount} swipe{swipeCount === 1 ? '' : 's'} · {learnedCount} learned signal
            {learnedCount === 1 ? '' : 's'}
            {topFeature && (
              <>
                {' '}
                · top pull{' '}
                <strong className={topFeature.value >= 0 ? 'tune-pos' : 'tune-neg'}>
                  {topFeature.emoji} {topFeature.label} {topFeature.value >= 0 ? '+' : ''}
                  {topFeature.value.toFixed(1)}
                </strong>
              </>
            )}
          </p>

          {groups.length === 0 ? (
            <div className="tune-empty">
              <p>No learned signals yet.</p>
              <p className="tune-empty-hint">
                Swipe a few cards and what the model picks up shows up here — drag any bar to
                correct it.
              </p>
            </div>
          ) : (
            <>
              {groups.map((g) => (
                <section key={g.category} className="tune-section">
                  <label className="cfg-label">
                    {g.emoji} {g.category}
                  </label>
                  {g.items.map((f) => (
                    <div key={f.key} className="weight-row">
                      <div className="weight-row-head">
                        <span className="weight-row-label">{f.label}</span>
                        <span className={`weight-row-value ${f.value >= 0 ? 'tune-pos' : 'tune-neg'}`}>
                          {f.value >= 0 ? '+' : ''}
                          {f.value.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          className="weight-row-clear"
                          onClick={() => setPrefWeight(f.key, 0)}
                          aria-label={`Clear ${f.label}`}
                        >
                          ×
                        </button>
                      </div>
                      <DragSlider
                        diverging
                        min={-tuning.weightClamp}
                        max={tuning.weightClamp}
                        step={0.1}
                        value={f.value}
                        onChange={(v) => setPrefWeight(f.key, v)}
                      />
                    </div>
                  ))}
                </section>
              ))}
              <button type="button" className="sheet-text-btn sheet-text-danger tune-reset-btn" onClick={resetPrefs}>
                Reset learned weights
              </button>
            </>
          )}

          <section className="tune-section">
            <label className="cfg-label">⚙️ Algorithm dials</label>
            {TUNING_FIELDS.map((field) => (
              <div key={field.key} className="dial-row">
                <div className="weight-row-head">
                  <span className="weight-row-label">
                    {field.emoji} {field.label}
                  </span>
                  <span className="dial-row-value">{tuning[field.key]}</span>
                  <button
                    type="button"
                    className="weight-row-clear"
                    onClick={() => setTuningValue(field.key, DEFAULT_TUNING[field.key])}
                    aria-label={`Reset ${field.label} to default`}
                  >
                    ↺
                  </button>
                </div>
                <p className="dial-hint">{field.hint}</p>
                <DragSlider
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={tuning[field.key]}
                  onChange={(v) => setTuningValue(field.key, v)}
                />
              </div>
            ))}
            <button type="button" className="sheet-text-btn sheet-text-danger tune-reset-btn" onClick={resetTuning}>
              Reset dials to defaults
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
