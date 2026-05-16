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
  colSpan?: number;
  rowSpan?: number;
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
  rowSpan = 1,
}: Props) {
  const decRepeat = useRepeatAction(onDec);
  const incRepeat = useRepeatAction(onInc);

  const isWide = colSpan >= 2;
  const isTall = rowSpan >= 2;
  const area = colSpan * rowSpan;
  const isHero = area >= 4;

  // Scale typography based on cell size.
  const valueSize = isHero
    ? 'text-5xl'
    : area >= 2
      ? 'text-4xl'
      : 'text-3xl';
  const btnSize = isHero
    ? 'text-5xl'
    : area >= 2
      ? 'text-4xl'
      : 'text-2xl';

  return (
    <div
      className="widget-card relative flex flex-col rounded-2xl overflow-hidden h-full w-full"
      style={{ background: bgColor }}
    >
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
        <div className="flex items-center flex-1 px-1 py-1 min-h-0">
          <button
            className={`counter-btn h-full flex items-center justify-center
                       rounded-xl font-bold text-text-secondary
                       hover:bg-white/5 active:bg-white/10 select-none ${btnSize}`}
            style={{ flex: '0 0 28%', minWidth: '3rem' }}
            {...decRepeat}
            aria-label={`Decrease ${label}`}
          >
            −
          </button>

          <div className={`flex flex-1 min-w-0 items-center justify-center gap-2 ${isHero || isTall ? 'flex-col' : ''}`}>
            <div className="flex items-center gap-1.5 min-w-0">
              {symbol && <span className={isHero ? 'text-xl' : 'text-sm'}>{symbol}</span>}
              <span
                className={`font-medium tracking-wide uppercase truncate ${isHero ? 'text-sm' : 'text-xs'}`}
                style={{ color: accentColor, opacity: 0.85 }}
              >
                {label}
              </span>
            </div>
            <span
              className={`${valueSize} font-bold tabular-nums leading-none`}
              style={{ color: value > 0 ? accentColor : 'var(--color-text-dim)' }}
            >
              {value}
            </span>
          </div>

          <button
            className={`counter-btn h-full flex items-center justify-center
                       rounded-xl font-bold
                       hover:bg-white/5 active:bg-white/10 select-none ${btnSize}`}
            style={{ flex: '0 0 28%', minWidth: '3rem', color: accentColor }}
            {...incRepeat}
            aria-label={`Increase ${label}`}
          >
            +
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-0 shrink-0">
            {symbol && <span className="text-sm leading-none">{symbol}</span>}
            <span
              className="text-[11px] font-semibold tracking-wide uppercase truncate"
              style={{ color: accentColor, opacity: 0.9 }}
            >
              {label}
            </span>
          </div>

          <div className="flex items-center flex-1 min-h-0 gap-0 px-1 pb-1">
            <button
              className={`counter-btn flex-1 flex items-center justify-center h-full min-w-0
                         rounded-xl font-bold text-text-secondary
                         hover:bg-white/5 active:bg-white/10 select-none ${btnSize}`}
              {...decRepeat}
              aria-label={`Decrease ${label}`}
            >
              −
            </button>

            <div className="flex items-center justify-center min-w-[3rem] px-1 shrink-0">
              <span
                className={`${valueSize} font-bold tabular-nums leading-none`}
                style={{ color: value > 0 ? accentColor : 'var(--color-text-dim)' }}
              >
                {value}
              </span>
            </div>

            <button
              className={`counter-btn flex-1 flex items-center justify-center h-full min-w-0
                         rounded-xl font-bold
                         hover:bg-white/5 active:bg-white/10 select-none ${btnSize}`}
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
