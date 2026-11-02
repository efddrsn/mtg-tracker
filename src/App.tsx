import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Tracker } from "./pages/Tracker";
import { Settings } from "./pages/Settings";
import { SwipeDeck } from "./pages/SwipeDeck";
import {
  EventHub,
  EventAdmin,
  Community,
  SharedList,
  PrintBinder,
  Feedback,
} from "./pages/EventHub";
import { MyDecks, DeckEditor } from "./pages/HubDecks";
import { Account } from "./pages/HubAccount";
import { useAccount } from "./deck/hubApi";
import { useHubStore } from "./deck/hubStore";
import { useParams } from "react-router-dom";
import { AuroraLayer } from "./components/AuroraLayer";
import { useStore, DEFAULT_BG, DEFAULT_BG_BRIGHTNESS } from "./store";

function BackgroundLayer() {
  const bg = useStore((s) => s.settings.backgroundColor) || DEFAULT_BG;
  if (bg.startsWith("aurora:")) {
    return <AuroraLayer variant={bg.slice("aurora:".length)} />;
  }
  const isGradient = /gradient\s*\(/i.test(bg);
  return (
    <div
      className={`app-bg-layer ${isGradient ? "bg-animated" : ""}`}
      style={{
        background: bg,
        backgroundSize: isGradient ? "300% 300%" : undefined,
      }}
      aria-hidden
    />
  );
}

function ShareRoute() {
  const { id } = useParams();
  return <SharedList key={id} />;
}
function DeckRoute() {
  const { id } = useParams();
  return <DeckEditor key={id} />;
}
function WorkspaceSync() {
  useEffect(() => {
    void useAccount.getState().refresh();
    let timer: ReturnType<typeof setTimeout>;
    let previous = JSON.stringify(useHubStore.getState().decks);
    const unsubscribe = useHubStore.subscribe((s) => {
      const value = JSON.stringify(s.decks);
      if (value === previous) return;
      previous = value;
      const account = useAccount.getState();
      if (!account.user || !account.ready) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        void useAccount.getState().sync();
      }, 1500);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);
  return null;
}
function App() {
  const keepAwake = useStore((s) => s.settings.keepAwake);
  const bgBrightness = useStore(
    (s) => s.settings.bgBrightness ?? DEFAULT_BG_BRIGHTNESS,
  );

  useEffect(() => {
    const dim = Math.max(0, Math.min(1, 1 - bgBrightness));
    document.body.style.setProperty("--bg-dim", String(dim));
    return () => {
      document.body.style.removeProperty("--bg-dim");
    };
  }, [bgBrightness]);

  useEffect(() => {
    if (!keepAwake) return;
    type WakeLockSentinel = { release: () => Promise<void> };
    type WakeLockAPI = {
      request: (kind: "screen") => Promise<WakeLockSentinel>;
    };
    const nav = navigator as Navigator & { wakeLock?: WakeLockAPI };
    if (!nav.wakeLock?.request) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const s = await nav.wakeLock!.request("screen");
        if (cancelled) {
          s.release().catch(() => {
            /* noop */
          });
          return;
        }
        sentinel = s;
      } catch {
        /* noop */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinel?.release().catch(() => {
        /* noop */
      });
    };
  }, [keepAwake]);

  return (
    <BrowserRouter>
      <WorkspaceSync />
      <BackgroundLayer />
      <div className="app-bg-dim" aria-hidden />
      <div className="app-shell flex flex-col h-full">
        <Routes>
          <Route path="/" element={<EventHub />} />
          <Route path="/decks" element={<MyDecks />} />
          <Route path="/decks/:id" element={<DeckRoute />} />
          <Route path="/account" element={<Account />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="*" element={<EventHub />} />
          <Route path="/tracker" element={<Tracker />} />
          <Route path="/community" element={<Community />} />
          <Route path="/share/:id" element={<ShareRoute />} />
          <Route path="/print" element={<PrintBinder />} />
          <Route path="/admin" element={<EventAdmin />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/swipe" element={<SwipeDeck />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
