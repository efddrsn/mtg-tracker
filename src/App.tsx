import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Tracker } from './pages/Tracker';
import { Settings } from './pages/Settings';
import { useStore, DEFAULT_BG, DEFAULT_BG_BRIGHTNESS } from './store';

function App() {
  const keepAwake = useStore((s) => s.settings.keepAwake);
  const backgroundColor = useStore((s) => s.settings.backgroundColor);
  const bgBrightness = useStore((s) => s.settings.bgBrightness ?? DEFAULT_BG_BRIGHTNESS);

  useEffect(() => {
    const value = backgroundColor || DEFAULT_BG;
    const isGradient = /gradient\s*\(/i.test(value);
    document.body.style.background = value;
    if (isGradient) {
      document.body.style.backgroundSize = '300% 300%';
      document.body.classList.add('bg-animated');
    } else {
      document.body.style.backgroundSize = '';
      document.body.classList.remove('bg-animated');
    }
    return () => {
      document.body.style.background = '';
      document.body.style.backgroundSize = '';
      document.body.classList.remove('bg-animated');
    };
  }, [backgroundColor]);

  useEffect(() => {
    const dim = Math.max(0, Math.min(1, 1 - bgBrightness));
    document.body.style.setProperty('--bg-dim', String(dim));
    return () => { document.body.style.removeProperty('--bg-dim'); };
  }, [bgBrightness]);

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
        <Routes>
          <Route path="/" element={<Tracker />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
