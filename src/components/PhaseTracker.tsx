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
  const showSubSteps = useStore((s) => s.settings.showSubSteps);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentPhase]);

  const expanded = rowSpan >= 2;
  const big = expanded && colSpan >= 2;
  const huge = rowSpan >= 3 || (rowSpan >= 2 && colSpan >= 3);

  const currentPhaseName = PHASES[currentPhase];
  const subs = SUB_STEPS[currentPhaseName];
  const hasSubs = showSubSteps && subs.length > 0;

  // Size scales with widget area.
  const phaseChipCls = huge
    ? 'px-4 py-2 text-base'
    : big
      ? 'px-3.5 py-1.5 text-sm'
      : expanded
        ? 'px-3 py-1.5 text-xs'
        : 'px-2 py-0.5 text-[10px]';

  const subStepChipCls = huge
    ? 'px-4 py-2 text-base'
    : big
      ? 'px-3 py-1.5 text-sm'
      : expanded
        ? 'px-2.5 py-1 text-xs'
        : 'px-2 py-0.5 text-[10px]';

  const turnSize = huge
    ? 'text-4xl'
    : big
      ? 'text-3xl'
      : expanded
        ? 'text-xl'
        : 'text-sm';

  const turnLabelSize = huge || big ? 'text-xs' : expanded ? 'text-[11px]' : 'text-[9px]';

  const edgeHintSize = huge ? 'text-4xl' : big ? 'text-3xl' : expanded ? 'text-2xl' : 'text-lg';

  return (
    <div
      className="widget-card relative rounded-2xl overflow-hidden h-full w-full flex flex-col min-h-0"
      style={{ background: 'var(--color-surface)' }}
    >
      {/* Full-area tap zones (under the chips). Left = previous, right = next. */}
      <button
        className="counter-btn absolute inset-y-0 left-0 w-1/2 z-0 flex items-center justify-start pl-2 select-none"
        onClick={prevPhase}
        aria-label="Previous step"
      >
        <span className={`${edgeHintSize} font-bold leading-none text-text-dim opacity-50`} aria-hidden>‹</span>
      </button>
      <button
        className="counter-btn absolute inset-y-0 right-0 w-1/2 z-0 flex items-center justify-end pr-2 select-none"
        onClick={nextPhase}
        aria-label="Next step"
      >
        <span className={`${edgeHintSize} font-bold leading-none text-text-dim opacity-50`} aria-hidden>›</span>
      </button>

      {/* Turn indicator (sits above tap zones, pass-through except its own chip). */}
      <div
        className={`relative z-10 flex items-baseline justify-center gap-1 shrink-0 pointer-events-none
                   ${expanded ? 'pt-2 pb-1' : 'pt-1 pb-0.5'}`}
      >
        <span className={`font-bold tracking-wider uppercase text-text-secondary ${turnLabelSize}`}>
          Turn
        </span>
        <span className={`font-bold tabular-nums text-accent leading-none ${turnSize}`}>
          {turn}
        </span>
      </div>

      {/* Phase chip row */}
      <div
        className={`relative z-10 flex gap-1 pointer-events-none
                   ${expanded
                     ? 'px-2 flex-wrap content-center justify-center items-stretch min-h-0'
                     : 'px-1.5 overflow-x-auto scroll-hide min-h-0'}
                   ${hasSubs ? 'pb-0.5' : expanded ? 'pb-2' : 'pb-1'}`}
      >
        {PHASES.map((phase, i) => {
          const active = i === currentPhase;
          const passed = i < currentPhase;
          return (
            <button
              key={phase}
              ref={active ? activeRef : undefined}
              className={`phase-chip shrink-0 pointer-events-auto
                         ${expanded ? `flex-1 min-w-[5rem] ${phaseChipCls}` : phaseChipCls}
                         rounded-md font-bold select-none whitespace-nowrap
                         ${active
                           ? 'bg-accent text-white shadow-md shadow-accent/40'
                           : passed
                             ? 'bg-white/[0.04] text-text-dim'
                             : 'bg-white/[0.08] text-text-secondary hover:bg-white/15'
                         }`}
              onClick={(e) => { e.stopPropagation(); setPhase(i); }}
            >
              {phase}
            </button>
          );
        })}
      </div>

      {/* Sub-step row */}
      {hasSubs && (
        <div
          className={`relative z-10 flex gap-1.5 items-center overflow-x-auto scroll-hide pointer-events-none
                     ${expanded ? 'px-2 pb-2 justify-center flex-wrap' : 'px-1.5 pb-1'}`}
        >
          {subs.map((step, i) => {
            const active = i === subPhase;
            const passed = i < subPhase;
            return (
              <button
                key={step}
                className={`shrink-0 pointer-events-auto rounded-full font-semibold whitespace-nowrap
                           transition-all duration-150 ${subStepChipCls}
                           ${active
                             ? 'bg-gradient-to-r from-accent to-accent-hover text-white shadow shadow-accent/50 scale-105'
                             : passed
                               ? 'bg-white/[0.04] text-text-dim'
                               : 'bg-white/[0.08] text-text-secondary hover:bg-white/15'
                           }`}
                onClick={(e) => { e.stopPropagation(); setSubPhase(i); }}
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
