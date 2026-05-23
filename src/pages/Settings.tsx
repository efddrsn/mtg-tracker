import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useStore, MANA_INFO, BG_PRESETS, vibrate,
} from '../store';
import { ManaIcon, StormIcon, CounterIcon, HeartIcon, PhaseIcon } from '../components/Symbols';

export function Settings() {
  const {
    settings, counters,
    updateSettings, toggleWidgetVisible,
    addCounter, removeCounter, resetAll, resetLife,
  } = useStore();
  const [newCounterName, setNewCounterName] = useState('');
  const [customColor, setCustomColor] = useState(settings.backgroundColor);
  const navigate = useNavigate();

  const handleAddCounter = () => {
    const name = newCounterName.trim();
    if (!name) return;
    addCounter(name);
    setNewCounterName('');
  };

  const setBg = (value: string) => {
    vibrate(10);
    updateSettings({ backgroundColor: value });
    setCustomColor(value);
  };

  return (
    <div className="flex-1 overflow-y-auto scroll-hide">
      <header className="sticky top-0 z-20 flex items-center gap-2 px-3 py-3 bg-bg/95 backdrop-blur-md border-b border-border">
        <button
          className="counter-btn w-9 h-9 flex items-center justify-center rounded-xl
                     text-text-primary bg-white/10 hover:bg-white/20 active:scale-95"
          onClick={() => { vibrate(10); navigate('/'); }}
          aria-label="Back to tracker"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <h1 className="text-base font-bold tracking-wide text-text-primary">Settings</h1>
      </header>

      <div className="px-3 pt-4 pb-8 space-y-5">
        {/* Widget visibility (also acts as mana on/off) */}
        <section>
          <SectionTitle>Visible Trackers</SectionTitle>
          <p className="text-xs text-text-dim mb-2">Long-press a tracker on the home screen to reorder or resize.</p>
          <div className="space-y-1.5">
            {settings.widgets.map((widget) => {
              let label = '';
              let icon: React.ReactNode = null;
              if (widget.type === 'life') {
                label = 'Life';
                icon = <HeartIcon width="16" height="16" style={{ color: 'var(--color-life)' }} />;
              } else if (widget.type === 'phase') {
                label = 'Phase Tracker';
                icon = <PhaseIcon width="16" height="16" className="text-text-secondary" />;
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

        {/* Background Color */}
        <section>
          <SectionTitle>Background</SectionTitle>
          <div className="grid grid-cols-4 gap-2">
            {BG_PRESETS.map((p) => {
              const active = settings.backgroundColor === p.value;
              return (
                <button
                  key={p.value}
                  className={`aspect-square rounded-xl transition-all relative
                    ${active ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : 'ring-1 ring-border'}`}
                  style={{ background: p.value }}
                  onClick={() => setBg(p.value)}
                  aria-label={p.label}
                  title={p.label}
                >
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center text-white text-base">✓</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <input
              type="color"
              value={customColor || '#0e0e15'}
              onChange={(e) => setCustomColor(e.target.value)}
              onBlur={(e) => setBg(e.target.value)}
              className="w-10 h-10 rounded-lg border border-border bg-surface cursor-pointer"
              aria-label="Custom background color"
            />
            <span className="text-xs text-text-dim flex-1">Pick a custom color</span>
            <button
              className="px-3 py-2 rounded-lg bg-surface text-text-secondary text-xs font-semibold
                         hover:bg-surface-hover"
              onClick={() => setBg(customColor)}
            >
              Apply
            </button>
          </div>
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

        {/* New Turn Behavior */}
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

        {/* Layout & Display */}
        <section>
          <SectionTitle>Layout & Display</SectionTitle>
          <div className="space-y-2">
            <ToggleRow
              label="Fit trackers to screen"
              checked={settings.fitToScreen}
              onChange={(v) => updateSettings({ fitToScreen: v })}
            />
            <ToggleRow
              label="Haptic feedback"
              checked={settings.enableHaptics}
              onChange={(v) => updateSettings({ enableHaptics: v })}
            />
            <ToggleRow
              label="Keep screen awake"
              checked={settings.keepAwake}
              onChange={(v) => updateSettings({ keepAwake: v })}
            />
          </div>
          <p className="text-xs text-text-dim mt-2">
            Fit-to-screen resizes trackers to fill the viewport in portrait or landscape — turn it off if you prefer scrolling.
          </p>
        </section>

        {/* Reset */}
        <section>
          <SectionTitle>Reset</SectionTitle>
          <div className="space-y-2">
            <button
              className="w-full py-3 rounded-xl bg-white/5 text-text-primary text-sm font-bold
                         hover:bg-white/10 active:scale-[0.98] transition-all"
              onClick={resetLife}
            >
              Reset Life to 20
            </button>
            <button
              className="w-full py-3 rounded-xl bg-danger/15 text-danger text-sm font-bold
                         hover:bg-danger/25 active:scale-[0.98] transition-all"
              onClick={resetAll}
            >
              Reset All Counters
            </button>
          </div>
          <p className="text-xs text-text-dim mt-2">
            Tip: swipe left or right across the tracker screen to reset everything.
          </p>
        </section>
      </div>
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
      onClick={() => { vibrate(10); onChange(!checked); }}
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
