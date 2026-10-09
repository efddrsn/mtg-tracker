import stores from '../shared/stores.json' with { type: 'json' };
import { cardTutorSearchUrl, resolveCardTutorCard } from './cardtutor.mjs';

export function validateStoreRequest(body, storeId) {
  const store = stores.find((entry) => entry.id === storeId);
  if (!store) throw new Error('Loja inválida.');
  if (!Array.isArray(body?.cards) || body.cards.length < 1 || body.cards.length > 500) {
    throw new Error('Envie entre 1 e 500 cartas por consulta.');
  }
  const cards = body.cards.map((card) => {
    if (typeof card?.name !== 'string' || !card.name.trim() || card.name.length > 180) {
      throw new Error('Cada carta precisa de um nome válido.');
    }
    return {
      oracleId: String(card.oracleId ?? card.name), name: card.name.trim(),
      setCode: String(card.setCode ?? '').slice(0, 20),
      collectorNumber: String(card.collectorNumber ?? '').slice(0, 30),
    };
  });
  return { store, cards };
}

export function createStoreResolver(lookup = resolveCardTutorCard, timeoutMs = 12_000) {
  const cache = new Map();
  const unavailableUntil = new Map();
  return async function resolve(store, cards) {
    const signal = AbortSignal.timeout(timeoutMs);
    let next = 0;
    const output = new Array(cards.length);
    const fallback = (card, error) => ({ ...card, storeId: store.id, storeName: store.name,
      url: cardTutorSearchUrl(card.name, store.origin), matched: false,
      listings: [], status: 'unverified', error });
    await Promise.all(Array.from({ length: Math.min(3, cards.length) }, async () => {
      while (next < cards.length) {
        const index = next++;
        const card = cards[index];
        const key = `${store.id}|${card.name.toLowerCase()}`;
        const cached = cache.get(key);
        if (cached && cached.expires > Date.now()) {
          output[index] = { ...card, ...cached.result };
          continue;
        }
        if (signal.aborted) { output[index] = fallback(card, 'timeout'); continue; }
        if ((unavailableUntil.get(store.id) ?? 0) > Date.now()) {
          output[index] = fallback(card, 'store_unavailable'); continue;
        }
        try {
          const result = await lookup(card.name, signal, store.origin);
          const payload = { ...result, storeId: store.id, storeName: store.name,
            status: !result.error && result.listings.length > 0 && result.listings.every((offer) => offer.stock != null) ? 'checked' : 'unverified',
            checkedAt: new Date().toISOString() };
          if (cache.size >= 2000) cache.delete(cache.keys().next().value);
          cache.set(key, { result: payload, expires: Date.now() + (payload.status === 'checked' ? 300_000 : 30_000) });
          output[index] = { ...card, ...payload };
        } catch (error) {
          unavailableUntil.set(store.id, Date.now() + 30_000);
          output[index] = fallback(card, signal.aborted ? 'timeout' : 'store_unavailable');
          // Diagnostic code only; never log user card lists or credentials.
          console.warn('Store lookup failed', store.id, error?.cause?.code ?? error?.name ?? 'Error');
        }
      }
    }));
    return output;
  };
}
