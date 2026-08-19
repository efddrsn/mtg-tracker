import { useEffect, useRef, useState } from 'react';
import type { DeckCard } from '../deck/scryfall';

interface CardSearchModalProps {
  ariaLabel: string;
  placeholder: string;
  dismissLabel: string;
  hint: string;
  searchFn: (term: string, signal?: AbortSignal) => Promise<DeckCard[]>;
  onPick: (card: DeckCard) => void;
  onClose: () => void;
}

// Shared search-and-pick overlay: type a name, see live matches with thumbnails,
// tap one to choose it, or dismiss without picking. Mounted only while open, so
// it always starts fresh. Used both for "find my commander" and the general
// "add a card" field — the two differ only in what they search and what
// picking a result does.
export function CardSearchModal({
  ariaLabel,
  placeholder,
  dismissLabel,
  hint,
  searchFn,
  onPick,
  onClose,
}: CardSearchModalProps) {
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
      searchFn(term, ctrl.signal)
        .then((cards) => setResults(cards))
        .catch(() => { /* aborted or offline; keep prior results */ })
        .finally(() => setLoading(false));
    }, 280);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
    // searchFn is expected to be stable per-mount (a fresh instance each open).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  return (
    <>
      <div className="sheet-scrim sheet-scrim-on" onClick={onClose} aria-hidden />
      <div className="search-modal" role="dialog" aria-label={ariaLabel}>
        <div className="search-head">
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoCapitalize="words"
            autoCorrect="off"
          />
          <button type="button" className="search-skip" onClick={onClose}>
            {dismissLabel}
          </button>
        </div>

        <div className="search-results">
          {!active && <div className="search-status">{hint}</div>}
          {active && loading && results.length === 0 && (
            <div className="search-status">
              <div className="feed-spinner" />
            </div>
          )}
          {active && !loading && results.length === 0 && (
            <div className="search-status">No cards match “{term}”.</div>
          )}
          {active &&
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                className="search-result"
                onClick={() => onPick(c)}
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
