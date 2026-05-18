import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Header } from './components/Header';
import { Tracker } from './pages/Tracker';
import { Settings } from './pages/Settings';
import { useStore } from './store';

function App() {
  const keepAwake = useStore((s) => s.settings.keepAwake);

  // Wake Lock — keep screen on during a game when the user opts in.
  useEffect(() => {
    if (!keepAwake) return;
    type WakeLockSentinel = { release: () => Promise<void> };
    type WakeLockAPI = { request: (kind: 'screen') => Promise<WakeLockSentinel> };
    const nav = navigator as Navigator & { wakeLock?: WakeLockAPI };
    if (!nav.wakeLock?.request) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const s = await nav.wakeLock!.request('screen');
        if (cancelled) {
          s.release().catch(() => { /* noop */ });
          return;
        }
        sentinel = s;
      } catch { /* noop */ }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') acquire();
    };

    acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => { /* noop */ });
    };
  }, [keepAwake]);

  return (
    <BrowserRouter>
      <div className="app-shell flex flex-col h-full">
        <Header />
        <Routes>
          <Route path="/" element={<Tracker />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
