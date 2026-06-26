import { useDeckStore } from '../deck/deckStore';
import {
  ALL_COLORS,
  CARD_KINDS,
  FORMATS,
  type ColorCode,
} from '../deck/scryfall';

const COLOR_META: Record<ColorCode, { name: string; var: string }> = {
  W: { name: 'White', var: 'var(--color-mana-w)' },
  U: { name: 'Blue', var: 'var(--color-mana-u)' },
  B: { name: 'Black', var: 'var(--color-mana-b)' },
  R: { name: 'Red', var: 'var(--color-mana-r)' },
  G: { name: 'Green', var: 'var(--color-mana-g)' },
};

interface ConfigSheetProps {
  open: boolean;
  dragY: number; // live drag offset while opening (0..)
  onClose: () => void;
}

export function ConfigSheet({ open, dragY, onClose }: ConfigSheetProps) {
  const config = useDeckStore((s) => s.config);
  const commander = useDeckStore((s) => s.commander);
  const setFormat = useDeckStore((s) => s.setFormat);
  const toggleColor = useDeckStore((s) => s.toggleColor);
  const setColorRule = useDeckStore((s) => s.setColorRule);
  const toggleKind = useDeckStore((s) => s.toggleKind);
  const setTheme = useDeckStore((s) => s.setTheme);
  const setHideBasics = useDeckStore((s) => s.setHideBasics);
  const clearCommander = useDeckStore((s) => s.clearCommander);
  const resetConfig = useDeckStore((s) => s.resetConfig);

  // Colors are dictated by the commander once one is chosen.
  const colorsLocked = !!commander;

  // When open, sheet sits at 0. When closed, it's hidden above the viewport,
  // peeking down by dragY while the user pulls.
  const translate = open ? 0 : -100;

  return (
    <>
      <div
        className={`sheet-scrim ${open ? 'sheet-scrim-on' : ''}`}
        onClick={onClose}
        aria-hidden
      />
      <div
        className="config-sheet"
        style={{
          transform: open
            ? 'translateY(0)'
            : `translateY(calc(${translate}% + ${dragY}px))`,
          transition: dragY === 0 ? 'transform 0.3s cubic-bezier(0.22,0.61,0.36,1)' : 'none',
        }}
        role="dialog"
        aria-label="Recommendation filters"
      >
        <div className="sheet-body">
          <div className="sheet-header">
            <h2>Filters</h2>
            <button type="button" className="sheet-text-btn" onClick={resetConfig}>
              Reset
            </button>
          </div>

          <section className="cfg-section">
            <label className="cfg-label">Format</label>
            <div className="chip-row">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={`chip ${config.format === f.value ? 'chip-on' : ''}`}
                  onClick={() => setFormat(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </section>

          {commander && (
            <section className="cfg-section">
              <label className="cfg-label">Commander</label>
              <div className="cfg-commander">
                {commander.image && (
                  <img src={commander.image} alt="" className="cfg-commander-thumb" />
                )}
                <span className="cfg-commander-name">{commander.name}</span>
                <button
                  type="button"
                  className="sheet-text-btn"
                  onClick={clearCommander}
                >
                  Change
                </button>
              </div>
            </section>
          )}

          <section className="cfg-section">
            <label className="cfg-label">
              {colorsLocked ? 'Colors (locked to commander)' : 'Colors'}
            </label>
            <div className="color-row">
              {ALL_COLORS.map((c) => {
                const on = config.colors.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    className={`color-pip ${on ? 'color-pip-on' : ''}`}
                    style={{ '--pip': COLOR_META[c].var } as React.CSSProperties}
                    onClick={() => !colorsLocked && toggleColor(c)}
                    disabled={colorsLocked}
                    aria-label={COLOR_META[c].name}
                    aria-pressed={on}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            <div className="chip-row" style={{ marginTop: 10 }}>
              <button
                type="button"
                className={`chip ${config.colorRule === 'within' ? 'chip-on' : ''}`}
                onClick={() => setColorRule('within')}
              >
                Within identity
              </button>
              <button
                type="button"
                className={`chip ${config.colorRule === 'exact' ? 'chip-on' : ''}`}
                onClick={() => setColorRule('exact')}
              >
                Exact match
              </button>
            </div>
          </section>

          <section className="cfg-section">
            <label className="cfg-label">Card types</label>
            <div className="chip-row">
              {CARD_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  className={`chip ${config.kinds.includes(k.value) ? 'chip-on' : ''}`}
                  onClick={() => toggleKind(k.value)}
                >
                  {k.label}
                </button>
              ))}
            </div>
          </section>

          <section className="cfg-section">
            <label className="cfg-label" htmlFor="theme-input">
              Theme / keyword
            </label>
            <input
              id="theme-input"
              type="text"
              className="cfg-input"
              placeholder="e.g. lifegain, sacrifice, draw"
              value={config.theme}
              onChange={(e) => setTheme(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </section>

          <section className="cfg-section">
            <label className="cfg-toggle">
              <input
                type="checkbox"
                checked={config.hideBasics}
                onChange={(e) => setHideBasics(e.target.checked)}
              />
              <span>Hide basic lands</span>
            </label>
          </section>

          <button type="button" className="sheet-done-btn" onClick={onClose}>
            Show recommendations
          </button>
        </div>
      </div>
    </>
  );
}
