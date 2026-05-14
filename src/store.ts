import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

export const ALL_MANA: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

export const MANA_INFO: Record<ManaColor, { name: string; symbol: string; colorVar: string; bgVar: string }> = {
  W: { name: 'White', symbol: '☀', colorVar: 'var(--color-mana-w)', bgVar: 'var(--color-mana-w-bg)' },
  U: { name: 'Blue', symbol: '💧', colorVar: 'var(--color-mana-u)', bgVar: 'var(--color-mana-u-bg)' },
  B: { name: 'Black', symbol: '💀', colorVar: 'var(--color-mana-b)', bgVar: 'var(--color-mana-b-bg)' },
  R: { name: 'Red', symbol: '🔥', colorVar: 'var(--color-mana-r)', bgVar: 'var(--color-mana-r-bg)' },
  G: { name: 'Green', symbol: '🌲', colorVar: 'var(--color-mana-g)', bgVar: 'var(--color-mana-g-bg)' },
  C: { name: 'Colorless', symbol: '◇', colorVar: 'var(--color-mana-c)', bgVar: 'var(--color-mana-c-bg)' },
};

export const PHASES = [
  'Untap',
  'Upkeep',
  'Draw',
  'Main 1',
  'Combat',
  'Main 2',
  'End',
] as const;

export type Phase = (typeof PHASES)[number];

export interface CustomCounter {
  id: string;
  name: string;
  value: number;
}

export type WidgetType = 'phase' | 'storm' | 'mana' | 'counter';

export interface Widget {
  id: string;
  type: WidgetType;
  manaColor?: ManaColor;
  counterId?: string;
  colSpan: 1 | 2;
  visible: boolean;
}

export interface Settings {
  columns: 2 | 3 | 4;
  enabledMana: ManaColor[];
  widgets: Widget[];
  showPhaseTracker: boolean;
  newTurnResetsMana: boolean;
  newTurnResetsStorm: boolean;
}

function createDefaultWidgets(): Widget[] {
  return [
    { id: 'phase', type: 'phase', colSpan: 2, visible: true },
    { id: 'storm', type: 'storm', colSpan: 1, visible: true },
    { id: 'mana-W', type: 'mana', manaColor: 'W', colSpan: 1, visible: true },
    { id: 'mana-U', type: 'mana', manaColor: 'U', colSpan: 1, visible: true },
    { id: 'mana-B', type: 'mana', manaColor: 'B', colSpan: 1, visible: true },
    { id: 'mana-R', type: 'mana', manaColor: 'R', colSpan: 1, visible: true },
    { id: 'mana-G', type: 'mana', manaColor: 'G', colSpan: 1, visible: true },
    { id: 'mana-C', type: 'mana', manaColor: 'C', colSpan: 1, visible: false },
  ];
}

function defaultSettings(): Settings {
  return {
    columns: 2,
    enabledMana: ['W', 'U', 'B', 'R', 'G'],
    widgets: createDefaultWidgets(),
    showPhaseTracker: true,
    newTurnResetsMana: true,
    newTurnResetsStorm: true,
  };
}

interface TrackerState {
  mana: Record<ManaColor, number>;
  storm: number;
  currentPhase: number;
  turn: number;
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
  newTurn: () => void;
  addCounter: (name: string) => void;
  removeCounter: (id: string) => void;
  incCounter: (id: string) => void;
  decCounter: (id: string) => void;
  resetCounter: (id: string) => void;
  resetAll: () => void;
  updateSettings: (s: Partial<Settings>) => void;
  moveWidget: (id: string, dir: -1 | 1) => void;
  toggleWidgetVisible: (id: string) => void;
  setWidgetSpan: (id: string, span: 1 | 2) => void;
}

function vibrate(ms = 10) {
  try { navigator.vibrate?.(ms); } catch { /* noop */ }
}

export const useStore = create<TrackerState>()(
  persist(
    (set) => ({
      mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      storm: 0,
      currentPhase: 0,
      turn: 1,
      counters: [],
      settings: defaultSettings(),

      incMana: (c) => {
        vibrate();
        set((s) => ({ mana: { ...s.mana, [c]: s.mana[c] + 1 } }));
      },
      decMana: (c) => {
        vibrate();
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
      incStorm: () => { vibrate(); set((s) => ({ storm: s.storm + 1 })); },
      decStorm: () => { vibrate(); set((s) => ({ storm: Math.max(0, s.storm - 1) })); },
      resetStorm: () => { vibrate(30); set({ storm: 0 }); },

      setPhase: (i) => { vibrate(5); set({ currentPhase: i }); },
      nextPhase: () => {
        vibrate(5);
        set((s) => ({ currentPhase: (s.currentPhase + 1) % PHASES.length }));
      },
      newTurn: () => {
        vibrate(40);
        set((s) => ({
          currentPhase: 0,
          turn: s.turn + 1,
          ...(s.settings.newTurnResetsMana ? { mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 } } : {}),
          ...(s.settings.newTurnResetsStorm ? { storm: 0 } : {}),
        }));
      },

      addCounter: (name) => {
        const ts = Date.now();
        const cId = `c-${ts}`;
        set((s) => ({
          counters: [...s.counters, { id: cId, name, value: 0 }],
          settings: {
            ...s.settings,
            widgets: [
              ...s.settings.widgets,
              { id: `counter-${ts}`, type: 'counter' as const, counterId: cId, colSpan: 1 as const, visible: true },
            ],
          },
        }));
      },
      removeCounter: (id) =>
        set((s) => ({
          counters: s.counters.filter((c) => c.id !== id),
          settings: {
            ...s.settings,
            widgets: s.settings.widgets.filter((w) => w.counterId !== id),
          },
        })),
      incCounter: (id) => {
        vibrate();
        set((s) => ({
          counters: s.counters.map((c) => c.id === id ? { ...c, value: c.value + 1 } : c),
        }));
      },
      decCounter: (id) => {
        vibrate();
        set((s) => ({
          counters: s.counters.map((c) => c.id === id ? { ...c, value: Math.max(0, c.value - 1) } : c),
        }));
      },
      resetCounter: (id) => {
        vibrate(30);
        set((s) => ({
          counters: s.counters.map((c) => c.id === id ? { ...c, value: 0 } : c),
        }));
      },

      resetAll: () => {
        vibrate(50);
        set({
          mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
          storm: 0,
          currentPhase: 0,
          turn: 1,
          counters: [],
        });
      },

      updateSettings: (partial) =>
        set((s) => ({ settings: { ...s.settings, ...partial } })),

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

      toggleWidgetVisible: (id) =>
        set((s) => ({
          settings: {
            ...s.settings,
            widgets: s.settings.widgets.map((w) =>
              w.id === id ? { ...w, visible: !w.visible } : w
            ),
          },
        })),

      setWidgetSpan: (id, span) =>
        set((s) => ({
          settings: {
            ...s.settings,
            widgets: s.settings.widgets.map((w) =>
              w.id === id ? { ...w, colSpan: span } : w
            ),
          },
        })),
    }),
    {
      name: 'mtg-tracker-storage',
      version: 1,
    }
  )
);
