import { useCallback, useEffect, useRef, useState } from 'react';
import { useDeckStore } from './deckStore';
import {
  fetchRecommendations,
  fetchNextPage,
  isBasicLand,
  ScryfallError,
  type DeckCard,
  type FeedPhase,
  type FeedRequest,
} from './scryfall';
import {
  fetchRecommanderRecommendations,
  RecommanderError,
} from './recommanderApi';

const LOW_WATER = 6; // refill when the pool drops to this size
const SEED_LIMIT = 12;
const RECOMMENDER_REFRESH_MS = 500;

// Cards carry a fetch-order sequence so non-Recommander fallbacks retain
// EDHREC order (and re-inserted "undo" cards sort to the front).
type FeedItem = DeckCard & { seq: number };

export interface FeedState {
  queue: FeedItem[];
  loading: boolean;
  error: string | null;
  exhausted: boolean;
  totalCards: number;
}

// Recommander's confidence-corrected score is the primary signal. Its cards
// always precede the EDHREC fallback; `keepHead` prevents a network refresh
// from swapping the card currently under the player's finger.
export function rankPool(items: FeedItem[], keepHead: boolean): FeedItem[] {
  const head = keepHead ? items.slice(0, 1) : [];
  const rest = keepHead ? items.slice(1) : items;
  const ranked = [...rest].sort((a, b) => {
    const basicOrder = Number(isBasicLand(a)) - Number(isBasicLand(b));
    if (basicOrder !== 0) return basicOrder;

    const aScore = a.recommendationScore;
    const bScore = b.recommendationScore;
    if (aScore != null && bScore != null) {
      return bScore - aScore ||
        (a.recommendationRank ?? Number.MAX_SAFE_INTEGER) -
          (b.recommendationRank ?? Number.MAX_SAFE_INTEGER);
    }
    if (aScore != null) return -1;
    if (bScore != null) return 1;
    return a.seq - b.seq;
  });
  return [...head, ...ranked];
}

