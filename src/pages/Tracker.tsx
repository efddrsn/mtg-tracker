import { useEffect, useRef, useState } from 'react';
import { useStore, MANA_INFO, type ManaColor, type Widget } from '../store';
import { CounterWidget } from '../components/CounterWidget';
import { PhaseTracker } from '../components/PhaseTracker';

const LONG_PRESS_MS = 450;
const PRESS_CANCEL_PX = 8;
const DRAG_TAP_PX = 6;
const GUIDE_EXTRA_ROWS = 2;

interface DragState {
  id: string;
  width: number;
  height: number;
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
}

interface PressInfo {
  id: string;
  x: number;
  y: number;
  rect: DOMRect;
  offsetX: number;
  offsetY: number;
}

function computeGridRows(widgets: Widget[], columns: number): number {
  let used = 0;
  for (const w of widgets) {
    const span = Math.min(w.colSpan, columns);
    const col = used % columns;
    if (col + span > columns) used += columns - col;
    used += span;
  }
  return Math.ceil(used / columns);
}

export function Tracker() {
  const {
    mana, storm, counters, settings,
    incMana, decMana, resetMana,
    incStorm, decStorm, resetStorm,
    incCounter, decCounter, resetCounter,
    reorderWidgets, moveWidgetToEnd, toggleWidgetSpan,
  } = useStore();

  const [editMode, setEditMode] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const pressInfoRef = useRef<PressInfo | null>(null);
  const wasEditOnPressRef = useRef(false);
  const hasMovedRef = useRef(false);
  const lastHoverIdRef = useRef<string | null>(null);

  const visibleWidgets = settings.widgets.filter((w) => {
    if (!w.visible) return false;
    if (w.type === 'mana' && w.manaColor && !settings.enabledMana.includes(w.manaColor)) return false;
    if (w.type === 'counter' && w.counterId && !counters.find((c) => c.id === w.counterId)) return false;
    return true;
  });

  const filledRows = computeGridRows(visibleWidgets, settings.columns);
  const guideRows = editMode ? Math.max(filledRows + GUIDE_EXTRA_ROWS, 4) : 0;

  const cancelPressTimer = () => {
    if (pressTimerRef.current != null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const startDrag = (id: string) => {
    const info = pressInfoRef.current;
    if (!info || info.id !== id) return;
    try { navigator.vibrate?.(25); } catch { /* noop */ }
    const next: DragState = {
      id,
      width: info.rect.width,
      height: info.rect.height,
      pointerX: info.x,
      pointerY: info.y,
      offsetX: info.offsetX,
      offsetY: info.offsetY,
    };
    dragRef.current = next;
    hasMovedRef.current = false;
    lastHoverIdRef.current = id;
    setDrag(next);
  };

  const onWidgetPointerDown = (e: React.PointerEvent<HTMLDivElement>, widget: Widget) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    pressInfoRef.current = {
      id: widget.id,
      x: e.clientX,
      y: e.clientY,
      rect,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    wasEditOnPressRef.current = editMode;
    cancelPressTimer();

    if (editMode) {
      startDrag(widget.id);
    } else {
      pressTimerRef.current = window.setTimeout(() => {
        pressTimerRef.current = null;
        if (!pressInfoRef.current || pressInfoRef.current.id !== widget.id) return;
        setEditMode(true);
        startDrag(widget.id);
      }, LONG_PRESS_MS);
    }
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const press = pressInfoRef.current;
      if (!press) return;
      const dx = e.clientX - press.x;
      const dy = e.clientY - press.y;

      if (!dragRef.current) {
        if (Math.abs(dx) > PRESS_CANCEL_PX || Math.abs(dy) > PRESS_CANCEL_PX) {
          cancelPressTimer();
          pressInfoRef.current = null;
        }
        return;
      }

      if (Math.abs(dx) > DRAG_TAP_PX || Math.abs(dy) > DRAG_TAP_PX) {
        hasMovedRef.current = true;
      }

      const next = { ...dragRef.current, pointerX: e.clientX, pointerY: e.clientY };
      dragRef.current = next;
      setDrag(next);

      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      let hitWidgetId: string | null = null;
      let hitEmptyGuide = false;
      for (const el of stack) {
        const node = el as HTMLElement;
        const widgetHost = node.closest?.('[data-widget-id]') as HTMLElement | null;
        if (widgetHost) {
          hitWidgetId = widgetHost.dataset.widgetId || null;
          break;
        }
        if (node.dataset?.guideCell != null) {
          hitEmptyGuide = true;
          break;
        }
      }

      const dragId = dragRef.current.id;
      if (hitWidgetId && hitWidgetId !== dragId) {
        if (hitWidgetId !== lastHoverIdRef.current) {
          reorderWidgets(dragId, hitWidgetId);
          lastHoverIdRef.current = hitWidgetId;
          try { navigator.vibrate?.(8); } catch { /* noop */ }
        }
      } else if (hitEmptyGuide) {
        if (lastHoverIdRef.current !== '__end__') {
          moveWidgetToEnd(dragId);
          lastHoverIdRef.current = '__end__';
          try { navigator.vibrate?.(8); } catch { /* noop */ }
        }
      } else if (hitWidgetId === dragId) {
        lastHoverIdRef.current = dragId;
      }
    };

    const onUp = () => {
      cancelPressTimer();
      const dragging = dragRef.current;
      const moved = hasMovedRef.current;
      const wasEditOnPress = wasEditOnPressRef.current;

      pressInfoRef.current = null;
      dragRef.current = null;
      hasMovedRef.current = false;
      lastHoverIdRef.current = null;

      if (dragging) {
        setDrag(null);
        if (!moved && wasEditOnPress) {
          toggleWidgetSpan(dragging.id);
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
  }, [reorderWidgets, moveWidgetToEnd, toggleWidgetSpan]);

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
    if (dragRef.current) return;
    const target = e.target as HTMLElement;
    if (
      !target.closest('[data-widget-id]') &&
      !target.closest('[data-edit-toolbar]') &&
      !target.closest('[data-guide-cell]')
    ) {
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

  const draggedWidget = drag ? visibleWidgets.find((w) => w.id === drag.id) : null;
  const draggedSpan = draggedWidget
    ? (Math.min(draggedWidget.colSpan, settings.columns) as 1 | 2)
    : 1;

  return (
    <div
      className="flex-1 overflow-y-auto scroll-hide px-2 pb-4"
      onPointerDown={exitOnBackdrop}
    >
      {editMode && (
        <div
          data-edit-toolbar
          className="sticky top-0 z-30 -mx-2 px-3 py-2 mb-2 flex items-center justify-between
                     bg-black/60 backdrop-blur-md border-b border-accent/30"
        >
          <span className="text-[11px] uppercase tracking-wider font-semibold text-accent">
            Drag to reorder · Tap to resize · Drop in empty cell
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

      <div className="relative">
        {/* Grid guide cells - shows the underlying grid in edit mode */}
        {editMode && guideRows > 0 && (
          <div
            className="absolute inset-x-0 top-0 grid gap-2 pointer-events-none"
            style={{
              gridTemplateColumns: `repeat(${settings.columns}, 1fr)`,
              gridAutoRows: 'minmax(5.5rem, 1fr)',
              height: `calc(${guideRows} * 5.5rem + ${guideRows - 1} * 0.5rem)`,
            }}
            aria-hidden
          >
            {Array.from({ length: guideRows * settings.columns }).map((_, i) => (
              <div
                key={i}
                data-guide-cell="1"
                className="grid-guide-cell rounded-2xl pointer-events-auto"
              />
            ))}
          </div>
        )}

        <div
          className="grid gap-2 relative"
          style={{ gridTemplateColumns: `repeat(${settings.columns}, 1fr)` }}
        >
          {visibleWidgets.map((widget, idx) => {
            const span = Math.min(widget.colSpan, settings.columns) as 1 | 2;
            const isDragging = drag?.id === widget.id;
            const jiggle = editMode && !isDragging;

            const style: React.CSSProperties = {
              gridColumn: `span ${span}`,
              touchAction: editMode ? 'none' : undefined,
            };
            if (jiggle) {
              style.animationDelay = `${(idx % 2) * -0.09}s`;
            }
            if (isDragging) {
              style.opacity = 0.25;
              style.transition = 'opacity 120ms';
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
                {editMode && !isDragging && (
                  <div
                    className="absolute inset-0 rounded-2xl pointer-events-none
                               ring-2 ring-accent/70 ring-offset-0"
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating ghost that follows the pointer while dragging */}
      {drag && draggedWidget && (
        <div
          style={{
            position: 'fixed',
            left: drag.pointerX - drag.offsetX,
            top: drag.pointerY - drag.offsetY,
            width: drag.width,
            height: drag.height,
            pointerEvents: 'none',
            zIndex: 60,
            transform: 'scale(1.06)',
            transformOrigin: 'center',
            filter: 'drop-shadow(0 18px 36px rgba(0,0,0,0.6))',
            willChange: 'left, top',
          }}
          aria-hidden
        >
          <div className="h-full opacity-95 pointer-events-none">
            {renderContent(draggedWidget, draggedSpan)}
          </div>
        </div>
      )}
    </div>
  );
}
