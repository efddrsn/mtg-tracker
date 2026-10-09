import type { SavedCard } from '../deck/deckStore';
import stores from '../../shared/stores.json';
export const STORES = stores;
export type StoreId = 'cardtutor' | 'moxvault' | 'epicone';

export interface CardTutorListing {
  editionId: string;
  edition: string;
  language: string;
  quality: string;
  extras: string;
  stock: number | null;
  price: number | null;
}

export interface CardTutorResult {
  oracleId: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  url: string;
  matched: boolean;
  listings: CardTutorListing[];
  error?: string;
  storeId?: string;
  storeName?: string;
  status?: 'checked' | 'unverified';
  checkedAt?: string;
}

export function availableListings(result: CardTutorResult) {
  return result.listings.filter((listing) => (listing.stock ?? 0) > 0);
}

export function lowestAvailablePrice(result: CardTutorResult) {
  const prices = availableListings(result)
    .map((listing) => listing.price)
    .filter((price): price is number => typeof price === 'number');
  return prices.length > 0 ? Math.min(...prices) : null;
}

function csvCell(value: unknown) {
  const raw = String(value ?? '');
  const text = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function cardTutorCsv(results: CardTutorResult[]) {
  const rows: unknown[][] = [[
    'quantity', 'name', 'requested_set', 'requested_collector_number', 'store_url',
    'available', 'lowest_price_brl', 'offer_edition', 'language', 'quality', 'extras', 'stock', 'store', 'status', 'checked_at', 'printing_matched',
  ]];
  for (const result of results) {
    const offers = availableListings(result);
    const lowest = lowestAvailablePrice(result);
    const selected = offers.find((offer) => offer.price === lowest) ?? offers[0];
    rows.push([
      1,
      result.name,
      result.setCode.toUpperCase(),
      result.collectorNumber,
      result.url,
      offers.length > 0 ? 'yes' : result.status === 'checked' ? 'no' : 'unknown',
      lowest?.toFixed(2) ?? '',
      selected?.edition ?? '',
      selected?.language ?? '',
      selected?.quality ?? '',
      selected?.extras ?? '',
      selected?.stock ?? (result.status === 'checked' ? 0 : ''),
      result.storeName ?? 'CardTutor', result.status ?? 'unverified', result.checkedAt ?? '', 'not_verified',
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function initialStoreResults(cards: SavedCard[], storeId: StoreId): CardTutorResult[] {
  const store = STORES.find((entry) => entry.id === storeId)!;
  return cards.map((card) => {
    const url = new URL(store.origin);
    url.searchParams.set('view', 'ecom/itens');
    url.searchParams.set('searchExactMatch', '1');
    url.searchParams.set('busca', card.name.split(' // ')[0].trim());
    url.searchParams.set('btnEnviar', '1');
    return { oracleId: card.oracleId, name: card.name, setCode: card.setCode ?? '',
      collectorNumber: card.collectorNumber ?? '', url: url.toString(),
      storeId, storeName: store.name, matched: false, listings: [], status: 'unverified' };
  });
}

export async function fetchCardTutorResults(
  cards: SavedCard[], signal?: AbortSignal, storeId: StoreId = 'cardtutor',
  onProgress?: (results: CardTutorResult[]) => void,
) {
  const output = initialStoreResults(cards, storeId);
  // Small requests avoid both the old 60-card rejection and proxy timeouts.
  // Preserve one output row per input, even when a whole batch fails.
  for (let offset = 0; offset < cards.length; offset += 3) {
    signal?.throwIfAborted();
    const batch = cards.slice(offset, offset + 3);
    try {
      const timeout = AbortSignal.timeout(18_000);
      const response = await fetch(`/api/stores/${storeId}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: batch.map((card) => ({
          oracleId: card.oracleId, name: card.name,
          setCode: card.setCode, collectorNumber: card.collectorNumber,
        })) }),
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (!Array.isArray(body.cards)) throw new Error('Resposta inválida');
      batch.forEach((card, index) => {
        const result = body.cards.find((entry: CardTutorResult) => entry.oracleId === card.oracleId);
        if (!result || !Array.isArray(result.listings)) throw new Error('Resposta incompleta');
        output[offset + index] = { ...output[offset + index], ...result };
      });
    } catch {
      signal?.throwIfAborted();
      batch.forEach((_, index) => { output[offset + index] = { ...output[offset + index], error: 'store_unavailable' }; });
    }
    onProgress?.([...output]);
  }
  return output;
}
