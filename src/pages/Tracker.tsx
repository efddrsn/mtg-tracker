import { useEffect, useRef, useState } from 'react';
import {
  useStore, MANA_INFO, clampColSpan, clampRowSpan,
  type ManaColor, type Widget,
} from '../store';
import { CounterWidget } from '../components/CounterWidget';
import { PhaseTracker } from '../components/PhaseTracker';

const LONG_PRESS_MS = 450;
const PRESS_CANCEL_PX = 8;
const DRAG_TAP_PX = 6;
const GRID_GAP_PX = 8;

export function Tracker() {
  const {
    mana, storm, counters, settings,
    incMana, decMana, resetMana,
    incStorm, decStorm, resetStorm,
    incCounter, decCounter, resetCounter,
    reorderWidgets, cycleWidgetColSpan, setWidgetSize,
  } = useStore();

  const [editMode, setEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
  const [resizingId, setResizingId] = useState<string | null>(null);

  const gridRef = useRef<HTMLDivElement | null>(null);

  const pressTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const pressedIdRef = useRef<string | null>(null);
  const wasEditOnPressRef = useRef(false);

  const draggingIdRef = useRef<string | null>(null);
  const hasMovedRef = useRef(false);
  const lastHoverIdRef = useRef<string | null>(null);

  const resizeRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    startCol: number;
    startRow: number;
    cellW: number;
    rowH: number;
    lastCol: number;
    lastRow: number;
  } | null>(null);

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

  const onResizeHandleDown = (e: React.PointerEvent<HTMLDivElement>, widget: Widget) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const grid = gridRef.current;
    if (!grid) return;

    cancelPressTimer();
    pressedIdRef.current = null;
    pressStartRef.current = null;

    const rowVar = getComputedStyle(grid).getPropertyValue('--row-h').trim();
    const rowH = parseFloat(rowVar) || 76;
    const cellW = (grid.clientWidth - GRID_GAP_PX * (settings.columns - 1)) / settings.columns;

    resizeRef.current = {
      id: widget.id,
      startX: e.clientX,
      startY: e.clientY,
      startCol: widget.colSpan,
      startRow: widget.rowSpan,
      cellW: cellW + GRID_GAP_PX,
      rowH: rowH + GRID_GAP_PX,
      lastCol: widget.colSpan,
      lastRow: widget.rowSpan,
    };
    setResizingId(widget.id);
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* noop */ }
    try { navigator.vibrate?.(20); } catch { /* noop */ }
  };

  const onWidgetPointerDown = (e: React.PointerEvent<HTMLDivElement>, widget: Widget) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;
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
      // ── resizing flow ─────────────────────────────────────────────
      const rs = resizeRef.current;
      if (rs) {
        const dx = e.clientX - rs.startX;
        const dy = e.clientY - rs.startY;
        const newCol = clampColSpan(rs.startCol + Math.round(dx / rs.cellW), settings.columns);
        const newRow = clampRowSpan(rs.startRow + Math.round(dy / rs.rowH));
        if (newCol !== rs.lastCol || newRow !== rs.lastRow) {
          rs.lastCol = newCol;
          rs.lastRow = newRow;
          setWidgetSize(rs.id, newCol, newRow);
          try { navigator.vibrate?.(6); } catch { /* noop */ }
        }
        return;
      }

      // ── reorder/long-press flow ──────────────────────────────────
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
        // The dragged widget itself is rendered on top with a transform, so
        // it sits under the pointer for the entire drag. Skip past it so we
        // can detect the widget the user is actually hovering over.
        if (wid === draggingIdRef.current) continue;
        if (wid !== lastHoverIdRef.current) {
          reorderWidgets(draggingIdRef.current, wid);
          lastHoverIdRef.current = wid;
          try { navigator.vibrate?.(8); } catch { /* noop */ }
        }
        break;
      }
    };

    const onUp = () => {
      if (resizeRef.current) {
        resizeRef.current = null;
        setResizingId(null);
        try { navigator.vibrate?.(15); } catch { /* noop */ }
        return;
      }

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
          cycleWidgetColSpan(draggedId);
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
  }, [reorderWidgets, cycleWidgetColSpan, setWidgetSize, settings.columns]);

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
    if (draggingIdRef.current || resizeRef.current) return;
    const target = e.target as HTMLElement;
    if (
      !target.closest('[data-widget-id]') &&
      !target.closest('[data-edit-toolbar]')
    ) {
      setEditMode(false);
    }
  };

  const renderContent = (widget: Widget, span: number, rows: number) => {
    if (widget.type === 'phase') {
      return <PhaseTracker rowSpan={rows} colSpan={span} />;
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
          rowSpan={rows}
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
          rowSpan={rows}
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
          rowSpan={rows}
        />
      );
    }
    return null;
  };

  return (
    <div
      className="tracker-scroll flex-1 overflow-y-auto scroll-hide px-2 pb-4"
      onPointerDown={exitOnBackdrop}
    >
      {editMode && (
        <div
          data-edit-toolbar
          className="sticky top-0 z-30 -mx-2 px-3 py-2 mb-1 flex items-center justify-between
                     bg-black/50 backdrop-blur-md border-b border-border"
        >
          <span className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary truncate pr-2">
            Drag to reorder · Corner to resize
          </span>
          <button
            data-edit-toolbar
            onClick={() => setEditMode(false)}
            className="px-3 py-1.5 rounded-full bg-accent text-white text-xs font-bold
                       hover:bg-accent-hover active:scale-95 transition-all shrink-0"
          >
            Done
          </button>
        </div>
      )}
      <div
        ref={gridRef}
        className="tracker-grid grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${settings.columns}, minmax(0, 1fr))`,
          gridAutoRows: 'var(--row-h)',
        }}
      >
        {visibleWidgets.map((widget, idx) => {
          const span = clampColSpan(widget.colSpan, settings.columns);
          const rows = clampRowSpan(widget.rowSpan);
          const isDragging = draggingId === widget.id;
          const isResizing = resizingId === widget.id;
          const jiggle = editMode && !isDragging && !isResizing;

          const style: React.CSSProperties = {
            gridColumn: `span ${span}`,
            gridRow: `span ${rows}`,
            touchAction: editMode ? 'none' : undefined,
          };
          if (isDragging) {
            style.transform = `translate(${dragDelta.x}px, ${dragDelta.y}px) scale(1.04)`;
            style.zIndex = 40;
            style.transition = 'none';
            style.filter = 'drop-shadow(0 12px 24px rgba(0,0,0,0.55))';
          } else if (isResizing) {
            style.zIndex = 35;
            style.transition = 'none';
            style.filter = 'drop-shadow(0 8px 18px rgba(0,0,0,0.5))';
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
                {renderContent(widget, span, rows)}
              </div>
              {editMode && (
                <div
                  className="absolute inset-0 rounded-2xl pointer-events-none ring-2 ring-accent/40"
                  aria-hidden
                />
              )}
              {editMode && (isResizing || isDragging) && (
                <div
                  className="absolute top-1 left-1 px-1.5 h-4 rounded-full bg-black/60
                             backdrop-blur-sm flex items-center justify-center gap-0.5
                             text-[10px] font-bold text-white pointer-events-none tabular-nums"
                  aria-hidden
                >
                  {span}×{rows}
                </div>
              )}
              {editMode && (
                <div
                  data-resize-handle
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full
                             bg-accent text-white flex items-center justify-center
                             shadow-lg shadow-accent/50 ring-2 ring-black/40
                             cursor-se-resize"
                  style={{ touchAction: 'none' }}
                  onPointerDown={(e) => onResizeHandleDown(e, widget)}
                  aria-label="Resize widget"
                  role="button"
                >
                  <svg width="14" height="14" viewBox="0 0 12 12" aria-hidden>
                    <path d="M11 1L1 11M11 5L5 11M11 9L9 11"
                      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
