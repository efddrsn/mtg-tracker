import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

export const ALL_MANA: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

export const MANA_INFO: Record<ManaColor, { name: string; colorVar: string; bgVar: string }> = {
  W: { name: 'White', colorVar: 'var(--color-mana-w)', bgVar: 'var(--color-mana-w-bg)' },
  U: { name: 'Blue', colorVar: 'var(--color-mana-u)', bgVar: 'var(--color-mana-u-bg)' },
  B: { name: 'Black', colorVar: 'var(--color-mana-b)', bgVar: 'var(--color-mana-b-bg)' },
  R: { name: 'Red', colorVar: 'var(--color-mana-r)', bgVar: 'var(--color-mana-r-bg)' },
  G: { name: 'Green', colorVar: 'var(--color-mana-g)', bgVar: 'var(--color-mana-g-bg)' },
  C: { name: 'Colorless', colorVar: 'var(--color-mana-c)', bgVar: 'var(--color-mana-c-bg)' },
};

export const PHASES = [
  'Beginning',
  'Main 1',
  'Combat',
  'Main 2',
  'End',
] as const;

export type Phase = (typeof PHASES)[number];

export const SUB_STEPS: Record<Phase, readonly string[]> = {
  'Beginning': ['Untap', 'Upkeep', 'Draw'],
  'Main 1': [],
  'Combat': ['Beginning', 'Attackers', 'Blockers', 'Damage', 'End of Combat'],
  'Main 2': [],
  'End': ['End Step', 'Cleanup'],
};

export interface CustomCounter {
  id: string;
  name: string;
  value: number;
}

export type WidgetType = 'phase' | 'storm' | 'mana' | 'counter' | 'life';

export interface Widget {
  id: string;
  type: WidgetType;
  manaColor?: ManaColor;
  counterId?: string;
  colSpan: number;
  rowSpan: number;
  visible: boolean;
}

export const MAX_ROW_SPAN = 4;
export const DEFAULT_LIFE = 20;

export const BG_PRESETS: { label: string; value: string }[] = [
  { label: 'Midnight', value: '#0e0e15' },
  { label: 'Pure Black', value: '#000000' },
  { label: 'Slate', value: '#0f172a' },
  { label: 'Navy', value: '#0a1628' },
  { label: 'Forest', value: '#0c1f1a' },
  { label: 'Plum', value: '#1a0c1f' },
  { label: 'Ember', value: '#1f0e0c' },
  { label: 'Charcoal', value: '#171717' },
];

/** Three-color gradients that slowly drift via the `bg-animated` CSS class. */
export const BG_GRADIENTS: { label: string; value: string }[] = [
  { label: 'Twilight', value: 'linear-gradient(165deg, #0a0a1f 0%, #1a0e2e 50%, #2d1b40 100%)' },
  { label: 'Aurora',   value: 'linear-gradient(135deg, #001f3f 0%, #1a3a5c 50%, #0f4a4a 100%)' },
  { label: 'Crimson',  value: 'linear-gradient(180deg, #050505 0%, #1f060a 50%, #3a0d0d 100%)' },
  { label: 'Verdant',  value: 'linear-gradient(180deg, #0a1f0e 0%, #0e2d18 50%, #1a3a24 100%)' },
  { label: 'Cosmos',   value: 'linear-gradient(135deg, #050511 0%, #1a0a2e 50%, #2e0a4a 100%)' },
  { label: 'Ember',    value: 'linear-gradient(180deg, #0a0505 0%, #2d0a05 50%, #3d1a0a 100%)' },
  // High-saturation CMY waves: hard stops give sharp band transitions that
  // sweep across the screen when bg-animated drifts background-position.
  { label: 'Neon CMY', value: 'linear-gradient(110deg, #00f5ff 0%, #00f5ff 22%, #ff00d4 27%, #ff00d4 50%, #fffb00 55%, #fffb00 78%, #00f5ff 83%, #00f5ff 100%)' },
];

