import { useEffect, useState } from 'react';

interface BrazilPrice {
  price: number | null;
  source: 'LigaMagic';
  url: string;
  checkedAt: string;
}

const cache = new Map<string, Promise<BrazilPrice | null>>();

function loadPrice(name: string): Promise<BrazilPrice | null> {
  const key = name.toLocaleLowerCase('en');
  const existing = cache.get(key);
  if (existing) return existing;
  const request = fetch(`/api/prices/br?name=${encodeURIComponent(name)}`)
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

export function BrazilPriceBadge({ name, className = '' }: { name: string; className?: string }) {
  const [result, setResult] = useState<BrazilPrice | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    loadPrice(name).then((value) => { if (active) setResult(value); });
    return () => { active = false; };
  }, [name]);

  const fallbackUrl = `https://www.ligamagic.com.br/?view=cards/card&card=${encodeURIComponent(name)}`;
  const label = result?.price != null ? brl.format(result.price) : result === undefined ? 'R$ …' : 'Ver preço';

  return (
    <a
      className={`br-price-badge ${className}`.trim()}
      href={result?.url ?? fallbackUrl}
      target="_blank"
      rel="noreferrer"
      title={result?.price != null ? 'Menor preço no marketplace LigaMagic' : 'Ver na LigaMagic'}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </a>
  );
}
