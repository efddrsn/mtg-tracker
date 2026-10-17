import { describe, it, expect, vi } from 'vitest';
import fixtures from './fixtures/tinyfish-stores.json' with { type: 'json' };
import { createTinyfishLookup, parseTinyfishProduct, parseSemanticListings } from './store-tinyfish.mjs';
import { createResilientLookup } from './store-fallback.mjs';

describe('TinyFish live storefront fixtures', () => {
  it.each(fixtures)('extracts prices and stock from $title', (page) => {
    const result = parseTinyfishProduct(page, 'Arcane Signet', new URL(page.url).origin);
    expect(result.matched).toBe(true);
    expect(result.listings.length).toBeGreaterThan(5);
    expect(result.listings.every((offer) => Number.isSafeInteger(offer.stock) && offer.price > 0)).toBe(true);
    expect(result.listings[0]).toMatchObject(page.url.includes('cardtutor')
      ? { stock: 12, price: 8.5, edition: 'Teenage Mutant Ninja Turtles Commander' }
      : page.url.includes('moxvault') ? { stock: 5, price: 142, extras: 'Foil' }
        : { stock: 1, price: 59.9, edition: 'Commander Legends (Variantes)' });
  });
  it('keeps zero stock distinct from missing inventory', () => {
    const html = '<p>Edição</p><p>Set</p><p>Idioma</p><p>Inglês</p><p>Qualidade</p>NM<p>Extras</p>-<p>Estoque</p>0 unid.<p>Preço</p>R$ 1.234,56';
    expect(parseSemanticListings(html)[0]).toMatchObject({ stock: 0, price: 1234.56 });
    expect(parseSemanticListings(html.replace('0 unid.', 'Desconhecido'))).toEqual([]);
  });
  it('rejects wrong card, art variants, unrelated hosts and search pages', () => {
    const page = fixtures[0];
    for (const change of [{ title: 'Sol Ring' }, { title: 'Arcane Signet (Art Card)' },
      { final_url: 'https://evil.example/?view=ecom/item&refid=abc' },
      { final_url: page.url }, { text: '<p>Verify you are human</p>' }]) {
      expect(() => parseTinyfishProduct({ ...page, ...change }, 'Arcane Signet', new URL(page.url).origin)).toThrow();
    }
  });
  it('uses fresh structured fetch and validates input and redirect before parsing', async () => {
    const page = fixtures[0];
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [page], errors: [] }) });
    const validate = vi.fn();
    const result = await createTinyfishLookup({ request, validate, apiKey: 'test-only' })('Arcane Signet', undefined, 'https://www.cardtutor.com.br/');
    expect(result.method).toBe('tinyfish');
    expect(validate.mock.calls.map(([url]) => url)).toEqual([page.url, page.final_url]);
    const [endpoint, options] = request.mock.calls[0];
    expect(endpoint).toBe('https://api.fetch.tinyfish.ai');
    expect(JSON.parse(options.body)).toMatchObject({ format: 'html', ttl: 0, urls: [page.url] });
  });
  it('reports provider authentication separately and never exposes the credential', async () => {
    const lookup = createTinyfishLookup({ apiKey: 'test-only', validate: vi.fn(), request: vi.fn().mockResolvedValue({ ok: false, status: 401 }) });
    await expect(lookup('Card', undefined, 'https://shop.com/')).rejects.toMatchObject({ message: 'TinyFish HTTP 401', code: 'provider_auth' });
  });
  it('uses TinyFish before repeating a browser request from the same server', async () => {
    const direct = vi.fn().mockRejectedValue(new Error('HTTP 403'));
    const tinyfish = vi.fn().mockResolvedValue(parseTinyfishProduct(fixtures[0], 'Arcane Signet', 'https://www.cardtutor.com.br/'));
    const result = await createResilientLookup({ direct, tinyfish, useTinyfish: true, useTls: false, useRemote: false })('Arcane Signet');
    expect(result.method).toBe('tinyfish');
    expect(direct).toHaveBeenCalledTimes(1);
  });
});