/** Painterly aurora effects rendered by AuroraLayer (not CSS-only gradients). */
export const BG_AURORAS: { label: string; value: string; preview: string }[] = [
  {
    label: 'Aurora Borealis',
    value: 'aurora:borealis',
    preview:
      'radial-gradient(ellipse 60% 30% at 30% 55%, #4cd9b8 0%, rgba(76,217,184,0.35) 35%, transparent 70%),' +
      'radial-gradient(ellipse 45% 25% at 65% 35%, #c98ad4 0%, rgba(201,138,212,0.35) 35%, transparent 70%),' +
      'radial-gradient(ellipse 45% 25% at 80% 70%, #f0a8c8 0%, rgba(240,168,200,0.3) 35%, transparent 70%),' +
      'linear-gradient(180deg, #07083a 0%, #150c5e 50%, #0a0844 100%)',
  },
  {
    label: 'Aurora Cosmic',
    value: 'aurora:cosmic',
    preview:
      'radial-gradient(ellipse 55% 30% at 25% 40%, #8a5cff 0%, rgba(138,92,255,0.35) 35%, transparent 70%),' +
      'radial-gradient(ellipse 45% 30% at 65% 65%, #ff5ca8 0%, rgba(255,92,168,0.3) 35%, transparent 70%),' +
      'radial-gradient(ellipse 40% 25% at 80% 30%, #5cd6ff 0%, rgba(92,214,255,0.35) 35%, transparent 70%),' +
      'linear-gradient(180deg, #0a0118 0%, #1a0530 60%, #050010 100%)',
  },
  {
    label: 'Aurora Reef',
    value: 'aurora:reef',
    preview:
      'radial-gradient(ellipse 60% 30% at 30% 60%, #ffb05c 0%, rgba(255,176,92,0.32) 35%, transparent 70%),' +
      'radial-gradient(ellipse 45% 25% at 70% 35%, #ff5c8a 0%, rgba(255,92,138,0.32) 35%, transparent 70%),' +
      'radial-gradient(ellipse 40% 25% at 50% 80%, #d45cff 0%, rgba(212,92,255,0.3) 35%, transparent 70%),' +
      'linear-gradient(180deg, #1a0530 0%, #2a0a40 50%, #100525 100%)',
  },
];

export const DEFAULT_BG = 'aurora:borealis';
export const DEFAULT_BG_BRIGHTNESS = 1;

export interface Settings {
  columns: 2 | 3 | 4;
  widgets: Widget[];
  showPhaseTracker: boolean;
  newTurnResetsMana: boolean;
  newTurnResetsStorm: boolean;
  keepAwake: boolean;
  showSubSteps: boolean;
  enableHaptics: boolean;
  fitToScreen: boolean;
  backgroundColor: string;
  /** 0.3..1, multiplies dimming overlay (1 = no dim). */
  bgBrightness: number;
  /** 0..1, opacity of the glass fill on widgets (1 = full glass, 0 = outline only). */
  trackerOpacity: number;
}

function createDefaultWidgets(): Widget[] {
  return [
    { id: 'life',   type: 'life',   colSpan: 2, rowSpan: 2, visible: true },
    { id: 'phase',  type: 'phase',  colSpan: 2, rowSpan: 1, visible: true },
    { id: 'storm',  type: 'storm',  colSpan: 1, rowSpan: 1, visible: true },
    { id: 'mana-W', type: 'mana', manaColor: 'W', colSpan: 1, rowSpan: 1, visible: true },
    { id: 'mana-U', type: 'mana', manaColor: 'U', colSpan: 1, rowSpan: 1, visible: true },
    { id: 'mana-B', type: 'mana', manaColor: 'B', colSpan: 1, rowSpan: 1, visible: true },
    { id: 'mana-R', type: 'mana', manaColor: 'R', colSpan: 1, rowSpan: 1, visible: true },
    { id: 'mana-G', type: 'mana', manaColor: 'G', colSpan: 1, rowSpan: 1, visible: true },
    { id: 'mana-C', type: 'mana', manaColor: 'C', colSpan: 1, rowSpan: 1, visible: false },
  ];
}

function defaultSettings(): Settings {
  return {
    columns: 2,
    widgets: createDefaultWidgets(),
    showPhaseTracker: true,
    newTurnResetsMana: true,
    newTurnResetsStorm: true,
    keepAwake: false,
    showSubSteps: true,
    enableHaptics: true,
    fitToScreen: true,
    backgroundColor: DEFAULT_BG,
    bgBrightness: DEFAULT_BG_BRIGHTNESS,
    trackerOpacity: 1,
  };
}

