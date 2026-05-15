import { useEffect, useRef, useState } from 'react';
import { useStore, MANA_INFO, type ManaColor, type Widget } from '../store';
import { CounterWidget } from '../components/CounterWidget';
import { PhaseTracker } from '../components/PhaseTracker';

const LONG_PRESS_MS = 450;
const PRESS_CANCEL_PX = 8;
const DRAG_TAP_PX = 6;

export function Tracker() {
  const {
    mana, storm, counters, settings,
    incMana, decMana, resetMana,
    incStorm, decStorm, resetStorm,
    incCounter, decCounter, resetCounter,
    reorderWidgets, toggleWidgetSpan,
  } = useStore();

  const [editMode, setEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });

  const pressTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const pressedIdRef = useRef<string | null>(null);
  const wasEditOnPressRef = useRef(false);

  const draggingIdRef = useRef<string | null>(null);
  const hasMovedRef = useRef(false);
  const lastHoverIdRef = useRef<string | null>(null);

  const visibleWidgets = settings.widgets.filter((w) => {
    if (!w.visible) return false;
    if (w.type === 'mana' && w.manaColor && !settings.enabledMana.includes(w.manaColor)) return false;
    if (w.type === 'counter' && w.counterId && !counters.find((c) => c.id === w.counterId)) return false;
    return true;
  });

  const cancelPressTimer = () => {
    if (pressTimerRef.current != null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const beginDrag = (id: string) => {
    try { navigator.vibrate?.(25); } catch { /* noop */ }
    draggingIdRef.current = id;
    hasMovedRef.current = false;
    lastHoverIdRef.current = id;
    setDraggingId(id);
    setDragDelta({ x: 0, y: 0 });
  };

  const onWidgetPointerDown = (e: React.PointerEvent<HTMLDivElement>, widget: Widget) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    pressedIdRef.current = widget.id;
    wasEditOnPressRef.current = editMode;
    cancelPressTimer();

    if (editMode) {
      beginDrag(widget.id);
    } else {
      pressTimerRef.current = window.setTimeout(() => {
        pressTimerRef.current = null;
        if (pressedIdRef.current !== widget.id) return;
        setEditMode(true);
        beginDrag(widget.id);
      }, LONG_PRESS_MS);
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const start = pressStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      if (draggingIdRef.current == null) {
        if (Math.abs(dx) > PRESS_CANCEL_PX || Math.abs(dy) > PRESS_CANCEL_PX) {
          cancelPressTimer();
          pressedIdRef.current = null;
          pressStartRef.current = null;
        }
        return;
      }

      if (Math.abs(dx) > DRAG_TAP_PX || Math.abs(dy) > DRAG_TAP_PX) {
        hasMovedRef.current = true;
      }

      setDragDelta({ x: dx, y: dy });

      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of stack) {
        const node = el as HTMLElement;
        const host = node.closest?.('[data-widget-id]') as HTMLElement | null;
        if (!host) continue;
        const wid = host.dataset.widgetId;
        if (!wid) continue;
        if (wid === draggingIdRef.current) {
          lastHoverIdRef.current = wid;
          break;
        }
        if (wid !== lastHoverIdRef.current) {
          reorderWidgets(draggingIdRef.current, wid);
          lastHoverIdRef.current = wid;
          try { navigator.vibrate?.(8); } catch { /* noop */ }
        }
        break;
      }
    };

    const onUp = () => {
      cancelPressTimer();
      const draggedId = draggingIdRef.current;
      const moved = hasMovedRef.current;
      const wasEditOnPress = wasEditOnPressRef.current;

      pressedIdRef.current = null;
      pressStartRef.current = null;
      draggingIdRef.current = null;
      hasMovedRef.current = false;
      lastHoverIdRef.current = null;

      if (draggedId != null) {
        setDraggingId(null);
        setDragDelta({ x: 0, y: 0 });
        if (!moved && wasEditOnPress) {
          toggleWidgetSpan(draggedId);
        }
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [reorderWidgets, toggleWidgetSpan]);

  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode]);

  const exitOnBackdrop = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode) return;
    if (draggingIdRef.current) return;
    const target = e.target as HTMLElement;
    if (!target.closest('[data-widget-id]') && !target.closest('[data-edit-toolbar]')) {
      setEditMode(false);
    }
  };

  const renderContent = (widget: Widget, span: 1 | 2) => {
    if (widget.type === 'phase') {
      return <PhaseTracker />;
    }
    if (widget.type === 'storm') {
      return (
        <CounterWidget
          value={storm}
          label="Storm"
          symbol="⚡"
          accentColor="var(--color-accent)"
          onInc={incStorm}
          onDec={decStorm}
          onReset={resetStorm}
          colSpan={span}
          columns={settings.columns}
        />
      );
    }
    if (widget.type === 'mana' && widget.manaColor) {
      const color = widget.manaColor as ManaColor;
      const info = MANA_INFO[color];
      return (
        <CounterWidget
          value={mana[color]}
          label={info.name}
          symbol={info.symbol}
          bgColor={info.bgVar}
          accentColor={info.colorVar}
          onInc={() => incMana(color)}
          onDec={() => decMana(color)}
          onReset={() => resetMana(color)}
          colSpan={span}
          columns={settings.columns}
        />
      );
    }
    if (widget.type === 'counter' && widget.counterId) {
      const counter = counters.find((c) => c.id === widget.counterId);
      if (!counter) return null;
      return (
        <CounterWidget
          value={counter.value}
          label={counter.name}
          symbol="🔢"
          onInc={() => incCounter(counter.id)}
          onDec={() => decCounter(counter.id)}
          onReset={() => resetCounter(counter.id)}
          colSpan={span}
          columns={settings.columns}
        />
      );
    }
    return null;
  };

  return (
    <div
      className="flex-1 overflow-y-auto scroll-hide px-2 pb-4"
      onPointerDown={exitOnBackdrop}
    >
      {editMode && (
        <div
          data-edit-toolbar
          className="sticky top-0 z-30 -mx-2 px-3 py-2 mb-1 flex items-center justify-between
                     bg-black/40 backdrop-blur-md border-b border-border"
        >
          <span className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary">
            Drag to reorder · Tap to resize
          </span>
          <button
            data-edit-toolbar
            onClick={() => setEditMode(false)}
            className="px-3 py-1.5 rounded-full bg-accent text-white text-xs font-bold
                       hover:bg-accent-hover active:scale-95 transition-all"
          >
            Done
          </button>
        </div>
      )}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${settings.columns}, 1fr)` }}
      >
        {visibleWidgets.map((widget, idx) => {
          const span = Math.min(widget.colSpan, settings.columns) as 1 | 2;
          const isDragging = draggingId === widget.id;
          const jiggle = editMode && !isDragging;

          const style: React.CSSProperties = {
            gridColumn: `span ${span}`,
            touchAction: editMode ? 'none' : undefined,
          };
          if (isDragging) {
            style.transform = `translate(${dragDelta.x}px, ${dragDelta.y}px) scale(1.06)`;
            style.zIndex = 40;
            style.transition = 'none';
            style.filter = 'drop-shadow(0 12px 24px rgba(0,0,0,0.55))';
          } else if (editMode) {
            style.animationDelay = `${(idx % 2) * -0.09}s`;
          }

          return (
            <div
              key={widget.id}
              data-widget-id={widget.id}
              className={`relative ${jiggle ? 'jiggle' : ''}`}
              style={style}
              onPointerDown={(e) => onWidgetPointerDown(e, widget)}
            >
              <div
                className="h-full"
                style={{ pointerEvents: editMode ? 'none' : undefined }}
              >
                {renderContent(widget, span)}
              </div>
              {editMode && (
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none ring-2 ring-accent/40"
                  aria-hidden
                />
              )}
              {editMode && (
                <div
                  className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-surface
                             border border-border flex items-center justify-center
                             text-[10px] font-bold text-accent pointer-events-none"
                  aria-hidden
                  title={span === 2 ? 'Wide' : 'Compact'}
                >
                  {span === 2 ? '⇔' : '·'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
