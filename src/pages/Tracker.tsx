import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useStore, MANA_INFO, clampColSpan, clampRowSpan, vibrate, calculateGridRows,
  type ManaColor, type Widget,
} from '../store';
import { CounterWidget } from '../components/CounterWidget';
import { PhaseTracker } from '../components/PhaseTracker';
import { ManaIcon, StormIcon, CounterIcon, HeartIcon } from '../components/Symbols';

const LONG_PRESS_MS = 450;
const PRESS_CANCEL_PX = 8;
const DRAG_TAP_PX = 6;
const GRID_GAP_PX = 8;

const SWIPE_RESET_DX = 180;
const SWIPE_RESET_DY_MAX = 90;
const SWIPE_RESET_MS = 700;

export function Tracker() {
  const {
    mana, storm, counters, settings, life,
    incMana, decMana,
    incStorm, decStorm,
    incCounter, decCounter,
    incLife, decLife,
    reorderWidgets, cycleWidgetColSpan, setWidgetSize,
    resetAll,
  } = useStore();
  const navigate = useNavigate();

  const [editMode, setEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [resetFlash, setResetFlash] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const pressTimerRef = useRef<number | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const pressedIdRef = useRef<string | null>(null);
  const wasEditOnPressRef = useRef(false);
  const backdropPressRef = useRef(false);

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

  const visibleWidgets = useMemo(
    () => settings.widgets.filter((w) => {
      if (!w.visible) return false;
      if (w.type === 'counter' && w.counterId && !counters.find((c) => c.id === w.counterId)) return false;
      return true;
    }),
    [settings.widgets, counters]
  );

  const totalRows = useMemo(
    () => calculateGridRows(visibleWidgets, settings.columns),
    [visibleWidgets, settings.columns]
  );

  const cancelPressTimer = () => {
    if (pressTimerRef.current != null) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const beginDrag = (id: string) => {
    vibrate(25);
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
    backdropPressRef.current = false;

    const rect = grid.getBoundingClientRect();
    const rowH = rect.height > 0 && totalRows > 0
      ? (rect.height - GRID_GAP_PX * (totalRows - 1)) / totalRows
      : 76;
    const cellW = (rect.width - GRID_GAP_PX * (settings.columns - 1)) / settings.columns;

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
    vibrate(20);
  };

  const onWidgetPointerDown = (e: React.PointerEvent<HTMLDivElement>, widget: Widget) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    pressedIdRef.current = widget.id;
    backdropPressRef.current = false;
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

  // Long-press on the empty backdrop also enters edit mode (no drag).
  const onScrollPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-widget-id]')) return;
    if (target.closest('[data-edit-toolbar]')) return;

    if (editMode) {
      if (!draggingIdRef.current && !resizeRef.current) {
        setEditMode(false);
      }
      return;
    }

    pressStartRef.current = { x: e.clientX, y: e.clientY };
    pressedIdRef.current = null;
    backdropPressRef.current = true;
    cancelPressTimer();
    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null;
      if (!backdropPressRef.current) return;
      vibrate(25);
      setEditMode(true);
    }, LONG_PRESS_MS);
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
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
          vibrate(6);
        }
        return;
      }

      const start = pressStartRef.current;
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      if (draggingIdRef.current == null) {
        if (Math.abs(dx) > PRESS_CANCEL_PX || Math.abs(dy) > PRESS_CANCEL_PX) {
          cancelPressTimer();
          pressedIdRef.current = null;
          pressStartRef.current = null;
          backdropPressRef.current = false;
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
        if (wid === draggingIdRef.current) continue;
        if (wid !== lastHoverIdRef.current) {
          reorderWidgets(draggingIdRef.current, wid);
          lastHoverIdRef.current = wid;
          vibrate(8);
        }
        break;
      }
    };

    const onUp = () => {
      if (resizeRef.current) {
        resizeRef.current = null;
        setResizingId(null);
        vibrate(15);
        return;
      }

      cancelPressTimer();
      const draggedId = draggingIdRef.current;
      const moved = hasMovedRef.current;
      const wasEditOnPress = wasEditOnPressRef.current;

      pressedIdRef.current = null;
      pressStartRef.current = null;
      backdropPressRef.current = false;
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
    if (editMode) return;
    const el = scrollRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startT = 0;
    let active = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { active = false; return; }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startT = Date.now();
      active = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!active || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (Math.abs(t.clientY - startY) > SWIPE_RESET_DY_MAX) active = false;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const dt = Date.now() - startT;
      if (dt < SWIPE_RESET_MS && Math.abs(dx) >= SWIPE_RESET_DX && Math.abs(dy) <= SWIPE_RESET_DY_MAX) {
        resetAll();
        setResetFlash(true);
        window.setTimeout(() => setResetFlash(false), 600);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [editMode, resetAll]);

  useEffect(() => {
    if (!editMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editMode]);

  const renderContent = (widget: Widget, span: number, rows: number) => {
    if (widget.type === 'phase') {
      return <PhaseTracker rowSpan={rows} colSpan={span} />;
    }
    if (widget.type === 'life') {
      return (
        <CounterWidget
          value={life}
          label="Life"
          icon={<HeartIcon width="100%" height="100%" />}
          bgColor="var(--color-life-bg)"
          accentColor="var(--color-life)"
          onInc={incLife}
          onDec={decLife}
          colSpan={span}
          rowSpan={rows}
        />
      );
    }
    if (widget.type === 'storm') {
      return (
        <CounterWidget
          value={storm}
          label="Storm"
          icon={<StormIcon width="100%" height="100%" />}
          accentColor="var(--color-accent)"
          onInc={incStorm}
          onDec={decStorm}
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
          icon={<ManaIcon color={color} width="100%" height="100%" />}
          bgColor={info.bgVar}
          accentColor={info.colorVar}
          onInc={() => incMana(color)}
          onDec={() => decMana(color)}
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
          icon={<CounterIcon width="100%" height="100%" />}
          onInc={() => incCounter(counter.id)}
          onDec={() => decCounter(counter.id)}
          colSpan={span}
          rowSpan={rows}
        />
      );
    }
    return null;
  };

  const fit = settings.fitToScreen;

  const gridStyle: React.CSSProperties = {
    gridTemplateColumns: `repeat(${settings.columns}, minmax(0, 1fr))`,
  };
  if (fit) {
    gridStyle.gridTemplateRows = `repeat(${totalRows}, minmax(0, 1fr))`;
  } else {
    gridStyle.gridAutoRows = 'var(--row-h)';
  }

  return (
    <div
      ref={scrollRef}
      className={`tracker-scroll relative flex-1 ${fit ? 'overflow-hidden' : 'overflow-y-auto'} scroll-hide
                 flex flex-col px-2 pt-2 pb-2`}
      onPointerDown={onScrollPointerDown}
    >
      {resetFlash && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center reset-flash"
          aria-hidden
        >
          <div className="px-5 py-3 rounded-2xl bg-accent/90 text-white text-sm font-bold uppercase tracking-wider shadow-2xl">
            Reset
          </div>
        </div>
      )}
      {editMode && (
        <div
          data-edit-toolbar
          className="shrink-0 z-30 px-3 py-2 mb-2 flex items-center justify-between
                     bg-black/60 backdrop-blur-md rounded-xl border border-border"
        >
          <button
            data-edit-toolbar
            onClick={() => { vibrate(15); navigate('/settings'); }}
            className="counter-btn w-9 h-9 flex items-center justify-center rounded-full
                       bg-white/10 text-text-primary hover:bg-white/20 active:scale-95 transition-all"
            aria-label="Settings"
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
          <span className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary truncate px-2">
            Drag · corner to resize
          </span>
          <button
            data-edit-toolbar
            onClick={() => { vibrate(10); setEditMode(false); }}
            className="px-3 py-1.5 rounded-full bg-accent text-white text-xs font-bold
                       hover:bg-accent-hover active:scale-95 transition-all shrink-0"
          >
            Done
          </button>
        </div>
      )}
      <div
        ref={gridRef}
        className={`tracker-grid grid gap-2 ${fit ? 'flex-1 min-h-0' : ''}`}
        style={gridStyle}
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
              className={`relative min-h-0 min-w-0 ${jiggle ? 'jiggle' : ''}`}
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
