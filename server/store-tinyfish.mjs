import { cardTutorSearchUrl, decodeHtml } from './cardtutor.mjs';
import { publicStoreUrl } from './store-network.mjs';

function normalized(value) {
  return decodeHtml(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// TinyFish returns semantic HTML, not the storefront's original CSS classes.
// Parse labeled rows deterministically, preserving each price with its own stock.
export function parseSemanticListings(html) {
  const lines = decodeHtml(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/?(?:br|p|div|section|li|tr|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')).split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const rows = `\n${lines.join('\n')}`.split(/\nEdição\n/).slice(1);
  return rows.flatMap((row, index) => {
    const match = /^([\s\S]+?)\nIdioma\n([\s\S]*?)\nQualidade\n([\s\S]*?)\nExtras\n([\s\S]*?)\nEstoque\n([\d.,]+)\s*unid\.?\nPreço\nR\$\s*([\d.,]+)/.exec(row);
    if (!match) return [];
    const price = Number(match[6].replace(/\./g, '').replace(',', '.'));
    const stock = Number(match[5].replace(/[.,]/g, ''));
    if (!Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(stock) || stock < 0) return [];
    return [{ editionId: `semantic-${index}`, edition: match[1].trim(), language: match[2].trim(),
      quality: match[3].split('\n')[0].trim(), extras: match[4].trim() === '-' ? '' : match[4].trim(), stock, price }];
  });
}

export function parseTinyfishProduct(page, name, origin) {
  const final = new URL(page.final_url ?? page.url);
  const host = new URL(origin).hostname.replace(/^www\./, '');
  const finalHost = final.hostname.replace(/^www\./, '');
  const sameStore = host === finalHost || (host === 'epicgame.com.br' && finalHost === 'epicone.com.br');
  const wanted = normalized(name.split(' // ')[0]);
  const title = normalized((page.title ?? '').split('|')[0]);
  const nameMatched = title === wanted || title.split(' / ').some((part) => part.trim() === wanted);
  if (!sameStore || final.protocol !== 'https:' || final.port || final.searchParams.get('view') !== 'ecom/item'
    || !final.searchParams.get('refid') || !nameMatched) {
    throw new Error('TinyFish product identity not confirmed');
  }
  const listings = parseSemanticListings(page.text ?? '');
  if (!listings.length) throw new Error('TinyFish returned no parseable inventory');
  return { name, url: final.href, matched: true, listings, method: 'tinyfish' };
}

export function createTinyfishLookup({ request = fetch, validate = publicStoreUrl,
  apiKey = process.env.TINYFISH_API_KEY } = {}) {
  return async (name, signal, origin = 'https://www.cardtutor.com.br/') => {
    if (!apiKey) throw Object.assign(new Error('TinyFish API key is not configured'), { code: 'provider_not_configured' });
    const url = cardTutorSearchUrl(name, origin);
    await validate(url);
    const response = await request('https://api.fetch.tinyfish.ai', {
      method: 'POST', signal,
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url], format: 'html', links: true, page_metadata: true,
        image_links: false, iframe_links: false, ttl: 0, per_url_timeout_ms: 30_000 }),
    });
    if (!response.ok) throw Object.assign(new Error(`TinyFish HTTP ${response.status}`), {
      code: [401, 403].includes(response.status) ? 'provider_auth' : 'provider_unavailable',
    });
    const body = await response.json();
    const page = body.results?.find((entry) => entry.url === url);
    if (!page) throw new Error(`TinyFish fetch failed: ${body.errors?.[0]?.code ?? 'empty_response'}`);
    await validate(page.final_url ?? page.url);
    return parseTinyfishProduct(page, name, origin);
  };
}
