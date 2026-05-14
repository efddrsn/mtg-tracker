import { useRef, useEffect } from 'react';
import { PHASES, useStore } from '../store';

export function PhaseTracker() {
  const currentPhase = useStore((s) => s.currentPhase);
  const setPhase = useStore((s) => s.setPhase);
  const nextPhase = useStore((s) => s.nextPhase);
  const turn = useStore((s) => s.turn);
  const newTurn = useStore((s) => s.newTurn);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentPhase]);

  return (
    <div className="widget-card rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)' }}>
      {/* Turn header + actions */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold tracking-wider uppercase text-text-secondary">
            Turn
          </span>
          <span className="text-base font-bold tabular-nums text-accent">{turn}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="counter-btn px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide
                       bg-accent/15 text-accent hover:bg-accent/25 active:bg-accent/35"
            onClick={nextPhase}
          >
            Next →
          </button>
          <button
            className="counter-btn px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wide
                       bg-surface-alt text-text-secondary hover:bg-surface-hover active:text-text-primary"
            onClick={newTurn}
          >
            New Turn
          </button>
        </div>
      </div>

      {/* Phase chips row */}
      <div className="flex gap-1 px-2 pb-2 overflow-x-auto scroll-hide">
        {PHASES.map((phase, i) => {
          const active = i === currentPhase;
          const passed = i < currentPhase;
          return (
            <button
              key={phase}
              ref={active ? activeRef : undefined}
              className={`phase-chip shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold
                         select-none whitespace-nowrap
                         ${active
                           ? 'bg-accent text-white shadow-lg shadow-accent/30'
                           : passed
                             ? 'bg-white/[0.03] text-text-dim'
                             : 'bg-white/[0.06] text-text-secondary hover:bg-white/10'
                         }`}
              onClick={() => setPhase(i)}
            >
              {phase}
            </button>
          );
        })}
      </div>
    </div>
  );
}
