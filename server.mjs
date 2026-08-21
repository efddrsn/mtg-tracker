import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const port = Number(process.env.PORT ?? 3000);
const upstream =
  process.env.RECOMMANDER_UPSTREAM ?? 'https://recommander.cards/api/decks/recommend';

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

  try {
    JSON.parse(body);
  } catch {
    json(res, 400, { message: 'Invalid JSON body' });
    return;
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
    const responseBody = await response.text();
    res.writeHead(response.status, {
      'Content-Type': response.headers.get('content-type') ?? 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(responseBody);
  } catch {
    json(res, 502, { message: 'Could not reach Recommander.' });
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
  if (req.url?.startsWith('/api/recommander')) {
    void proxyRecommander(req, res);
    return;
  }
  serveStatic(req, res);
}).listen(port, () => {
  console.log(`MTG app listening on ${port}`);
});
