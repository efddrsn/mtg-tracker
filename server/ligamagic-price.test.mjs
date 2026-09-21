import { describe, expect, it } from 'vitest';
import { extractJsonArray, parseLigaMagicPrice } from './ligamagic-price.mjs';

describe('LigaMagic price parser', () => {
  it('extracts a balanced inline JSON array', () => {
    const html = '<script>var cardsjson = [{"nEN":"A ] card","p1a":3.5}];</script>';
    expect(extractJsonArray(html, 'cardsjson')).toEqual([{ nEN: 'A ] card', p1a: 3.5 }]);
  });

  it('returns the cheapest Brazilian marketplace printing for the requested card', () => {
    const html = `<script>var cardsjson = [
      {"nEN":"Sol Ring","sSigla":"C21","p1a":12.9},
      {"nEN":"Sol Ring (Borderless)","sSigla":"LTC","p1a":8.25},
      {"nEN":"Sol Talisman","p1a":1.5}
    ];</script>`;
    expect(parseLigaMagicPrice(html, 'Sol Ring')).toBe(8.25);
  });

  it('ignores zero and missing prices', () => {
    const html = '<script>const cardsjson = [{"nEN":"Island","p1a":0}]</script>';
    expect(parseLigaMagicPrice(html, 'Island')).toBeNull();
  });
});
