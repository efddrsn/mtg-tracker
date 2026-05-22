import { useState } from 'react';
import {
  useStore, ALL_MANA, MANA_INFO,
  type ManaColor,
} from '../store';
import { ManaIcon, StormIcon, CounterIcon } from '../components/Symbols';

export function Settings() {
  const {
    settings, counters,
    updateSettings, toggleWidgetVisible,
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
                <ManaIcon color={color} width="18" height="18" />
                <span>{info.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Widget visibility */}
      <section>
        <SectionTitle>Visible Trackers</SectionTitle>
        <p className="text-xs text-text-dim mb-2">Long-press a tracker on the home screen to reorder or resize.</p>
        <div className="space-y-1.5">
          {settings.widgets.map((widget) => {
            let label = '';
            let icon: React.ReactNode = null;
            if (widget.type === 'phase') {
              label = 'Phase Tracker';
              icon = <span className="text-text-secondary text-sm">◷</span>;
            } else if (widget.type === 'storm') {
              label = 'Storm';
              icon = <StormIcon width="16" height="16" className="text-accent" />;
            } else if (widget.type === 'mana' && widget.manaColor) {
              const info = MANA_INFO[widget.manaColor];
              label = `${info.name} Mana`;
              icon = <ManaIcon color={widget.manaColor} width="16" height="16" style={{ color: info.colorVar }} />;
            } else if (widget.type === 'counter' && widget.counterId) {
              const c = counters.find((cc) => cc.id === widget.counterId);
              label = c?.name || 'Counter';
              icon = <CounterIcon width="16" height="16" className="text-text-secondary" />;
            }

            return (
              <div
                key={widget.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
                  ${widget.visible ? 'bg-surface' : 'bg-surface/50 opacity-50'}`}
              >
                <span className="w-5 h-5 flex items-center justify-center shrink-0">{icon}</span>
                <span className="flex-1 text-sm font-medium text-text-primary truncate">{label}</span>
                <button
                  className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5
                    ${widget.visible ? 'bg-accent' : 'bg-border'}`}
                  onClick={() => toggleWidgetVisible(widget.id)}
                  aria-label={widget.visible ? 'Hide' : 'Show'}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow transition-transform
                      ${widget.visible ? 'translate-x-4' : 'translate-x-0'}`}
                  />
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
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-surface text-text-primary text-sm
                       placeholder:text-text-dim border border-border focus:border-accent
                       focus:outline-none transition-colors"
          />
          <button
            className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-bold
                       hover:bg-accent-hover active:scale-95 transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
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
                <div className="flex items-center gap-2">
                  <CounterIcon width="16" height="16" className="text-text-secondary" />
                  <span className="text-sm text-text-primary">{c.name}</span>
                </div>
                <button
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-danger
                             hover:bg-danger/10 text-xs font-bold"
                  onClick={() => removeCounter(c.id)}
                  aria-label={`Remove ${c.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Phase behavior */}
      <section>
        <SectionTitle>Phase Tracker</SectionTitle>
        <div className="space-y-2">
          <ToggleRow
            label="Show sub-steps for current phase"
            checked={settings.showSubSteps}
            onChange={(v) => updateSettings({ showSubSteps: v })}
          />
        </div>
        <p className="text-xs text-text-dim mt-2">
          Walks through Combat (attackers, blockers, damage) and End (end step, cleanup) when stepping forward.
        </p>
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

      <section>
        <SectionTitle>Display</SectionTitle>
        <ToggleRow
          label="Keep screen awake"
          checked={settings.keepAwake}
          onChange={(v) => updateSettings({ keepAwake: v })}
        />
        <p className="text-xs text-text-dim mt-2">
          Prevents your phone from sleeping while the tracker is open.
        </p>
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
        <p className="text-xs text-text-dim mt-2">
          Tip: swipe left or right across the tracker screen to reset.
        </p>
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
      <span className="text-sm text-text-primary text-left">{label}</span>
      <div
        className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 shrink-0
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