/** Best-effort haptic. iOS Safari does not implement navigator.vibrate. */
export function isHapticSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === 'function';
}

export function clampColSpan(span: number, columns: number): number {
  if (!Number.isFinite(span) || span < 1) return 1;
  return Math.min(columns, Math.max(1, Math.round(span)));
}

export function clampRowSpan(span: number): number {
  if (!Number.isFinite(span) || span < 1) return 1;
  return Math.min(MAX_ROW_SPAN, Math.max(1, Math.round(span)));
}

interface TrackerState {
  mana: Record<ManaColor, number>;
  storm: number;
  currentPhase: number;
  subPhase: number;
  turn: number;
  life: number;
  landDrop: boolean;
  counters: CustomCounter[];
  settings: Settings;

  incMana: (c: ManaColor) => void;
  decMana: (c: ManaColor) => void;
  resetMana: (c?: ManaColor) => void;
  setStorm: (v: number) => void;
  incStorm: () => void;
  decStorm: () => void;
  resetStorm: () => void;
  setPhase: (i: number) => void;
  nextPhase: () => void;
  prevPhase: () => void;
  setSubPhase: (i: number) => void;
  newTurn: () => void;
  prevTurn: () => void;
  incLife: () => void;
  decLife: () => void;
  resetLife: () => void;
  toggleLandDrop: () => void;
  addCounter: (name: string) => void;
  removeCounter: (id: string) => void;
  incCounter: (id: string) => void;
  decCounter: (id: string) => void;
  resetCounter: (id: string) => void;
  resetAll: () => void;
  updateSettings: (s: Partial<Settings>) => void;
  moveWidget: (id: string, dir: -1 | 1) => void;
  reorderWidgets: (fromId: string, toId: string) => void;
  toggleWidgetVisible: (id: string) => void;
  setWidgetSize: (id: string, colSpan: number, rowSpan: number) => void;
  setWidgetColSpan: (id: string, colSpan: number) => void;
  setWidgetRowSpan: (id: string, rowSpan: number) => void;
  cycleWidgetColSpan: (id: string) => void;
}

type VibrateFn = (pattern: number | number[]) => boolean;

export function vibrate(ms: number | number[] = 10) {
  try {
    const settings = useStore.getState()?.settings;
    if (settings && settings.enableHaptics === false) return;
    if (typeof navigator === 'undefined') return;
    const v = (navigator as unknown as { vibrate?: VibrateFn }).vibrate;
    if (typeof v !== 'function') return;
    v.call(navigator, ms);
  } catch { /* noop */ }
}

