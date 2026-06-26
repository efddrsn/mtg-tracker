import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeckStore, SEED_LIMIT } from './deckStore';
import {
  fetchRecommendations,
  fetchNextPage,
  ScryfallError,
  type DeckCard,
  type FeedPhase,
  type FeedRequest,
} from './scryfall';
import { hasSignal, scoreCard, type Prefs } from './recommender';

const LOW_WATER = 6; // refill when the pool drops to this size

// Cards carry a fetch-order sequence so re-ranking can fall back to EDHREC
// popularity for ties (and so re-inserted "undo" cards sort to the front).
type FeedItem = DeckCard & { seq: number };

export interface FeedState {
  queue: FeedItem[];
  loading: boolean;
  error: string | null;
  exhausted: boolean;
  totalCards: number;
}

// Sort by learned preference (when there's any signal), EDHREC order otherwise.
// `keepHead` pins the current top card so it never swaps out from under a drag.
function rankPool(items: FeedItem[], prefs: Prefs, keepHead: boolean): FeedItem[] {
  if (!hasSignal(prefs)) {
    return [...items].sort((a, b) => a.seq - b.seq);
  }
  const head = keepHead ? items.slice(0, 1) : [];
  const rest = keepHead ? items.slice(1) : items;
  const scored = rest
    .map((card) => ({ card, score: scoreCard(card, prefs) }))
    .sort((a, b) => b.score - a.score || a.card.seq - b.card.seq)
    .map((x) => x.card);
  return [...head, ...scored];
}

export function useRecommendationFeed() {
  const config = useDeckStore((s) => s.config);
  const commander = useDeckStore((s) => s.commander);
  const configVersion = useDeckStore((s) => s.configVersion);
  const prefsVersion = useDeckStore((s) => s.prefsVersion);
  const swipeCount = useDeckStore((s) => s.swipeCount);
  const prefs = useDeckStore((s) => s.prefs);
  const isSeen = useDeckStore((s) => s.isSeen);

  const phase: FeedPhase =
    config.format === 'commander' && !commander ? 'commander-select' : 'build';
  const seed = config.format !== 'commander' && swipeCount < SEED_LIMIT;
  // A change to either forces a refetch; everything else re-ranks in place.
  const feedKey = `${configVersion}:${phase}:${seed ? 'seed' : 'broad'}`;

  const [state, setState] = useState<FeedState>({
    queue: [],
    loading: true,
    error: null,
    exhausted: false,
    totalCards: 0,
  });

  const nextPageRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  }, [prefs]);

  const tag = useCallback((cards: DeckCard[], existing: FeedItem[]): FeedItem[] => {
    const existingIds = new Set(existing.map((c) => c.oracleId));
    const fresh: FeedItem[] = [];
    for (const c of cards) {
      if (!c.image || isSeen(c.oracleId) || existingIds.has(c.oracleId)) continue;
      existingIds.add(c.oracleId);
      fresh.push({ ...c, seq: seqRef.current++ });
    }
    return fresh;
  }, [isSeen]);

  const buildRequest = useCallback(
    (): FeedRequest => ({
      config: useDeckStore.getState().config,
      commanderIdentity: useDeckStore.getState().commander?.colorIdentity ?? null,
      phase,
      seed,
    }),
    [phase, seed],
  );

  // Reset and load the first page whenever the feed key changes.
  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    fetchingRef.current = true;
    nextPageRef.current = null;
    seqRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ queue: [], loading: true, error: null, exhausted: false, totalCards: 0 });

    fetchRecommendations(buildRequest(), ctrl.signal)
      .then((page) => {
        if (ctrl.signal.aborted) return;
        nextPageRef.current = page.nextPage;
        const fresh = rankPool(tag(page.cards, []), prefsRef.current, false);
        setState({
          queue: fresh,
          loading: false,
          error: null,
          exhausted: !page.nextPage && fresh.length === 0,
          totalCards: page.totalCards,
        });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        const msg =
          err instanceof ScryfallError
            ? err.message
            : 'Could not reach Scryfall. Check your connection.';
        setState((s) => ({ ...s, loading: false, error: msg }));
      })
      .finally(() => {
        fetchingRef.current = false;
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedKey]);

  // Load the next page and append any unseen cards (re-ranked into the tail).
  const loadMore = useCallback(() => {
    if (fetchingRef.current || !nextPageRef.current) return;
    fetchingRef.current = true;
    const ctrl = abortRef.current ?? new AbortController();
    setState((s) => ({ ...s, loading: true }));

    fetchNextPage(nextPageRef.current, ctrl.signal)
      .then((page) => {
        if (ctrl.signal.aborted) return;
        nextPageRef.current = page.nextPage;
        setState((s) => {
          const merged = [...s.queue, ...tag(page.cards, s.queue)];
          const queue = rankPool(merged, prefsRef.current, true);
          return {
            ...s,
            queue,
            loading: false,
            exhausted: !page.nextPage && queue.length === 0,
          };
        });
      })
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setState((s) => ({ ...s, loading: false }));
      })
      .finally(() => {
        fetchingRef.current = false;
      });
  }, [tag]);

  // Remove the top card after a decision; refill when running low.
  const advance = useCallback(() => {
    setState((s) => {
      const queue = s.queue.slice(1);
      return { ...s, queue, exhausted: queue.length === 0 && !nextPageRef.current };
    });
  }, []);

  // Re-insert a card at the front of the queue (used by undo).
  const pushFront = useCallback((card: DeckCard) => {
    setState((s) => ({
      ...s,
      queue: [
        { ...card, seq: -1 },
        ...s.queue.filter((c) => c.oracleId !== card.oracleId),
      ],
      exhausted: false,
    }));
  }, []);

  // Re-rank the upcoming cards whenever preferences change (no refetch). The
  // current top card stays put so an in-progress swipe isn't disrupted.
  useEffect(() => {
    setState((s) => {
      if (s.queue.length < 2) return s;
      return { ...s, queue: rankPool(s.queue, prefsRef.current, true) };
    });
  }, [prefsVersion]);

  // Top up the queue proactively when it gets short.
  useEffect(() => {
    if (state.queue.length <= LOW_WATER && nextPageRef.current && !fetchingRef.current) {
      loadMore();
    }
  }, [state.queue.length, loadMore]);

  return { ...state, phase, advance, loadMore, pushFront };
}
