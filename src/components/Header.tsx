import { useStore } from '../store';
import { useNavigate, useLocation } from 'react-router-dom';

export function Header() {
  const resetAll = useStore((s) => s.resetAll);
  const navigate = useNavigate();
  const location = useLocation();
  const isSettings = location.pathname === '/settings';

  return (
    <header className="flex items-center justify-between px-3 py-2 shrink-0">
      <h1 className="text-base font-bold tracking-wide text-text-primary">
        MTG Tracker
      </h1>
      <div className="flex items-center gap-1">
        {!isSettings && (
          <button
            className="counter-btn w-9 h-9 flex items-center justify-center rounded-xl
                       text-text-secondary hover:text-danger hover:bg-danger/10 active:bg-danger/20
                       text-sm"
            onClick={resetAll}
            aria-label="Reset all counters"
            title="Reset all"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
            </svg>
          </button>
        )}
        <button
          className="counter-btn w-9 h-9 flex items-center justify-center rounded-xl
                     text-text-secondary hover:text-accent hover:bg-accent/10 active:bg-accent/20
                     text-sm"
          onClick={() => navigate(isSettings ? '/' : '/settings')}
          aria-label={isSettings ? 'Back to tracker' : 'Settings'}
        >
          {isSettings ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}