export const useStore = create<TrackerState>()(
  persist(
    (set) => ({
      mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      storm: 0,
      currentPhase: 0,
      subPhase: 0,
      turn: 1,
      life: DEFAULT_LIFE,
      landDrop: false,
      counters: [],
      settings: defaultSettings(),

      incMana: (c) => {
        vibrate(12);
        set((s) => ({ mana: { ...s.mana, [c]: s.mana[c] + 1 } }));
      },
      decMana: (c) => {
        vibrate(12);
        set((s) => ({ mana: { ...s.mana, [c]: Math.max(0, s.mana[c] - 1) } }));
      },
      resetMana: (c) => {
        vibrate(30);
        set((s) => c
          ? { mana: { ...s.mana, [c]: 0 } }
          : { mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 } }
        );
      },

      setStorm: (v) => set({ storm: Math.max(0, v) }),
      incStorm: () => { vibrate(12); set((s) => ({ storm: s.storm + 1 })); },
      decStorm: () => { vibrate(12); set((s) => ({ storm: Math.max(0, s.storm - 1) })); },
      resetStorm: () => { vibrate(30); set({ storm: 0 }); },

      setPhase: (i) => { vibrate(8); set({ currentPhase: i, subPhase: 0 }); },

      nextPhase: () => {
        vibrate(10);
        set((s) => {
          const phase = PHASES[s.currentPhase];
          const subs = SUB_STEPS[phase];
          if (s.settings.showSubSteps && subs.length > 0 && s.subPhase < subs.length - 1) {
            return { subPhase: s.subPhase + 1 };
          }
          if (s.currentPhase >= PHASES.length - 1) {
            vibrate(45);
            return {
              currentPhase: 0,
              subPhase: 0,
              turn: s.turn + 1,
              landDrop: false,
              ...(s.settings.newTurnResetsMana ? { mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 } } : {}),
              ...(s.settings.newTurnResetsStorm ? { storm: 0 } : {}),
            };
          }
          return { currentPhase: s.currentPhase + 1, subPhase: 0 };
        });
      },

      prevPhase: () => {
        vibrate(10);
        set((s) => {
          const phase = PHASES[s.currentPhase];
          const subs = SUB_STEPS[phase];
          if (s.settings.showSubSteps && subs.length > 0 && s.subPhase > 0) {
            return { subPhase: s.subPhase - 1 };
          }
          if (s.currentPhase === 0) {
            if (s.turn <= 1) return s;
            const prevIdx = PHASES.length - 1;
            const prevSubs = SUB_STEPS[PHASES[prevIdx]];
            const lastSub = s.settings.showSubSteps && prevSubs.length > 0 ? prevSubs.length - 1 : 0;
            return { currentPhase: prevIdx, subPhase: lastSub, turn: s.turn - 1 };
          }
          const prevIdx = s.currentPhase - 1;
          const prevSubs = SUB_STEPS[PHASES[prevIdx]];
          const lastSub = s.settings.showSubSteps && prevSubs.length > 0 ? prevSubs.length - 1 : 0;
          return { currentPhase: prevIdx, subPhase: lastSub };
        });
      },

      setSubPhase: (i) => { vibrate(6); set({ subPhase: Math.max(0, i) }); },

      newTurn: () => {
        vibrate(45);
        set((s) => ({
          currentPhase: 0,
          subPhase: 0,
          turn: s.turn + 1,
          landDrop: false,
          ...(s.settings.newTurnResetsMana ? { mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 } } : {}),
          ...(s.settings.newTurnResetsStorm ? { storm: 0 } : {}),
        }));
      },

      prevTurn: () => {
        vibrate(20);
        set((s) => s.turn > 1 ? { turn: s.turn - 1, currentPhase: 0, subPhase: 0, landDrop: false } : s);
      },

      incLife: () => { vibrate(12); set((s) => ({ life: s.life + 1 })); },
      decLife: () => { vibrate(12); set((s) => ({ life: s.life - 1 })); },
      resetLife: () => { vibrate(30); set({ life: DEFAULT_LIFE }); },
      toggleLandDrop: () => { vibrate(18); set((s) => ({ landDrop: !s.landDrop })); },

      addCounter: (name) => {
        vibrate(18);
        const ts = Date.now();
        const cId = `c-${ts}`;
        set((s) => ({
          counters: [...s.counters, { id: cId, name, value: 0 }],
          settings: {
            ...s.settings,
            widgets: [
              ...s.settings.widgets,
              { id: `counter-${ts}`, type: 'counter' as const, counterId: cId, colSpan: 1, rowSpan: 1, visible: true },
            ],
          },
        }));
      },
      removeCounter: (id) => {
        vibrate(25);
        set((s) => ({
          counters: s.counters.filter((c) => c.id !== id),
          settings: {
            ...s.settings,
            widgets: s.settings.widgets.filter((w) => w.counterId !== id),
          },
        }));
      },
      incCounter: (id) => {
        vibrate(12);
        set((s) => ({
          counters: s.counters.map((c) => c.id === id ? { ...c, value: c.value + 1 } : c),
        }));
      },
      decCounter: (id) => {
        vibrate(12);
        set((s) => ({
          counters: s.counters.map((c) => c.id === id ? { ...c, value: c.value - 1 } : c),
        }));
      },
      resetCounter: (id) => {
        vibrate(30);
        set((s) => ({
          counters: s.counters.map((c) => c.id === id ? { ...c, value: 0 } : c),
        }));
      },

      resetAll: () => {
        vibrate(60);
        set({
          mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
          storm: 0,
          currentPhase: 0,
          subPhase: 0,
          turn: 1,
          life: DEFAULT_LIFE,
          landDrop: false,
          counters: [],
        });
      },

      updateSettings: (partial) =>
        set((s) => {
          const merged: Settings = { ...s.settings, ...partial };
          if (partial.columns && partial.columns !== s.settings.columns) {
            merged.widgets = merged.widgets.map((w) => ({
              ...w,
              colSpan: clampColSpan(w.colSpan, merged.columns),
            }));
          }
          return { settings: merged };
        }),

      moveWidget: (id, dir) =>
        set((s) => {
          const ws = [...s.settings.widgets];
          const idx = ws.findIndex((w) => w.id === id);
          if (idx < 0) return s;
          const target = idx + dir;
          if (target < 0 || target >= ws.length) return s;
          [ws[idx], ws[target]] = [ws[target], ws[idx]];
          return { settings: { ...s.settings, widgets: ws } };
        }),

      reorderWidgets: (fromId, toId) =>
        set((s) => {
          if (fromId === toId) return s;
          const ws = [...s.settings.widgets];
          const fromIdx = ws.findIndex((w) => w.id === fromId);
          const toIdx = ws.findIndex((w) => w.id === toId);
          if (fromIdx < 0 || toIdx < 0) return s;
          const [moved] = ws.splice(fromIdx, 1);
          ws.splice(toIdx, 0, moved);
          return { settings: { ...s.settings, widgets: ws } };
        }),

      toggleWidgetVisible: (id) => {
        vibrate(10);
        set((s) => ({
          settings: {
            ...s.settings,
            widgets: s.settings.widgets.map((w) =>
              w.id === id ? { ...w, visible: !w.visible } : w
            ),
          },
        }));
      },

      setWidgetSize: (id, colSpan, rowSpan) =>
        set((s) => {
          const cs = clampColSpan(colSpan, s.settings.columns);
          const rs = clampRowSpan(rowSpan);
          let changed = false;
          const widgets = s.settings.widgets.map((w) => {
            if (w.id !== id) return w;
            if (w.colSpan === cs && w.rowSpan === rs) return w;
            changed = true;
            return { ...w, colSpan: cs, rowSpan: rs };
          });
          if (!changed) return s;
          return { settings: { ...s.settings, widgets } };
        }),

      setWidgetColSpan: (id, colSpan) =>
        set((s) => ({
          settings: {
            ...s.settings,
            widgets: s.settings.widgets.map((w) =>
              w.id === id ? { ...w, colSpan: clampColSpan(colSpan, s.settings.columns) } : w
            ),
          },
        })),

      setWidgetRowSpan: (id, rowSpan) =>
        set((s) => ({
          settings: {
            ...s.settings,
            widgets: s.settings.widgets.map((w) =>
              w.id === id ? { ...w, rowSpan: clampRowSpan(rowSpan) } : w
            ),
          },
        })),

      cycleWidgetColSpan: (id) => {
        vibrate(10);
        set((s) => ({
          settings: {
            ...s.settings,
            widgets: s.settings.widgets.map((w) => {
              if (w.id !== id) return w;
              const next = w.colSpan >= s.settings.columns ? 1 : w.colSpan + 1;
              return { ...w, colSpan: next };
            }),
          },
        }));
      },
    }),
    {
      name: 'mtg-tracker-storage',
      version: 8,
      migrate: (persistedState, version) => {
        const state = persistedState as Partial<TrackerState> | undefined;
        if (!state) return persistedState as unknown as TrackerState;
        if (version < 2) {
          const settings = state.settings as Partial<Settings> | undefined;
          if (settings?.widgets) {
            settings.widgets = settings.widgets.map((w) => ({
              ...w,
              colSpan: typeof w.colSpan === 'number' ? w.colSpan : 1,
              rowSpan: typeof (w as Widget).rowSpan === 'number'
                ? (w as Widget).rowSpan
                : 1,
            })) as Widget[];
          }
          if (settings && typeof settings.keepAwake !== 'boolean') {
            settings.keepAwake = false;
          }
        }
        if (version < 3) {
          const settings = state.settings as Partial<Settings> | undefined;
          if (settings && typeof settings.showSubSteps !== 'boolean') {
            settings.showSubSteps = false;
          }
          if (typeof state.subPhase !== 'number') {
            state.subPhase = 0;
          }
        }
        if (version < 4) {
          if (typeof state.life !== 'number') state.life = DEFAULT_LIFE;
          const settings = state.settings as Partial<Settings> | undefined;
          if (settings?.widgets) {
            const hasLife = settings.widgets.some((w) => w.type === 'life');
            if (!hasLife) {
              settings.widgets = [
                { id: 'life', type: 'life' as const, colSpan: 2, rowSpan: 2, visible: true },
                ...settings.widgets,
              ];
            }
          }
        }
        if (version < 5) {
          const settings = state.settings as (Partial<Settings> & { enabledMana?: ManaColor[] }) | undefined;
          if (settings) {
            // Merge legacy enabledMana into per-widget visibility, then drop it.
            const enabled = settings.enabledMana;
            if (Array.isArray(enabled) && settings.widgets) {
              settings.widgets = settings.widgets.map((w) =>
                w.type === 'mana' && w.manaColor && !enabled.includes(w.manaColor)
                  ? { ...w, visible: false }
                  : w
              );
            }
            delete settings.enabledMana;
            if (typeof settings.enableHaptics !== 'boolean') settings.enableHaptics = true;
            if (typeof settings.fitToScreen !== 'boolean') settings.fitToScreen = true;
            if (typeof settings.backgroundColor !== 'string') settings.backgroundColor = DEFAULT_BG;
          }
        }
        if (version < 6) {
          const settings = state.settings as Partial<Settings> | undefined;
          if (settings && typeof settings.bgBrightness !== 'number') {
            settings.bgBrightness = DEFAULT_BG_BRIGHTNESS;
          }
        }
        if (version < 7) {
          // Untap/Upkeep/Draw were top-level phases (indices 0/1/2) and are
          // now sub-steps of the new Beginning phase. Remap so users don't
          // wake up on a phase that no longer exists.
          const oldPhase = typeof state.currentPhase === 'number' ? state.currentPhase : 0;
          const oldSub = typeof state.subPhase === 'number' ? state.subPhase : 0;
          if (oldPhase <= 2) {
            state.currentPhase = 0;
            state.subPhase = Math.max(0, Math.min(2, oldPhase));
          } else if (oldPhase === 3) { state.currentPhase = 1; state.subPhase = 0; }
          else if (oldPhase === 4) { state.currentPhase = 2; state.subPhase = oldSub; }
          else if (oldPhase === 5) { state.currentPhase = 3; state.subPhase = 0; }
          else if (oldPhase === 6) { state.currentPhase = 4; state.subPhase = oldSub; }
          const settings = state.settings as Partial<Settings> | undefined;
          if (settings && typeof settings.trackerOpacity !== 'number') {
            settings.trackerOpacity = 1;
          }
        }
        if (version < 8) {
          if (typeof state.landDrop !== 'boolean') state.landDrop = false;
        }
        return state as TrackerState;
      },
    }
  )
);

