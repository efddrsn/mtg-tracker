import { describe, expect, it, vi } from 'vitest';
import { createResilientLookup } from './store-fallback.mjs';
import { validateStoreRequest, createStoreResolver } from './stores.mjs';

const offer = { edition: 'Test', editionId: '1', stock: 2, price: 10 };
const found = { matched: true, listings: [offer], url: 'https://example.com/?view=ecom/item&refid=1' };
describe('store fallback chain', () => {
  it('avoids browser and paid requests when direct offers are complete', async () => {
    const direct = vi.fn().mockResolvedValue(found);
    const browser = vi.fn();
    const result = await createResilientLookup({ direct, browser, useRemote: true })('Card', undefined, 'https://example.com/');
    expect(result.method).toBe('direct'); expect(browser).not.toHaveBeenCalled();
  });
  it('retries HTTP blockers through the browser, then returns verified offers', async () => {
    const browser = vi.fn();
    const direct = vi.fn().mockRejectedValueOnce(new Error('HTTP 403')).mockResolvedValue(found);
    const result = await createResilientLookup({ direct, browser, useRemote: false })('Card');
    expect(result.method).toBe('browser'); expect(direct.mock.calls[1][3]).toBe(browser);
  });
  it('tries Firecrawl after incomplete rendered inventory', async () => {
    const remote = vi.fn();
    const direct = vi.fn().mockResolvedValueOnce({ ...found, listings: [] })
      .mockResolvedValueOnce({ ...found, listings: [{ ...offer, stock: null }] }).mockResolvedValueOnce(found);
    const result = await createResilientLookup({ direct, remote, useRemote: true })('Card');
    expect(result.method).toBe('firecrawl'); expect(direct.mock.calls[2][3]).toBe(remote);
  });
  it('preserves a product URL when all offer methods fail', async () => {
    const direct = vi.fn().mockResolvedValueOnce({ ...found, listings: [] }).mockRejectedValue(new Error('HTTP 403'));
    const result = await createResilientLookup({ direct, useRemote: true })('Card');
    expect(result).toMatchObject({ matched: true, listings: [], error: 'offers_unavailable' });
  });
  it('does not run fallbacks after cancellation', async () => {
    const controller = new AbortController(); controller.abort();
    const direct = vi.fn();
    await expect(createResilientLookup({ direct })('Card', controller.signal)).rejects.toThrow();
    expect(direct).not.toHaveBeenCalled();
  });
});
describe('manual stores', () => {
  it('normalizes custom origins and rejects local URLs and credentials', () => {
    const cards = [{ name: 'Card' }];
    expect(validateStoreRequest({ cards, store: { name: ' Shop ', origin: 'https://shop.com.br/path' } }, 'custom').store)
      .toEqual({ id: 'custom', name: 'Shop', origin: 'https://shop.com.br/' });
    for (const origin of ['http://shop.com.br', 'https://127.0.0.1', 'https://localhost', 'https://user:pass@shop.com.br']) {
      expect(() => validateStoreRequest({ cards, store: { name: 'Shop', origin } }, 'custom')).toThrow();
    }
  });
  it('does not share custom-store cached offers between origins', async () => {
    const lookup = vi.fn().mockResolvedValue(found);
    const resolve = createStoreResolver(lookup);
    await resolve({ id: 'custom', name: 'One', origin: 'https://one.com/' }, [{ name: 'Card' }]);
    await resolve({ id: 'custom', name: 'Two', origin: 'https://two.com/' }, [{ name: 'Card' }]);
    expect(lookup).toHaveBeenCalledTimes(2);
  });
});
