import { useEffect, useState } from 'react';

interface BrazilPrice {
  price: number | null;
  printingMatched: boolean;
  source: 'LigaMagic';
  url: string;
  checkedAt: string;
}

const cache = new Map<string, Promise<BrazilPrice | null>>();

interface BrazilPriceBadgeProps {
  name: string;
  setCode?: string;
  collectorNumber?: string;
  className?: string;
}

function loadPrice(
  name: string,
  setCode = '',
  collectorNumber = '',
): Promise<BrazilPrice | null> {
  const key = [name.toLocaleLowerCase('en'), setCode.toLowerCase(), collectorNumber].join('|');
  const existing = cache.get(key);
  if (existing) return existing;
  const params = new URLSearchParams({ name });
  if (setCode) params.set('set', setCode);
  if (collectorNumber) params.set('collector', collectorNumber);
  const request = fetch(`/api/prices/br?${params.toString()}`)
    .then(async (response) => response.ok ? response.json() as Promise<BrazilPrice> : null)
    .catch(() => null);
  cache.set(key, request);
  return request;
}

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

export function BrazilPriceBadge({
  name,
  setCode = '',
  collectorNumber = '',
  className = '',
}: BrazilPriceBadgeProps) {
  const priceKey = [name.toLocaleLowerCase('en'), setCode.toLowerCase(), collectorNumber].join('|');
  const [loaded, setLoaded] = useState<{
    key: string;
    value: BrazilPrice | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    loadPrice(name, setCode, collectorNumber).then((value) => {
      if (active) setLoaded({ key: priceKey, value });
    });
    return () => { active = false; };
  }, [collectorNumber, name, priceKey, setCode]);

  const result = loaded?.key === priceKey ? loaded.value : undefined;

  const fallbackUrl = `https://www.ligamagic.com.br/?view=cards/card&card=${encodeURIComponent(name)}`;
  const label = result?.price != null ? brl.format(result.price) : result === undefined ? 'R$ …' : 'Ver preço';

  return (
    <a
      className={`br-price-badge ${className}`.trim()}
      href={result?.url ?? fallbackUrl}
      target="_blank"
      rel="noreferrer"
      title={result?.price != null
        ? result.printingMatched
          ? 'Menor preço desta impressão na LigaMagic'
          : 'Menor preço disponível na LigaMagic'
        : 'Ver na LigaMagic'}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </a>
  );
}
