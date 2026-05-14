import { useRepeatAction } from '../hooks/useRepeatAction';

interface Props {
  value: number;
  label: string;
  symbol?: string;
  bgColor?: string;
  accentColor?: string;
  onInc: () => void;
  onDec: () => void;
  onReset: () => void;
  colSpan?: 1 | 2;
  columns?: number;
}

export function CounterWidget({
  value,
  label,
  symbol,
  bgColor = 'var(--color-surface)',
  accentColor = 'var(--color-accent)',
  onInc,
  onDec,
  onReset,
  colSpan = 1,
}: Props) {
  const decRepeat = useRepeatAction(onDec);
  const incRepeat = useRepeatAction(onInc);
  const isWide = colSpan === 2;

  return (
    <div
      className="widget-card relative flex flex-col rounded-2xl overflow-hidden h-full"
      style={{ background: bgColor, minHeight: isWide ? '4.5rem' : '5.5rem' }}
    >
      {/* Reset button */}
      <button
        className="absolute top-1 right-1 z-10 w-7 h-7 flex items-center justify-center
                   rounded-full text-text-dim hover:text-danger hover:bg-danger/20 text-xs font-bold
                   transition-colors active:scale-90"
        onClick={(e) => { e.stopPropagation(); onReset(); }}
        aria-label={`Reset ${label}`}
      >
        ✕
      </button>

      {isWide ? (
        /* Wide layout: horizontal */
        <div className="flex items-center flex-1 px-1 py-1">
          <button
            className="counter-btn w-16 h-full flex items-center justify-center
                       rounded-xl text-3xl font-bold text-text-secondary
                       hover:bg-white/5 active:bg-white/10 select-none"
            {...decRepeat}
            aria-label={`Decrease ${label}`}
          >
            −
          </button>

          <div className="flex-1 flex items-center justify-center gap-2">
            {symbol && <span className="text-sm">{symbol}</span>}
            <span className="text-xs font-medium tracking-wide uppercase" style={{ color: accentColor, opacity: 0.8 }}>
              {label}
            </span>
            <span
              className="text-3xl font-bold tabular-nums leading-none ml-2"
              style={{ color: value > 0 ? accentColor : 'var(--color-text-dim)' }}
            >
              {value}
            </span>
          </div>

          <button
            className="counter-btn w-16 h-full flex items-center justify-center
                       rounded-xl text-3xl font-bold
                       hover:bg-white/5 active:bg-white/10 select-none"
            style={{ color: accentColor }}
            {...incRepeat}
            aria-label={`Increase ${label}`}
          >
            +
          </button>
        </div>
      ) : (
        /* Standard layout: vertical */
        <>
          <div className="flex items-center gap-1.5 px-3 pt-2 pb-0">
            {symbol && <span className="text-sm">{symbol}</span>}
            <span className="text-xs font-medium tracking-wide uppercase" style={{ color: accentColor, opacity: 0.9 }}>
              {label}
            </span>
          </div>

          <div className="flex items-center flex-1 gap-0 px-1 pb-1">
            <button
              className="counter-btn flex-1 flex items-center justify-center h-full min-h-[3rem]
                         rounded-xl text-2xl font-bold text-text-secondary
                         hover:bg-white/5 active:bg-white/10 select-none"
              {...decRepeat}
              aria-label={`Decrease ${label}`}
            >
              −
            </button>

            <div className="flex items-center justify-center min-w-[3.5rem] px-1">
              <span
                className="text-3xl font-bold tabular-nums leading-none"
                style={{ color: value > 0 ? accentColor : 'var(--color-text-dim)' }}
              >
                {value}
              </span>
            </div>

            <button
              className="counter-btn flex-1 flex items-center justify-center h-full min-h-[3rem]
                         rounded-xl text-2xl font-bold
                         hover:bg-white/5 active:bg-white/10 select-none"
              style={{ color: accentColor }}
              {...incRepeat}
              aria-label={`Increase ${label}`}
            >
              +
            </button>
          </div>
        </>
      )}
    </div>
  );
}
