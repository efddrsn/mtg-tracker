import type { SavedCard } from '../deck/deckStore';

export interface CardTutorListing {
  editionId: string;
  edition: string;
  language: string;
  quality: string;
  extras: string;
  stock: number;
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
}

export function availableListings(result: CardTutorResult) {
  return result.listings.filter((listing) => listing.stock > 0);
}

export function lowestAvailablePrice(result: CardTutorResult) {
  const prices = availableListings(result)
    .map((listing) => listing.price)
    .filter((price): price is number => typeof price === 'number');
  return prices.length > 0 ? Math.min(...prices) : null;
}

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function cardTutorCsv(results: CardTutorResult[]) {
  const rows: unknown[][] = [[
    'quantity', 'name', 'set', 'collector_number', 'cardtutor_url',
    'available', 'lowest_price_brl', 'edition', 'language', 'quality', 'extras', 'stock',
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
      offers.length > 0 ? 'yes' : 'no',
      lowest?.toFixed(2) ?? '',
      selected?.edition ?? '',
      selected?.language ?? '',
      selected?.quality ?? '',
      selected?.extras ?? '',
      selected?.stock ?? 0,
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export async function fetchCardTutorResults(cards: SavedCard[], signal?: AbortSignal) {
  const response = await fetch('/api/stores/cardtutor/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cards: cards.map((card) => ({
        oracleId: card.oracleId,
        name: card.name,
        setCode: card.setCode,
        collectorNumber: card.collectorNumber,
      })),
    }),
    signal,
  });
  if (!response.ok) throw new Error('Não foi possível consultar o CardTutor.');
  return (await response.json()).cards as CardTutorResult[];
}
