import { useState } from 'react';
import { useStore, ALL_MANA, MANA_INFO, type ManaColor } from '../store';

export function Settings() {
  const {
    settings, counters,
    updateSettings, moveWidget, toggleWidgetVisible, setWidgetSpan,
    addCounter, removeCounter, resetAll,
  } = useStore();
  const [newCounterName, setNewCounterName] = useState('');

  const handleAddCounter = () => {
    const name = newCounterName.trim();
    if (!name) return;
    addCounter(name);
    setNewCounterName('');
  };

  const toggleMana = (color: ManaColor) => {
    const current = settings.enabledMana;
    const next = current.includes(color)
      ? current.filter((c) => c !== color)
      : [...current, color];
    updateSettings({ enabledMana: next });
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-hide px-3 pb-8 space-y-5">
      {/* Grid Columns */}
      <section>
        <SectionTitle>Grid Columns</SectionTitle>
        <div className="flex gap-2">
          {([2, 3, 4] as const).map((n) => (
            <button
              key={n}
              className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all
                ${settings.columns === n
                  ? 'bg-accent text-white shadow-lg shadow-accent/25'
                  : 'bg-surface text-text-secondary hover:bg-surface-hover'
                }`}
              onClick={() => updateSettings({ columns: n })}
            >
              {n} cols
            </button>
          ))}
        </div>
      </section>

      {/* Mana Colors */}
      <section>
        <SectionTitle>Mana Colors</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {ALL_MANA.map((color) => {
            const info = MANA_INFO[color];
            const active = settings.enabledMana.includes(color);
            return (
              <button
                key={color}
                className={`flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-semibold transition-all
                  ${active ? '' : 'opacity-40'}`}
                style={{
                  background: info.bgVar,
                  color: info.colorVar,
                  boxShadow: active ? `inset 0 0 0 2px ${info.colorVar}` : 'none',
                }}
                onClick={() => toggleMana(color)}
              >
                <span className="text-base">{info.symbol}</span>
                <span>{info.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Widget Layout */}
      <section>
        <SectionTitle>Widget Layout</SectionTitle>
        <p className="text-xs text-text-dim mb-2">Reorder, resize, and toggle visibility</p>
        <div className="space-y-1.5">
          {settings.widgets.map((widget, idx) => {
            let label = '';
            if (widget.type === 'phase') label = '⏱ Phase Tracker';
            else if (widget.type === 'storm') label = '⚡ Storm';
            else if (widget.type === 'mana' && widget.manaColor) {
              const info = MANA_INFO[widget.manaColor];
              label = `${info.symbol} ${info.name} Mana`;
            } else if (widget.type === 'counter' && widget.counterId) {
              const c = counters.find((cc) => cc.id === widget.counterId);
              label = `🔢 ${c?.name || 'Counter'}`;
            }

            return (
              <div
                key={widget.id}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all
                  ${widget.visible ? 'bg-surface' : 'bg-surface/50 opacity-50'}`}
              >
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5">
                  <button
                    className="w-6 h-5 flex items-center justify-center rounded text-text-dim
                               hover:text-text-primary hover:bg-white/5 text-xs disabled:opacity-20"
                    disabled={idx === 0}
                    onClick={() => moveWidget(widget.id, -1)}
                  >
                    ▲
                  </button>
                  <button
                    className="w-6 h-5 flex items-center justify-center rounded text-text-dim
                               hover:text-text-primary hover:bg-white/5 text-xs disabled:opacity-20"
                    disabled={idx === settings.widgets.length - 1}
                    onClick={() => moveWidget(widget.id, 1)}
                  >
                    ▼
                  </button>
                </div>

                {/* Label */}
                <span className="flex-1 text-sm font-medium text-text-primary truncate">{label}</span>

                {/* Span toggle */}
                <button
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold tracking-wide
                    ${widget.colSpan === 2
                      ? 'bg-accent/20 text-accent'
                      : 'bg-white/5 text-text-dim hover:bg-white/10'
                    }`}
                  onClick={() => setWidgetSpan(widget.id, widget.colSpan === 1 ? 2 : 1)}
                >
                  {widget.colSpan === 2 ? 'WIDE' : '1 COL'}
                </button>

                {/* Visibility toggle */}
                <button
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm
                    ${widget.visible
                      ? 'bg-accent/15 text-accent'
                      : 'bg-white/5 text-text-dim hover:bg-white/10'
                    }`}
                  onClick={() => toggleWidgetVisible(widget.id)}
                >
                  {widget.visible ? '👁' : '—'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Custom Counters */}
      <section>
        <SectionTitle>Custom Counters</SectionTitle>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newCounterName}
            onChange={(e) => setNewCounterName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCounter()}
            placeholder="Counter name..."
            className="flex-1 px-3 py-2.5 rounded-xl bg-surface text-text-primary text-sm
                       placeholder:text-text-dim border border-border focus:border-accent
                       focus:outline-none transition-colors"
          />
          <button
            className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-bold
                       hover:bg-accent-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={!newCounterName.trim()}
            onClick={handleAddCounter}
          >
            Add
          </button>
        </div>
        {counters.length > 0 && (
          <div className="space-y-1.5">
            {counters.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface"
              >
                <span className="text-sm text-text-primary">🔢 {c.name}</span>
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-danger
                             hover:bg-danger/10 text-xs font-bold"
                  onClick={() => removeCounter(c.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Behavior */}
      <section>
        <SectionTitle>New Turn Behavior</SectionTitle>
        <div className="space-y-2">
          <ToggleRow
            label="Reset floating mana"
            checked={settings.newTurnResetsMana}
            onChange={(v) => updateSettings({ newTurnResetsMana: v })}
          />
          <ToggleRow
            label="Reset storm count"
            checked={settings.newTurnResetsStorm}
            onChange={(v) => updateSettings({ newTurnResetsStorm: v })}
          />
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <SectionTitle>Reset</SectionTitle>
        <button
          className="w-full py-3 rounded-xl bg-danger/10 text-danger text-sm font-bold
                     hover:bg-danger/20 active:scale-[0.98] transition-all"
          onClick={resetAll}
        >
          Reset All Counters
        </button>
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
      {children}
    </h2>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-surface
                 hover:bg-surface-hover transition-colors"
      onClick={() => onChange(!checked)}
    >
      <span className="text-sm text-text-primary">{label}</span>
      <div
        className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5
          ${checked ? 'bg-accent' : 'bg-border'}`}
      >
        <div
          className={`w-5 h-5 rounded-full bg-white shadow transition-transform
            ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </div>
    </button>
  );
}
