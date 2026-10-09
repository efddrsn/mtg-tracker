import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SavedCard } from '../deck/deckStore';
import { cardTutorCsv, fetchCardTutorResults, initialStoreResults, STORES } from './cardtutor';

const cards = Array.from({length: 100}, (_, i) => ({ oracleId: String(i), name: `Card ${i}` } as SavedCard));
afterEach(() => vi.unstubAllGlobals());
describe('resilient store exports', () => {
  it('generates links for 100 cards in every store without a network call', () => {
    for (const store of STORES) {
      const result = initialStoreResults(cards, store.id as 'cardtutor');
      expect(result).toHaveLength(100);
      expect(new URL(result[0].url).origin).toBe(new URL(store.origin).origin);
      expect(cardTutorCsv(result)).toContain(',unknown,');
      expect(cardTutorCsv(result).split('\r\n')).toHaveLength(101);
    }
  });
  it('uses batches of at most 3 and continues after failed or malformed responses', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(new Response('<html>oops</html>'))
      .mockImplementation(async (_url, init) => {
        const { cards: batch } = JSON.parse(init.body);
        expect(batch.length).toBeLessThanOrEqual(3);
        return new Response(JSON.stringify({ cards: batch.map((card: SavedCard) => ({ ...card, listings: [], status: 'unverified' })) }));
      });
    vi.stubGlobal('fetch', fetchMock);
    const progress = vi.fn();
    const result = await fetchCardTutorResults(cards, undefined, 'moxvault', progress);
    expect(fetchMock).toHaveBeenCalledTimes(34);
    expect(progress).toHaveBeenCalledTimes(34);
    expect(result).toHaveLength(100);
    expect(result[0].error).toBe('store_unavailable');
    expect(result[99].oracleId).toBe('99');
  });
  it('cancellation stops further requests', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(fetchCardTutorResults(cards, controller.signal)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('escapes spreadsheet formulas and distinguishes requested printing from offer', () => {
    const result = initialStoreResults([{ ...cards[0], name: '=1+1' }], 'epicone');
    const csv = cardTutorCsv(result);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain('requested_set');
    expect(csv).toContain('not_verified');
  });
});
