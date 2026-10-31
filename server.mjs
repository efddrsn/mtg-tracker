import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchLigaMagicPrice, ligaMagicUrl } from './server/ligamagic-price.mjs';
import { fetchCommanderTopPicks } from './server/recommander-page.mjs';
import { createStoreResolver, validateStoreRequest } from './server/stores.mjs';
import { createResilientLookup } from './server/store-fallback.mjs';
import { handleEventApi } from './server/event-community.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const port = Number(process.env.PORT ?? 3000);
const upstream =
  process.env.RECOMMANDER_UPSTREAM ?? 'https://recommander.cards/api/decks/recommend';
const brPriceCache = new Map();
const BR_PRICE_TTL_MS = 6 * 60 * 60 * 1000;
const commanderPicksCache = new Map();
const COMMANDER_PICKS_TTL_MS = 6 * 60 * 60 * 1000;

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

async function cachedCommanderTopPicks(oracleId) {
  const cached = commanderPicksCache.get(oracleId);
  if (cached && Date.now() - cached.cachedAt < COMMANDER_PICKS_TTL_MS) {
    return cached.recommendations;
  }
  const recommendations = await fetchCommanderTopPicks(
    oracleId,
    AbortSignal.timeout(15_000),
  );
  if (recommendations.length > 0) {
    commanderPicksCache.set(oracleId, { cachedAt: Date.now(), recommendations });
  }
  return recommendations;
}

async function proxyRecommander(req, res) {
  if (req.method !== 'POST') {
    json(res, 405, { message: 'Method not allowed' });
    return;
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 256_000) {
      json(res, 413, { message: 'Request too large' });
      return;
    }
  }

  let requestBody;
  try {
    requestBody = JSON.parse(body);
  } catch {
    json(res, 400, { message: 'Invalid JSON body' });
    return;
  }

  const coldStart =
    requestBody.card_format === 'oracle_id' &&
    typeof requestBody.commander === 'string' &&
    Array.isArray(requestBody.deck) &&
    requestBody.deck.length === 0;
  // Commander Top Picks are fetched in parallel for cold starts. This avoids
  // waiting for a slow empty model response before requesting the useful
  // globally ranked list.
  const coldStartFallback = coldStart
    ? cachedCommanderTopPicks(requestBody.commander).catch(() => [])
    : Promise.resolve([]);

  if (coldStart) {
    const recommendations = await coldStartFallback;
    if (recommendations.length > 0) {
      json(res, 200, { recommendations });
      return;
    }
  }

  try {
    const response = await fetch(upstream, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });
    let responseBody = await response.text();
    if (response.ok) {
      try {
        const parsed = JSON.parse(responseBody);
        if (
          Array.isArray(parsed.recommendations) &&
          parsed.recommendations.length === 0 &&
          requestBody.card_format === 'oracle_id' &&
          typeof requestBody.commander === 'string'
        ) {
          const recommendations = coldStart
            ? await coldStartFallback
            : await cachedCommanderTopPicks(requestBody.commander);
          if (recommendations.length > 0) {
            responseBody = JSON.stringify({ ...parsed, recommendations });
          }
        }
      } catch {
        // Preserve the upstream response if its optional cold-start fallback
        // is unavailable or the response is not JSON.
      }
    }
    res.writeHead(response.status, {
      'Content-Type': response.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(responseBody);
  } catch {
    const recommendations = await coldStartFallback;
    if (recommendations.length > 0) {
      json(res, 200, { recommendations });
      return;
    }
    json(res, 502, { message: 'Could not reach Recommander.' });
  }
}

async function brazilPrice(req, res) {
  if (req.method !== 'GET') {
    json(res, 405, { message: 'Method not allowed' });
    return;
  }
  const params = new URL(req.url ?? '/', 'http://localhost').searchParams;
  const name = params.get('name')?.trim();
  const setCode = params.get('set')?.trim() ?? '';
  const collectorNumber = params.get('collector')?.trim() ?? '';
  if (!name || name.length > 180) {
    json(res, 400, { message: 'A valid card name is required.' });
    return;
  }

  const key = [name.toLocaleLowerCase('en'), setCode.toLowerCase(), collectorNumber].join('|');
  const cached = brPriceCache.get(key);
  if (cached && Date.now() - cached.cachedAt < BR_PRICE_TTL_MS) {
    json(res, 200, cached.body);
    return;
  }

  try {
    const result = await fetchLigaMagicPrice(
      name,
      { setCode, collectorNumber },
      AbortSignal.timeout(10_000),
    );
    const body = {
      price: result.price,
      printingMatched: result.printingMatched,
      source: 'LigaMagic',
      url: result.url,
      checkedAt: new Date().toISOString(),
    };
    brPriceCache.set(key, { cachedAt: Date.now(), body });
    json(res, 200, body);
  } catch {
    // A direct market link still gives the client a useful, honest fallback
    // when LigaMagic rate-limits or challenges this server.
    json(res, 200, {
      price: null,
      printingMatched: false,
      source: 'LigaMagic',
      url: ligaMagicUrl(name),
      checkedAt: new Date().toISOString(),
    });
  }
}

