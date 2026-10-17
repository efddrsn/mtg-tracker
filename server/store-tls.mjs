import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { publicStoreUrl } from './store-network.mjs';

const script = fileURLToPath(new URL('./store-tls.py', import.meta.url));
export async function tlsLoad(value, { signal } = {}) {
  let current = value;
  const cookies = new Map();
  for (let hop = 0; hop < 6; hop++) {
    signal?.throwIfAborted();
    const { url, addresses } = await publicStoreUrl(current);
    const body = await new Promise((resolve, reject) => {
      const child = execFile(process.env.STORE_PYTHON ?? 'python3', [script], {
        signal, timeout: 24_000, maxBuffer: 12_000_000,
      }, (error, stdout) => {
        if (error) return reject(new Error(`TLS transport failed: ${error.code ?? error.name}`));
        try { resolve(JSON.parse(stdout)); } catch { reject(new Error('Invalid TLS response')); }
      });
      child.stdin.on('error', () => {});
      child.stdin.end(JSON.stringify({ url: url.href, warmup: hop === 0,
        resolve: `${url.hostname}:443:${addresses.map(({ address }) => address).join(',')}`,
        headers: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
          ...(cookies.has(url.origin) ? { Cookie: cookies.get(url.origin) } : {}) },
      }));
    });
    if ([403, 429].includes(body.status)) {
      console.warn('Store TLS rejection', JSON.stringify({ host: url.hostname, status: body.status, ...body.diagnostic }));
    }
    if (body.cookies?.length) cookies.set(url.origin, body.cookies.map((entry) => entry.split(';')[0]).join('; '));
    if ([301, 302, 303, 307, 308].includes(body.status)) {
      if (!body.location) throw new Error('Missing store redirect');
      current = new URL(body.location, url).href;
      continue;
    }
    return { ok: body.status >= 200 && body.status < 300, status: body.status,
      url: url.href, text: async () => body.html };
  }
  throw new Error('Store redirect limit');
}
