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
  const valueSize = area >= 4
    ? 'text-6xl'
    : area >= 2
      ? 'text-5xl'
      : 'text-4xl';

  return (
    <div
      className="widget-card relative rounded-2xl overflow-hidden h-full w-full"
      style={{ background: bgColor }}
    >
      {icon && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ color: accentColor, opacity: 0.18 }}
          aria-hidden
        >
          <div className="w-[70%] h-[70%]">
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
          className="text-xl font-bold leading-none opacity-30"
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
          className="text-xl font-bold leading-none opacity-30"
          style={{ color: accentColor }}
        >
          +
        </span>
      </button>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={`${valueSize} font-bold tabular-nums leading-none`}
          style={{ color: value > 0 ? accentColor : 'var(--color-text-dim)' }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
