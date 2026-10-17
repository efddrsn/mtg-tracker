import { resolveCardTutorCard } from './cardtutor.mjs';
import { tlsLoad } from './store-tls.mjs';
import { createTinyfishLookup } from './store-tinyfish.mjs';
import { publicStoreUrl } from './store-network.mjs';

let browserPromise;
async function browserLoad(url, { signal }) {
  const { chromium } = await import('playwright');
  browserPromise ??= chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
    ...(process.env.HTTPS_PROXY ? { proxy: { server: process.env.HTTPS_PROXY } } : {}) }).catch((error) => { browserPromise = undefined; throw error; });
  const browser = await browserPromise;
  const context = await browser.newContext({ locale: 'pt-BR', serviceWorkers: 'block' });
  const abort = () => { void context.close(); };
  signal?.throwIfAborted();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    // All browser requests, including redirects/subresources, must be public HTTPS.
    await context.route('**/*', async (route) => {
      try {
        await publicStoreUrl(route.request().url());
        if (['image', 'font', 'media'].includes(route.request().resourceType())) return route.abort();
        await route.continue();
      } catch { await route.abort(); }
    });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18_000 });
    await page.waitForSelector('.table-cards-row, .title a[href*="refid="]', { timeout: 6000 }).catch(() => {});
    const html = await page.content();
    return { ok: response?.ok() ?? false, status: response?.status() ?? 0,
      url: page.url(), text: async () => html };
  } finally {
    signal?.removeEventListener('abort', abort);
    await context.close();
  }
}

async function firecrawlLoad(url, { signal }) {
  await publicStoreUrl(url);
  const response = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, formats: ['rawHtml'], onlyMainContent: false,
      maxAge: 0, waitFor: 1500, timeout: 20_000 }),
  });
  if (!response.ok) throw new Error(`Firecrawl HTTP ${response.status}`);
  const body = await response.json();
  if (!body.success || !body.data?.rawHtml) throw new Error('Firecrawl empty response');
  const finalUrl = body.data.metadata?.sourceURL ?? url;
  await publicStoreUrl(finalUrl);
  return { ok: true, status: 200, url: finalUrl, text: async () => body.data.rawHtml };
}

export function createResilientLookup({ direct = resolveCardTutorCard, browser = browserLoad,
  tls = tlsLoad, useTls = process.env.STORE_TLS_ENABLED === 'true',
  tinyfish = createTinyfishLookup(), useTinyfish = Boolean(process.env.TINYFISH_API_KEY),
  remote = firecrawlLoad, useBrowser = process.env.STORE_BROWSER_ENABLED !== 'false',
  useRemote = Boolean(process.env.FIRECRAWL_API_KEY) } = {}) {
  return async (name, signal, origin) => {
    let best;
    let failure;
    for (const [method, load] of [['direct', null], ...(useTls ? [['tls', tls]] : []),
      ...(useTinyfish ? [['tinyfish', null]] : []), ...(useBrowser ? [['browser', browser]] : []),
      ...(useRemote ? [['firecrawl', remote]] : [])]) {
      signal?.throwIfAborted();
      try {
        // Give the free direct route a short budget; keep time for rendered fallbacks.
        const attemptSignal = AbortSignal.any([
          ...(signal ? [signal] : []), AbortSignal.timeout(method === 'direct' ? 8_000 : method === 'tls' ? 24_000 : method === 'tinyfish' ? 35_000 : 25_000),
        ]);
        const result = method === 'tinyfish' ? await tinyfish(name, attemptSignal, origin)
          : await direct(name, attemptSignal, origin, load ?? undefined);
        if (!best || result.matched) best = { ...result, method };
        if (result.matched && result.listings.length && result.listings.every((offer) => offer.stock != null)) {
          return { ...result, method };
        }
      } catch (error) {
        failure ??= error;
        console.warn('Store transport failed', new URL(origin ?? 'https://www.cardtutor.com.br/').hostname, method, error.message?.slice(0, 180));
      }
    }
    if (best) return { ...best, error: best.error ?? 'offers_unavailable' };
    throw failure ?? new Error('Store unavailable');
  };
}
