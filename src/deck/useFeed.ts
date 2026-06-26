import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeckStore } from './deckStore';
import {
  fetchRecommendations,
  fetchNextPage,
  ScryfallError,
  type DeckCard,
} from './scryfall';

const LOW_WATER = 5; // refill when queue drops to this size

export interface FeedState {
  queue: DeckCard[];
  loading: boolean;
  error: string | null;
  exhausted: boolean;
  totalCards: number;
}

export function useRecommendationFeed() {
  const config = useDeckStore((s) => s.config);
  const configVersion = useDeckStore((s) => s.configVersion);
  const isSeen = useDeckStore((s) => s.isSeen);

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

  const filterNew = useCallback(
    (cards: DeckCard[], existing: DeckCard[]) => {
      const existingIds = new Set(existing.map((c) => c.oracleId));
      return cards.filter(
        (c) => c.image && !isSeen(c.oracleId) && !existingIds.has(c.oracleId),
      );
    },
    [isSeen],
  );

  // Reset and load the first page whenever the config changes.
  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    fetchingRef.current = true;
    nextPageRef.current = null;
    // Intentional synchronous reset: a config change must immediately clear the
    // stale feed and show the loading state before the new fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ queue: [], loading: true, error: null, exhausted: false, totalCards: 0 });

    fetchRecommendations(config, ctrl.signal)
      .then((page) => {
        if (ctrl.signal.aborted) return;
        nextPageRef.current = page.nextPage;
        const fresh = filterNew(page.cards, []);
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
  }, [configVersion]);

  // Load the next page and append any unseen cards.
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
          const fresh = filterNew(page.cards, s.queue);
          const queue = [...s.queue, ...fresh];
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
  }, [filterNew]);

  // Remove the top card after a decision; refill when running low.
  const advance = useCallback(() => {
    setState((s) => {
      const queue = s.queue.slice(1);
      const exhausted = queue.length === 0 && !nextPageRef.current;
      return { ...s, queue, exhausted };
    });
  }, []);

  // Re-insert a card at the front of the queue (used by undo).
  const pushFront = useCallback((card: DeckCard) => {
    setState((s) => ({
      ...s,
      queue: [card, ...s.queue.filter((c) => c.oracleId !== card.oracleId)],
      exhausted: false,
    }));
  }, []);

  // Top up the queue proactively when it gets short.
  useEffect(() => {
    if (state.queue.length <= LOW_WATER && nextPageRef.current && !fetchingRef.current) {
      loadMore();
    }
  }, [state.queue.length, loadMore]);

  return { ...state, advance, loadMore, pushFront };
}
