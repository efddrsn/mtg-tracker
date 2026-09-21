const LIGA_URL = 'https://www.ligamagic.com.br/?view=cards/card&card=';

export function extractJsonArray(html, variableName) {
  const start = new RegExp(`(?:var|let|const)\\s+${variableName}\\s*=\\s*(\\[)`).exec(html);
  if (!start) return null;
  const arrayStart = start.index + start[0].length - 1;
  let depth = 0;
  let quote = null;
  for (let index = arrayStart; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(arrayStart, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function comparableName(value) {
  return String(value ?? '')
    .replace(/\s*\([^()]*\)\s*$/g, '')
    .split(' // ')[0]
    .trim()
    .toLocaleLowerCase('en');
}

export function parseLigaMagicPrice(html, requestedName) {
  const rows = extractJsonArray(html, 'cardsjson')
    ?? extractJsonArray(html, 'cards_editions');
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const wanted = comparableName(requestedName);
  const exact = rows.filter((row) =>
    comparableName(row.nEN ?? row.name) === wanted
    || comparableName(row.nPT) === wanted,
  );
  const candidates = exact.length > 0 ? exact : rows;
  const prices = candidates
    .map((row) => Number(row.p1a ?? row.precoMenor ?? row?.price?.[0]?.p))
    .filter((price) => Number.isFinite(price) && price > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function ligaMagicUrl(name) {
  return `${LIGA_URL}${encodeURIComponent(name.split(' // ')[0].trim())}`;
}

export async function fetchLigaMagicPrice(name, signal) {
  const url = ligaMagicUrl(name);
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
      'User-Agent': 'Mozilla/5.0 (compatible; MTGWishlist/1.0; +https://github.com/efddrsn/mtg-tracker)',
    },
    signal,
  });
  if (!response.ok) throw new Error(`LigaMagic HTTP ${response.status}`);
  return { price: parseLigaMagicPrice(await response.text(), name), url };
}
