import { describe, expect, it, vi } from 'vitest';
import { createStoreResolver, validateStoreRequest } from './stores.mjs';
import { parseCardTutorSearch } from './cardtutor.mjs';

describe('multi-store resolution', () => {
  it('accepts a Commander-sized list, including legacy requests', () => {
    const cards = Array.from({ length: 100 }, (_, i) => ({ name: `Card ${i}` }));
    expect(validateStoreRequest({ cards }, 'cardtutor').cards).toHaveLength(100);
  });
  it('rejects null bodies, unknown stores and malformed cards safely', () => {
    for (const body of [null, {}, { cards: [null] }, { cards: [{ name: '' }] }]) {
      expect(() => validateStoreRequest(body, 'cardtutor')).toThrow();
    }
    expect(() => validateStoreRequest({ cards: [{ name: 'Sol Ring' }] }, 'evil')).toThrow();
  });
  it('resolves product refids against the selected store only', () => {
    const html = '<div class="title"><a href="/?view=ecom/item&refid=abc">Sol Ring</a></div>';
    expect(parseCardTutorSearch(html, 'Sol Ring', 'https://www.moxvault.com.br/').url)
      .toBe('https://www.moxvault.com.br/?view=ecom/item&refid=abc');
  });
  it('isolates store caches and preserves unknown inventory on failure', async () => {
    const lookup = vi.fn().mockRejectedValue(new Error('offline'));
    const resolve = createStoreResolver(lookup);
    const { store, cards } = validateStoreRequest({ cards: [{ name: 'Sol Ring' }] }, 'epicone');
    const result = await resolve(store, cards);
    expect(result[0]).toMatchObject({ status: 'unverified', matched: false, storeId: 'epicone' });
    expect(new URL(result[0].url).hostname).toBe('www.epicgame.com.br');
    expect(result).toHaveLength(1);
  });
  it('reports a store HTTP 403 as blocked, preserving a working search URL', async () => {
    const lookup = vi.fn().mockRejectedValue(new Error('CardTutor search HTTP 403'));
    const { store, cards } = validateStoreRequest({ cards: [{ name: 'Sol Ring' }] }, 'cardtutor');
    const [result] = await createStoreResolver(lookup)(store, cards);
    expect(result.status).toBe('unverified');
    expect(result.error).toBe('blocked');
    expect(result.url).toContain('searchExactMatch=1');
  });

  it('bounds legacy large requests to one deadline and at most 3 concurrent calls', async () => {
    let active = 0;
    let maximum = 0;
    const lookup = vi.fn(async (_name, signal) => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise((_, reject) => signal.addEventListener('abort', () => { active--; reject(signal.reason); }, { once: true }));
    });
    const { store, cards } = validateStoreRequest({ cards: Array.from({length:100}, (_, i) => ({ name: `Card ${i}` })) }, 'cardtutor');
    const result = await createStoreResolver(lookup, 20)(store, cards);
    expect(result).toHaveLength(100);
    expect(maximum).toBe(3);
    expect(lookup).toHaveBeenCalledTimes(3);
    expect(result.every((row) => row.status === 'unverified')).toBe(true);
  });
});
