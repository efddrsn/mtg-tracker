import { useRef, useEffect } from 'react';
import { PHASES, SUB_STEPS, useStore } from '../store';

interface Props {
  rowSpan?: number;
  colSpan?: number;
}

export function PhaseTracker({ rowSpan = 1, colSpan = 1 }: Props) {
  const currentPhase = useStore((s) => s.currentPhase);
  const subPhase = useStore((s) => s.subPhase);
  const nextPhase = useStore((s) => s.nextPhase);
  const prevPhase = useStore((s) => s.prevPhase);
  const turn = useStore((s) => s.turn);
  const showSubSteps = useStore((s) => s.settings.showSubSteps);
  const opacity = useStore((s) => s.settings.trackerOpacity ?? 1);
  const landDrop = useStore((s) => s.landDrop);
  const toggleLandDrop = useStore((s) => s.toggleLandDrop);
  const activeRef = useRef<HTMLDivElement>(null);

  const currentName = PHASES[currentPhase];
  const isMainPhase = currentName === 'Main 1' || currentName === 'Main 2';

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [currentPhase]);

  const expanded = rowSpan >= 2;
  const big = expanded && colSpan >= 2;
  const huge = rowSpan >= 3 || (rowSpan >= 2 && colSpan >= 3);

  const subs = SUB_STEPS[currentName];
  const hasSubs = showSubSteps && subs.length > 0;

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
      style={{
        background: `linear-gradient(180deg, color-mix(in srgb, var(--color-accent) ${12 * opacity}%, transparent), color-mix(in srgb, var(--color-accent) ${5 * opacity}%, transparent)), rgba(255,255,255,${0.04 * opacity})`,
        boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 45%, transparent), 0 0 22px -6px color-mix(in srgb, var(--color-accent) 55%, transparent), 0 4px 18px rgba(0,0,0,0.35)',
        backdropFilter: opacity > 0.05 ? 'blur(14px) saturate(140%)' : 'none',
        WebkitBackdropFilter: opacity > 0.05 ? 'blur(14px) saturate(140%)' : 'none',
      }}
    >
      {/* Full-area tap zones. Left = previous, right = next. */}
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

      {/* Land-drop reminder — only during main phases. Toggleable, persists this turn. */}
      {isMainPhase && (
        <button
          onClick={(e) => { e.stopPropagation(); toggleLandDrop(); }}
          className={`absolute z-20 flex items-center gap-1 font-bold uppercase tracking-wider
                     rounded-full transition-all select-none
                     ${expanded ? 'top-2 right-2 px-2.5 py-1 text-[10px]' : 'top-1 right-1 px-2 py-0.5 text-[9px]'}`}
          style={{
            background: landDrop
              ? 'color-mix(in srgb, #4ade80 26%, transparent)'
              : 'rgba(255,255,255,0.06)',
            color: landDrop ? '#bbf7d0' : 'rgba(255,255,255,0.65)',
            boxShadow: landDrop
              ? '0 0 18px -4px rgba(74,222,128,0.7), inset 0 0 0 1px rgba(74,222,128,0.55)'
              : 'inset 0 0 0 1px rgba(255,255,255,0.18)',
          }}
          aria-pressed={landDrop}
          aria-label={landDrop ? 'Land drop played this turn' : 'Mark land drop played'}
        >
          <svg width={expanded ? 11 : 9} height={expanded ? 11 : 9} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {landDrop ? (
              <path d="M5 12l4 4L19 7" />
            ) : (
              <circle cx="12" cy="12" r="9" />
            )}
          </svg>
          Land
        </button>
      )}

      {/* Turn indicator — display only. */}
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

      {/* Phase row — display only, taps fall through to tap zones. */}
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
            <div
              key={phase}
              ref={active ? activeRef : undefined}
              className={`phase-chip shrink-0
                         ${expanded ? `flex-1 min-w-[5rem] ${phaseChipCls}` : phaseChipCls}
                         rounded-md font-bold select-none whitespace-nowrap text-center
                         ${active
                           ? 'bg-accent text-white shadow-md shadow-accent/40'
                           : passed
                             ? 'bg-white/[0.04] text-text-dim'
                             : 'bg-white/[0.08] text-text-secondary'
                         }`}
            >
              {phase}
            </div>
          );
        })}
      </div>

      {/* Sub-step row — display only. */}
      {hasSubs && (
        <div
          className={`relative z-10 flex gap-1.5 items-center overflow-x-auto scroll-hide pointer-events-none
                     ${expanded ? 'px-2 pb-2 justify-center flex-wrap' : 'px-1.5 pb-1'}`}
        >
          {subs.map((step, i) => {
            const active = i === subPhase;
            const passed = i < subPhase;
            return (
              <div
                key={step}
                className={`shrink-0 rounded-full font-semibold whitespace-nowrap text-center
                           transition-all duration-150 ${subStepChipCls}
                           ${active
                             ? 'bg-gradient-to-r from-accent to-accent-hover text-white shadow shadow-accent/50 scale-105'
                             : passed
                               ? 'bg-white/[0.04] text-text-dim'
                               : 'bg-white/[0.08] text-text-secondary'
                           }`}
              >
                {step}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
