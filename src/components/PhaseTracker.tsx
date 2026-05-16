import { useRef, useEffect } from 'react';
import { PHASES, useStore } from '../store';

interface Props {
  rowSpan?: number;
  colSpan?: number;
}

export function PhaseTracker({ rowSpan = 1, colSpan = 1 }: Props) {
  const currentPhase = useStore((s) => s.currentPhase);
  const setPhase = useStore((s) => s.setPhase);
  const nextPhase = useStore((s) => s.nextPhase);
  const turn = useStore((s) => s.turn);
  const newTurn = useStore((s) => s.newTurn);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentPhase]);

  const expanded = rowSpan >= 2;
  const big = expanded && colSpan >= 2;

  return (
    <div
      className="widget-card rounded-2xl overflow-hidden h-full w-full flex flex-col min-h-0"
      style={{ background: 'var(--color-surface)' }}
    >
      <div
        className={`flex items-center justify-between gap-2 shrink-0 ${
          expanded ? 'px-3 pt-2 pb-1' : 'px-2.5 pt-1 pb-0.5'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`font-bold tracking-wider uppercase text-text-secondary ${
              expanded ? 'text-xs' : 'text-[9px]'
            }`}
          >
            Turn
          </span>
          <span
            className={`font-bold tabular-nums text-accent leading-none ${
              big ? 'text-2xl' : expanded ? 'text-base' : 'text-sm'
            }`}
          >
            {turn}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className={`counter-btn rounded-md font-bold uppercase tracking-wide
                       bg-accent/15 text-accent hover:bg-accent/25 active:bg-accent/35
                       ${expanded ? 'px-3 py-1.5 text-[11px]' : 'px-2 py-0.5 text-[10px]'}`}
            onClick={nextPhase}
          >
            Next →
          </button>
          <button
            className={`counter-btn rounded-md font-bold uppercase tracking-wide
                       bg-surface-alt text-text-secondary hover:bg-surface-hover active:text-text-primary
                       ${expanded ? 'px-3 py-1.5 text-[11px]' : 'px-2 py-0.5 text-[10px]'}`}
            onClick={newTurn}
          >
            New
          </button>
        </div>
      </div>

      <div
        className={`flex gap-1 ${
          expanded
            ? 'px-2 pb-2 flex-1 flex-wrap content-center justify-center items-stretch min-h-0'
            : 'px-1.5 pb-1 overflow-x-auto scroll-hide min-h-0'
        }`}
      >
        {PHASES.map((phase, i) => {
          const active = i === currentPhase;
          const passed = i < currentPhase;
          return (
            <button
              key={phase}
              ref={active ? activeRef : undefined}
              className={`phase-chip shrink-0
                         ${expanded ? 'flex-1 min-w-[5rem] px-3 py-1.5 text-[11px]' : 'px-2 py-0.5 text-[10px]'}
                         rounded-md font-bold select-none whitespace-nowrap
                         ${active
                           ? 'bg-accent text-white shadow shadow-accent/30'
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
