import { useEffect, useRef, useState } from 'react';
import { useDeckStore } from '../deck/deckStore';
import { searchCommanders, type DeckCard } from '../deck/scryfall';

interface CommanderSearchProps {
  onClose: () => void;
}

// Optional shortcut for players who already know their commander: type a name,
// pick from matches, and skip the swiping entirely. Mounted only while open, so
// it always starts fresh; fully dismissible.
export function CommanderSearch({ onClose }: CommanderSearchProps) {
  const setCommander = useDeckStore((s) => s.setCommander);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DeckCard[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim();
  const active = term.length >= 2;

  // Focus the field on open.
  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, []);

  // Debounced search. setState happens only inside the timeout callback, never
  // synchronously in the effect body.
  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      setLoading(true);
      searchCommanders(term, ctrl.signal)
        .then((cards) => setResults(cards))
        .catch(() => { /* aborted or offline; keep prior results */ })
        .finally(() => setLoading(false));
    }, 280);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [term]);

  const choose = (card: DeckCard) => {
    setCommander(card);
    onClose();
  };

  return (
    <>
      <div className="sheet-scrim sheet-scrim-on" onClick={onClose} aria-hidden />
      <div className="search-modal" role="dialog" aria-label="Find your commander">
        <div className="search-head">
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Search for a commander…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoCapitalize="words"
            autoCorrect="off"
          />
          <button type="button" className="search-skip" onClick={onClose}>
            Skip
          </button>
        </div>

        <div className="search-results">
          {!active && (
            <div className="search-status">
              Type a name to jump straight to your commander, or skip to swipe.
            </div>
          )}
          {active && loading && results.length === 0 && (
            <div className="search-status">
              <div className="feed-spinner" />
            </div>
          )}
          {active && !loading && results.length === 0 && (
            <div className="search-status">No commanders match “{term}”.</div>
          )}
          {active &&
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                className="search-result"
                onClick={() => choose(c)}
              >
                {c.image && (
                  <img
                    src={c.image}
                    alt=""
                    className="search-result-thumb"
                    draggable={false}
                  />
                )}
                <div className="search-result-main">
                  <span className="search-result-name">{c.name}</span>
                  <span className="search-result-type">{c.typeLine}</span>
                </div>
              </button>
            ))}
        </div>
      </div>
    </>
  );
}
