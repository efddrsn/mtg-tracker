const CARDTUTOR_ORIGIN = 'https://www.cardtutor.com.br/';

function decodeHtml(value) {
  const named = {
    aacute: 'á', acirc: 'â', atilde: 'ã', ccedil: 'ç', eacute: 'é', ecirc: 'ê',
    iacute: 'í', oacute: 'ó', ocirc: 'ô', otilde: 'õ', uacute: 'ú', uuml: 'ü',
  };
  return String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&([a-z]+);/gi, (entity, name) => named[name.toLocaleLowerCase('en')] ?? entity);
}

function textContent(value) {
  return decodeHtml(String(value ?? '').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function comparableName(value) {
  return textContent(value)
    .split(' // ')[0]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en');
}

function brlNumber(value) {
  const normalized = String(value ?? '')
    .replace(/[^\d,.]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function cardTutorSearchUrl(name) {
  const url = new URL(CARDTUTOR_ORIGIN);
  url.searchParams.set('view', 'ecom/itens');
  // CardTutor redirects an exact match straight to its stable refid product
  // page. The URL therefore remains useful even if our server cannot resolve
  // the redirect while exporting.
  url.searchParams.set('searchExactMatch', '1');
  url.searchParams.set('busca', String(name ?? '').split(' // ')[0].trim());
  url.searchParams.set('btnEnviar', '1');
  return url.toString();
}

export function parseCardTutorSearch(html, requestedName) {
  const wanted = comparableName(requestedName);
  const pattern = /<div\s+class=["']title["']>\s*<a\s+href=["']([^"']*\brefid=([^&"']+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    const name = textContent(match[3]);
    if (comparableName(name) !== wanted) continue;
    const refid = decodeHtml(match[2]);
    return {
      name,
      refid,
      url: `${CARDTUTOR_ORIGIN}?view=ecom/item&refid=${encodeURIComponent(refid)}`,
    };
  }
  return null;
}

export function parseCardTutorListings(html) {
  const chunks = html.split(/<div\s+class=["']table-cards-row\b[^>]*>/i).slice(1);
  return chunks.flatMap((chunk) => {
    const editionId = /[?&](?:amp;)?txt_edicao=(\d+)/i.exec(chunk)?.[1];
    const editionImage = /<img\b(?=[^>]*\bclass=["'][^"']*\bicon-edicao\b[^"']*["'])[^>]*>/i.exec(chunk)?.[0] ?? '';
    const edition = /\btitle=["']([^"']*)["']/i.exec(editionImage)?.[1]
      ?? /<div\s+class=["']tooltip["']>([^<]+)<\/div>/i.exec(chunk)?.[1];
    const language = /<img\s+alt=["']([^"']+)["'][^>]*\b(?:bandeiras|flags)\//i.exec(chunk)?.[1];
    const quality = /class=["'][^"']*\bquality\b[^"']*["'][^>]*>[\s\S]*?<div[^>]*>[^<]*<\/div>\s*([^<\s][^<]*)/i.exec(chunk)?.[1];
    const extras = /class=["'][^"']*\bcard-extras\b[^"']*["'][^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/i.exec(chunk)?.[1];
    const stockText = /<div\s+class=["']title-mobile["']>Estoque<\/div>\s*([\d.,]+)\s*unid/i.exec(chunk)?.[1];
    const priceText = /class=["'][^"']*\bcard-preco\b[^"']*["'][^>]*>[\s\S]*?R\$\s*([\d.,]+)/i.exec(chunk)?.[1];
    if (!editionId || !edition || !priceText) return [];
    return [{
      editionId,
      edition: textContent(edition),
      language: textContent(language),
      quality: textContent(quality),
      extras: textContent(extras),
      stock: Number.parseInt(stockText ?? '0', 10) || 0,
      price: brlNumber(priceText),
    }];
  });
}

const requestHeaders = {
  Accept: 'text/html,application/xhtml+xml',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7',
  'User-Agent': 'Mozilla/5.0 (compatible; MTGWishlist/1.0; +https://github.com/efddrsn/mtg-tracker)',
};

export async function resolveCardTutorCard(name, signal) {
  const searchUrl = cardTutorSearchUrl(name);
  const searchResponse = await fetch(searchUrl, { headers: requestHeaders, signal });
  if (!searchResponse.ok) throw new Error(`CardTutor search HTTP ${searchResponse.status}`);
  const searchHtml = await searchResponse.text();
  const redirected = new URL(searchResponse.url);
  const redirectedRefid = redirected.searchParams.get('refid');
  if (redirected.searchParams.get('view') === 'ecom/item' && redirectedRefid) {
    return {
      name,
      url: `${CARDTUTOR_ORIGIN}?view=ecom/item&refid=${encodeURIComponent(redirectedRefid)}`,
      matched: true,
      listings: parseCardTutorListings(searchHtml),
    };
  }

  const product = parseCardTutorSearch(searchHtml, name);
  if (!product) return { name, url: searchUrl, matched: false, listings: [] };

  const itemResponse = await fetch(product.url, { headers: requestHeaders, signal });
  if (!itemResponse.ok) throw new Error(`CardTutor item HTTP ${itemResponse.status}`);
  return {
    name,
    url: product.url,
    matched: true,
    listings: parseCardTutorListings(await itemResponse.text()),
  };
}