async function readJsonBody(req, maxLength = 256_000) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > maxLength) throw new Error('too_large');
  }
  return JSON.parse(body);
}

const resolveStoreCards = createStoreResolver(process.env.EVENT_FREE_ONLY === 'true'
  ? createResilientLookup({ useTinyfish: false, useRemote: false }) : undefined);

async function cardTutorResolve(req, res, storeId = 'cardtutor') {
  if (req.method !== 'POST') {
    json(res, 405, { message: 'Method not allowed' });
    return;
  }
  let input;
  try {
    input = validateStoreRequest(await readJsonBody(req), storeId);
  } catch (error) {
    json(res, error.message === 'too_large' ? 413 : 400, {
      message: error instanceof SyntaxError ? 'JSON inválido.' : error.message,
    });
    return;
  }
  const cards = await resolveStoreCards(input.store, input.cards);
  json(res, 200, { cards, checkedAt: new Date().toISOString() });
}


const binderOrigin = process.env.BINDER_UPSTREAM || 'https://binder-production-c22c.up.railway.app';
async function proxyBinder(req, res) {
  try {
    const url = new URL(req.url || '/binder/', 'http://localhost');
    const path = url.pathname.replace(/^\/binder/, '') || '/';
    const target = new URL(path + url.search, binderOrigin);
    if (target.origin !== new URL(binderOrigin).origin) throw new Error('Bad upstream');
    const headers = { Accept: req.headers.accept || '*/*' };
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 250000) { json(res, 413, { error: 'Lista grande demais.' }); return; }
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
    const upstreamRes = await fetch(target, {
      method: req.method, headers, body, signal: AbortSignal.timeout(120000)
    });
    const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
    const outputHeaders = { 'Content-Type': contentType, 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff' };
    const disposition = upstreamRes.headers.get('content-disposition');
    if (disposition) outputHeaders['Content-Disposition'] = disposition;
    if (/text\/html|javascript|text\/css/.test(contentType)) {
      const contents = (await upstreamRes.text()).replace(/(["'])\/(api|static|jobs)(?=\/|["'?])/g, '$1/binder/$2');
      res.writeHead(upstreamRes.status, outputHeaders);
      res.end(contents);
    } else {
      const bytes = Buffer.from(await upstreamRes.arrayBuffer());
      res.writeHead(upstreamRes.status, outputHeaders);
      res.end(bytes);
    }
  } catch (error) {
    console.warn('binder_proxy_error', error.message);
    if (!res.headersSent) json(res, 502, { error: 'Print Binder indisponível. Tente novamente.' });
  }
}

function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '');
  let file = join(root, relative || 'index.html');

  try {
    if (statSync(file).isDirectory()) file = join(file, 'index.html');
    statSync(file);
  } catch {
    file = join(root, 'index.html');
  }

  res.writeHead(200, {
    'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  if (pathname.startsWith('/api/event/')) {
    void handleEventApi(req, res, pathname);
    return;
  }
  if (pathname === '/binder' || pathname.startsWith('/binder/')) {
    void proxyBinder(req, res);
    return;
  }
  if (req.url?.startsWith('/api/recommander')) {
    void proxyRecommander(req, res);
    return;
  }
  if (req.url?.startsWith('/api/prices/br')) {
    void brazilPrice(req, res);
    return;
  }
  const storeRoute = /^\/api\/stores\/([a-z]+)\/resolve$/.exec(new URL(req.url ?? '/', 'http://localhost').pathname);
  if (storeRoute) {
    void cardTutorResolve(req, res, storeRoute[1]);
    return;
  }
  serveStatic(req, res);
}).listen(port, () => {
  console.log(`MTG app listening on ${port}`);
});
