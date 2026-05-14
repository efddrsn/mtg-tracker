import { useStore, MANA_INFO, type ManaColor } from '../store';
import { CounterWidget } from '../components/CounterWidget';
import { PhaseTracker } from '../components/PhaseTracker';

export function Tracker() {
  const {
    mana, storm, counters, settings,
    incMana, decMana, resetMana,
    incStorm, decStorm, resetStorm,
    incCounter, decCounter, resetCounter,
  } = useStore();

  const visibleWidgets = settings.widgets.filter((w) => {
    if (!w.visible) return false;
    if (w.type === 'mana' && w.manaColor && !settings.enabledMana.includes(w.manaColor)) return false;
    if (w.type === 'counter' && w.counterId && !counters.find((c) => c.id === w.counterId)) return false;
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto scroll-hide px-2 pb-4">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${settings.columns}, 1fr)` }}
      >
        {visibleWidgets.map((widget) => {
          const span = Math.min(widget.colSpan, settings.columns);

          if (widget.type === 'phase') {
            return (
              <div key={widget.id} style={{ gridColumn: `span ${span}` }}>
                <PhaseTracker />
              </div>
            );
          }

          if (widget.type === 'storm') {
            return (
              <div key={widget.id} style={{ gridColumn: `span ${span}` }}>
                <CounterWidget
                  value={storm}
                  label="Storm"
                  symbol="⚡"
                  accentColor="var(--color-accent)"
                  onInc={incStorm}
                  onDec={decStorm}
                  onReset={resetStorm}
                  colSpan={span as 1 | 2}
                  columns={settings.columns}
                />
              </div>
            );
          }

          if (widget.type === 'mana' && widget.manaColor) {
            const color = widget.manaColor as ManaColor;
            const info = MANA_INFO[color];
            return (
              <div key={widget.id} style={{ gridColumn: `span ${span}` }}>
                <CounterWidget
                  value={mana[color]}
                  label={info.name}
                  symbol={info.symbol}
                  bgColor={info.bgVar}
                  accentColor={info.colorVar}
                  onInc={() => incMana(color)}
                  onDec={() => decMana(color)}
                  onReset={() => resetMana(color)}
                  colSpan={span as 1 | 2}
                  columns={settings.columns}
                />
              </div>
            );
          }

          if (widget.type === 'counter' && widget.counterId) {
            const counter = counters.find((c) => c.id === widget.counterId);
            if (!counter) return null;
            return (
              <div key={widget.id} style={{ gridColumn: `span ${span}` }}>
                <CounterWidget
                  value={counter.value}
                  label={counter.name}
                  symbol="🔢"
                  onInc={() => incCounter(counter.id)}
                  onDec={() => decCounter(counter.id)}
                  onReset={() => resetCounter(counter.id)}
                  colSpan={span as 1 | 2}
                  columns={settings.columns}
                />
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