/** Greedy CSS-grid-style packer matching `grid-auto-flow: row`. */
export function calculateGridRows(widgets: Widget[], columns: number): number {
  const occ: boolean[][] = [];
  const ensure = (r: number) => { while (occ.length <= r) occ.push(new Array(columns).fill(false)); };
  const isFree = (r: number, c: number, rs: number, cs: number) => {
    for (let dr = 0; dr < rs; dr++) {
      ensure(r + dr);
      for (let dc = 0; dc < cs; dc++) {
        if (occ[r + dr][c + dc]) return false;
      }
    }
    return true;
  };
  const occupy = (r: number, c: number, rs: number, cs: number) => {
    for (let dr = 0; dr < rs; dr++) {
      ensure(r + dr);
      for (let dc = 0; dc < cs; dc++) occ[r + dr][c + dc] = true;
    }
  };
  let maxRow = 0;
  for (const w of widgets) {
    const cs = Math.min(Math.max(1, w.colSpan), columns);
    const rs = Math.max(1, w.rowSpan);
    let placed = false;
    let r = 0;
    while (!placed) {
      for (let c = 0; c <= columns - cs; c++) {
        if (isFree(r, c, rs, cs)) {
          occupy(r, c, rs, cs);
          maxRow = Math.max(maxRow, r + rs);
          placed = true;
          break;
        }
      }
      if (!placed) r++;
      if (r > 200) break; // safety
    }
  }
  return Math.max(1, maxRow);
}