export function useRecommendationFeed() {
  const config = useDeckStore((s) => s.config);
  const commander = useDeckStore((s) => s.commander);
  const configVersion = useDeckStore((s) => s.configVersion);
  const swipeCount = useDeckStore((s) => s.swipeCount);
  const deck = useDeckStore((s) => s.deck);

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
  const recommanderPrimaryRef = useRef(false);
  const fallbackStartedRef = useRef(false);
  const lastDeckSignatureRef = useRef('');

  const deckSignature = deck
    .map((card) => card.oracleId)
    .sort()
    .join(',');

  const tag = useCallback((cards: DeckCard[], existing: FeedItem[]): FeedItem[] => {
    const snapshot = useDeckStore.getState();
    // Build one lookup per fetched page. Calling `isSeen` for every card used
    // linear array scans and became noticeably expensive after many swipes.
    const existingIds = new Set([
      ...snapshot.rejected,
      ...snapshot.deck.map((c) => c.oracleId),
      ...existing.map((c) => c.oracleId),
    ]);
    const fresh: FeedItem[] = [];
    for (const c of cards) {
      if (!c.image || existingIds.has(c.oracleId)) continue;
      existingIds.add(c.oracleId);
      fresh.push({ ...c, seq: seqRef.current++ });
    }
    return fresh;
  }, []);

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
    fallbackStartedRef.current = false;
    const snapshot = useDeckStore.getState();
    const useRecommander =
      phase === 'build' && snapshot.config.format === 'commander' && snapshot.commander != null;
    recommanderPrimaryRef.current = useRecommander;
    lastDeckSignatureRef.current = snapshot.deck
      .map((card) => card.oracleId)
      .sort()
      .join(',');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ queue: [], loading: true, error: null, exhausted: false, totalCards: 0 });

    const initial = async () => {
      if (useRecommander && snapshot.commander) {
        try {
          const cards = await fetchRecommanderRecommendations(
            {
              commander: snapshot.commander,
              deck: snapshot.deck,
              config: snapshot.config,
            },
            ctrl.signal,
          );
          return { cards, nextPage: null, totalCards: cards.length };
        } catch (error) {
          if (ctrl.signal.aborted) throw error;
          // The model is primary, not a single point of failure. A Scryfall
          // feed remains useful while the API is unavailable.
          recommanderPrimaryRef.current = false;
          fallbackStartedRef.current = true;
        }
      }
      return fetchRecommendations(buildRequest(), ctrl.signal);
    };

    initial()
      .then((page) => {
        if (ctrl.signal.aborted) return;
        nextPageRef.current = page.nextPage;
        const fresh = rankPool(tag(page.cards, []), false);
        setState({
          queue: fresh,
          loading: false,
          error: null,
          exhausted:
            !page.nextPage && !recommanderPrimaryRef.current && fresh.length === 0,
          totalCards: page.totalCards,
        });
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        const msg =
          err instanceof ScryfallError || err instanceof RecommanderError
            ? err.message
            : 'Could not load recommendations. Check your connection.';
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
    const startFallback =
      recommanderPrimaryRef.current &&
      !fallbackStartedRef.current &&
      !nextPageRef.current;
    if (fetchingRef.current || (!nextPageRef.current && !startFallback)) return;
    fetchingRef.current = true;
    const ctrl = abortRef.current ?? new AbortController();
    const pageRequest = startFallback
      ? fetchRecommendations(buildRequest(), ctrl.signal)
      : fetchNextPage(nextPageRef.current!, ctrl.signal);
    if (startFallback) fallbackStartedRef.current = true;
    setState((s) => ({ ...s, loading: true }));

    pageRequest
      .then((page) => {
        if (ctrl.signal.aborted) return;
        nextPageRef.current = page.nextPage;
        setState((s) => {
          const merged = [...s.queue, ...tag(page.cards, s.queue)];
          const queue = rankPool(merged, true);
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
  }, [buildRequest, tag]);

  // Remove the top card after a decision; refill when running low.
  const advance = useCallback((decidedOracleId?: string) => {
    setState((s) => {
      // One decision applies to every queued printing of the same gameplay
      // object. The fetch path already rolls them up, but this also cleans up
      // duplicates from overlapping API responses.
      const queue = s.queue.filter(
        (card, index) =>
          index > 0 && (!decidedOracleId || card.oracleId !== decidedOracleId),
      );
      const canFallback =
        recommanderPrimaryRef.current && !fallbackStartedRef.current;
      return {
        ...s,
        queue,
        exhausted: queue.length === 0 && !nextPageRef.current && !canFallback,
      };
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

  // Every added card changes the API input. Refresh after the swipe animation,
  // pinning the new head so a network response never interrupts interaction.
  // Left swipes do not call the API: the contract has no negative field and
  // `tag` already filters their exact oracle ids.
  useEffect(() => {
    if (
      phase !== 'build' ||
      config.format !== 'commander' ||
      !commander ||
      !recommanderPrimaryRef.current ||
      deckSignature === lastDeckSignatureRef.current
    ) {
      return;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      const snapshot = useDeckStore.getState();
      if (!snapshot.commander) return;
      lastDeckSignatureRef.current = snapshot.deck
        .map((card) => card.oracleId)
        .sort()
        .join(',');
      try {
        const cards = await fetchRecommanderRecommendations(
          {
            commander: snapshot.commander,
            deck: snapshot.deck,
            config: snapshot.config,
          },
          ctrl.signal,
        );
        if (ctrl.signal.aborted || cards.length === 0) return;
        setState((s) => {
          const head = s.queue.slice(0, 1);
          const fresh = tag(cards, head);
          return {
            ...s,
            queue: rankPool([...head, ...fresh], head.length > 0),
            totalCards: cards.length,
            exhausted: false,
            error: null,
          };
        });
      } catch {
        // Keep the current ranked queue. The low-water Scryfall fallback still
        // guarantees that a transient model failure cannot strand the player.
      }
    }, RECOMMENDER_REFRESH_MS);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [commander, config.format, deckSignature, phase, tag]);

  // Top up the queue proactively when it gets short.
  useEffect(() => {
    const canStartFallback =
      recommanderPrimaryRef.current && !fallbackStartedRef.current;
    if (
      state.queue.length <= LOW_WATER &&
      (nextPageRef.current || canStartFallback) &&
      !fetchingRef.current
    ) {
      loadMore();
    }
  }, [state.queue.length, loadMore]);

  return { ...state, phase, advance, loadMore, pushFront };
}
