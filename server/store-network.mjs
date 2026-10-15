import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { fetch, Agent, EnvHttpProxyAgent } from 'undici';

const proxyDispatcher = process.env.HTTPS_PROXY || process.env.https_proxy ? new EnvHttpProxyAgent() : null;
const dnsCache = new Map();

export async function publicStoreUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.port || url.username || url.password
    || isIP(url.hostname) || !/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(url.hostname)) {
    throw new Error('Use o endereço HTTPS público da loja.');
  }
  // Resolve and pin IPv4 addresses to prevent custom stores reaching private services.
  const cached = dnsCache.get(url.hostname);
  if (cached && cached.expires > Date.now()) return { url, addresses: cached.addresses };
  let addresses;
  try { addresses = await lookup(url.hostname, { family: 4, all: true }); }
  catch (error) {
    if (!(process.env.HTTPS_PROXY || process.env.https_proxy)) throw error;
    // Some hosted environments delegate DNS to their outbound proxy.
    const dispatcher = proxyDispatcher;
    {
      const response = await fetch(`https://dns.google/resolve?type=A&name=${encodeURIComponent(url.hostname)}`,
        { dispatcher, signal: AbortSignal.timeout(15_000) });
      const body = await response.json();
      addresses = (body.Answer ?? []).filter((entry) => entry.type === 1 && isIP(entry.data) === 4)
        .map((entry) => ({ address: entry.data, family: 4 }));
    }
  }
  if (!addresses.length || addresses.some(({ address }) => {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0))
      || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19));
  })) throw new Error('A loja precisa ter um endereço público.');
  if (dnsCache.size > 1000) dnsCache.delete(dnsCache.keys().next().value);
  dnsCache.set(url.hostname, { addresses, expires: Date.now() + 60_000 });
  return { url, addresses };
}

export async function storeFetch(value, options = {}) {
  let current = value;
  const cookies = new Map();
  for (let hop = 0; hop < 6; hop++) {
    const { url, addresses } = await publicStoreUrl(current);
    const dispatcher = proxyDispatcher
      ? proxyDispatcher
      : new Agent({ connect: { lookup: (_host, opts, callback) => {
        callback(null, opts.all ? addresses : addresses[0].address, 4);
      } } });
    try {
      const response = await fetch(url, { ...options, dispatcher, redirect: 'manual',
        headers: { ...options.headers, ...(cookies.has(url.origin) ? { Cookie: cookies.get(url.origin) } : {}) } });
      const cookie = response.headers.getSetCookie?.().map((entry) => entry.split(';')[0]).join('; ');
      if (cookie) cookies.set(url.origin, cookie);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        current = new URL(response.headers.get('location'), url).href;
        await response.body?.cancel();
        continue;
      }
      const html = await response.text();
      if (html.length > 5_000_000) throw new Error('Store response too large');
      return { ok: response.ok, status: response.status, url: url.href, text: async () => html };
    } finally { if (dispatcher !== proxyDispatcher) await dispatcher.close(); }
  }
  throw new Error('Store redirect limit');
}
