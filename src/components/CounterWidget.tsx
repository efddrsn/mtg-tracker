import type { ReactNode } from 'react';
import { useRepeatAction } from '../hooks/useRepeatAction';

interface Props {
  value: number;
  label: string;
  icon?: ReactNode;
  bgColor?: string;
  accentColor?: string;
  onInc: () => void;
  onDec: () => void;
  colSpan?: number;
  rowSpan?: number;
}

export function CounterWidget({
  value,
  label,
  icon,
  bgColor = 'var(--color-surface)',
  accentColor = 'var(--color-accent)',
  onInc,
  onDec,
  colSpan = 1,
  rowSpan = 1,
}: Props) {
  const decRepeat = useRepeatAction(onDec);
  const incRepeat = useRepeatAction(onInc);

  const area = colSpan * rowSpan;
  const valueSize = area >= 6
    ? 'text-7xl'
    : area >= 4
      ? 'text-6xl'
      : area >= 2
        ? 'text-5xl'
        : 'text-4xl';

  const hintSize = area >= 4 ? 'text-3xl' : area >= 2 ? 'text-2xl' : 'text-xl';

  return (
    <div
      className="widget-card relative rounded-2xl overflow-hidden h-full w-full"
      style={{ background: bgColor }}
    >
      {icon && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ color: accentColor, opacity: 0.32 }}
          aria-hidden
        >
          <div className="w-[72%] h-[72%]">
            {icon}
          </div>
        </div>
      )}

      <button
        className="counter-btn absolute inset-y-0 left-0 w-1/2 select-none flex items-center justify-start pl-2"
        {...decRepeat}
        aria-label={`Decrease ${label}`}
      >
        <span
          className={`${hintSize} font-bold leading-none opacity-40`}
          style={{ color: accentColor }}
        >
          −
        </span>
      </button>
      <button
        className="counter-btn absolute inset-y-0 right-0 w-1/2 select-none flex items-center justify-end pr-2"
        {...incRepeat}
        aria-label={`Increase ${label}`}
      >
        <span
          className={`${hintSize} font-bold leading-none opacity-40`}
          style={{ color: accentColor }}
        >
          +
        </span>
      </button>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={`${valueSize} font-bold tabular-nums leading-none`}
          style={{ color: value === 0 ? 'var(--color-text-dim)' : accentColor }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
