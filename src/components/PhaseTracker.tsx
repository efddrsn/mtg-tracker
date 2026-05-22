import { useRef, useEffect } from 'react';
import { PHASES, SUB_STEPS, useStore } from '../store';

interface Props {
  rowSpan?: number;
  colSpan?: number;
}

export function PhaseTracker({ rowSpan = 1, colSpan = 1 }: Props) {
  const currentPhase = useStore((s) => s.currentPhase);
  const subPhase = useStore((s) => s.subPhase);
  const setPhase = useStore((s) => s.setPhase);
  const nextPhase = useStore((s) => s.nextPhase);
  const prevPhase = useStore((s) => s.prevPhase);
  const setSubPhase = useStore((s) => s.setSubPhase);
  const turn = useStore((s) => s.turn);
  const newTurn = useStore((s) => s.newTurn);
  const prevTurn = useStore((s) => s.prevTurn);
  const showSubSteps = useStore((s) => s.settings.showSubSteps);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentPhase]);

  const expanded = rowSpan >= 2;
  const big = expanded && colSpan >= 2;

  const currentPhaseName = PHASES[currentPhase];
  const subs = SUB_STEPS[currentPhaseName];
  const hasSubs = showSubSteps && subs.length > 0;

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
        <div className="flex items-center gap-1">
          <button
            className={`counter-btn rounded-md font-bold
                       bg-white/[0.04] text-text-secondary hover:bg-white/10
                       ${expanded ? 'w-7 h-7 text-sm' : 'w-6 h-6 text-xs'}`}
            onClick={prevTurn}
            disabled={turn <= 1}
            aria-label="Previous turn"
          >
            ‹
          </button>
          <div className="flex items-baseline gap-1">
            <span
              className={`font-bold tracking-wider uppercase text-text-secondary ${
                expanded ? 'text-[10px]' : 'text-[9px]'
              }`}
            >
              T
            </span>
            <span
              className={`font-bold tabular-nums text-accent leading-none ${
                big ? 'text-2xl' : expanded ? 'text-base' : 'text-sm'
              }`}
            >
              {turn}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className={`counter-btn rounded-md font-bold
                       bg-white/[0.04] text-text-secondary hover:bg-white/10
                       ${expanded ? 'w-8 h-8 text-base' : 'w-7 h-7 text-sm'}`}
            onClick={prevPhase}
            aria-label="Previous phase"
          >
            ←
          </button>
          <button
            className={`counter-btn rounded-md font-bold
                       bg-accent text-white hover:bg-accent-hover
                       ${expanded ? 'w-8 h-8 text-base' : 'w-7 h-7 text-sm'}`}
            onClick={nextPhase}
            aria-label="Next phase"
          >
            →
          </button>
          <button
            className={`counter-btn rounded-md font-bold uppercase tracking-wide
                       bg-surface-alt text-text-secondary hover:bg-surface-hover
                       ${expanded ? 'px-2.5 h-8 text-[11px]' : 'px-2 h-7 text-[10px]'}`}
            onClick={newTurn}
            aria-label="New turn"
          >
            New
          </button>
        </div>
      </div>

      <div
        className={`flex gap-1 ${
          expanded
            ? 'px-2 flex-wrap content-center justify-center items-stretch min-h-0'
            : 'px-1.5 overflow-x-auto scroll-hide min-h-0'
        } ${hasSubs ? 'pb-0.5' : expanded ? 'pb-2' : 'pb-1'}`}
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

      {hasSubs && (
        <div
          className={`flex gap-1 items-center overflow-x-auto scroll-hide
                     ${expanded ? 'px-2 pb-2' : 'px-1.5 pb-1'}`}
        >
          <span
            className={`text-[9px] uppercase tracking-wider font-bold text-text-dim shrink-0 pr-0.5
                       ${expanded ? '' : 'hidden'}`}
          >
            Step
          </span>
          {subs.map((step, i) => {
            const active = i === subPhase;
            const passed = i < subPhase;
            return (
              <button
                key={step}
                className={`shrink-0 rounded-full font-semibold whitespace-nowrap
                           transition-all duration-150
                           ${expanded ? 'px-2.5 py-1 text-[10px]' : 'px-2 py-0.5 text-[9px]'}
                           ${active
                             ? 'bg-gradient-to-r from-accent to-accent-hover text-white shadow shadow-accent/40 scale-105'
                             : passed
                               ? 'bg-white/[0.03] text-text-dim'
                               : 'bg-white/[0.05] text-text-secondary hover:bg-white/10'
                           }`}
                onClick={() => setSubPhase(i)}
              >
                {step}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
