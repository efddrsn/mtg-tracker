import type { SVGProps } from 'react';
import type { ManaColor } from '../store';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'>;

const baseProps: IconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
  'aria-hidden': true,
};

export function StormIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M13 2L4 14h6.5L9 22l11-13h-6.5L15 2z" />
    </svg>
  );
}

export function CounterIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  );
}

function SunIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function DropIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 2.5c0 0 7 7.5 7 12.5a7 7 0 0 1-14 0c0-5 7-12.5 7-12.5z" />
    </svg>
  );
}

function SkullIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 4.5 2.5 6 .5.7.5 1.3.5 2v1h10v-1c0-.7 0-1.3.5-2 1-1.5 2.5-3 2.5-6a8 8 0 0 0-8-8z" />
      <circle cx="9" cy="11" r="1.6" />
      <circle cx="15" cy="11" r="1.6" />
      <path d="M11 15l1 2 1-2" />
      <path d="M9.5 19v3M14.5 19v3M12 19v3" />
    </svg>
  );
}

function FlameIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 2c.5 3.5 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 1.5-4 0 2 1 2.5 1.5 2.5-.5-3 1-5 1-7.5z" />
    </svg>
  );
}

function TreeIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 2L7 10h2.5L6 16h3l-3 5h12l-3-5h3l-3.5-6H17z" />
      <path d="M10 21v-3h4v3" />
    </svg>
  );
}

function DiamondIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 2L22 12 12 22 2 12z" />
    </svg>
  );
}

export function ManaIcon({ color, ...rest }: IconProps & { color: ManaColor }) {
  switch (color) {
    case 'W': return <SunIcon {...rest} />;
    case 'U': return <DropIcon {...rest} />;
    case 'B': return <SkullIcon {...rest} />;
    case 'R': return <FlameIcon {...rest} />;
    case 'G': return <TreeIcon {...rest} />;
    case 'C': return <DiamondIcon {...rest} />;
  }
}
