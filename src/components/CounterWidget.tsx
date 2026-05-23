import type { ReactNode } from 'react';
import { useRepeatAction } from '../hooks/useRepeatAction';
import { useStore } from '../store';

interface Props {
  value: number;
  label: string;
  icon?: ReactNode;
  /** Unused — widgets are translucent now. Kept for API compat. */
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
  accentColor = 'var(--color-accent)',
  onInc,
  onDec,
  colSpan = 1,
  rowSpan = 1,
}: Props) {
  const decRepeat = useRepeatAction(onDec);
  const incRepeat = useRepeatAction(onInc);
  const opacity = useStore((s) => s.settings.trackerOpacity ?? 1);

  const area = colSpan * rowSpan;
  const valueSize = area >= 6
    ? 'text-7xl'
    : area >= 4
      ? 'text-6xl'
      : area >= 2
        ? 'text-5xl'
        : 'text-4xl';

  const hintSize = area >= 4 ? 'text-3xl' : area >= 2 ? 'text-2xl' : 'text-xl';

  // Glass fill scales with opacity; border + glow stay visible so the widget
  // still has a defined edge even when the fill is fully transparent.
  const fillTop = 14 * opacity;
  const fillBot = 6 * opacity;
  const whiteFill = 0.04 * opacity;
  const containerStyle: React.CSSProperties = {
    background: `linear-gradient(180deg, color-mix(in srgb, ${accentColor} ${fillTop}%, transparent), color-mix(in srgb, ${accentColor} ${fillBot}%, transparent)), rgba(255,255,255,${whiteFill})`,
    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${accentColor} 55%, transparent), 0 0 22px -6px color-mix(in srgb, ${accentColor} 65%, transparent), 0 4px 18px rgba(0,0,0,0.35)`,
    backdropFilter: opacity > 0.05 ? 'blur(14px) saturate(140%)' : 'none',
    WebkitBackdropFilter: opacity > 0.05 ? 'blur(14px) saturate(140%)' : 'none',
  };

  return (
    <div
      className="widget-card relative rounded-2xl overflow-hidden h-full w-full"
      style={containerStyle}
    >
      {icon && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ color: accentColor, opacity: 0.38 }}
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
          className={`${hintSize} font-bold leading-none opacity-50`}
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
          className={`${hintSize} font-bold leading-none opacity-50`}
          style={{ color: accentColor }}
        >
          +
        </span>
      </button>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <span
          className={`${valueSize} font-bold tabular-nums leading-none`}
          style={{
            color: value === 0 ? 'rgba(255,255,255,0.45)' : accentColor,
            textShadow: value === 0 ? 'none' : `0 0 18px color-mix(in srgb, ${accentColor} 55%, transparent)`,
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}
