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
    expect(parseLigaMagicPrice(html, 'Sol Ring')).toEqual({
      price: 8.25,
      printingMatched: false,
    });
  });

  it('ignores zero and missing prices', () => {
    const html = '<script>const cardsjson = [{"nEN":"Island","p1a":0}]</script>';
    expect(parseLigaMagicPrice(html, 'Island')).toEqual({
      price: null,
      printingMatched: false,
    });
  });

  it('returns the price for the selected set and collector number', () => {
    const html = `<script>var cards_editions = [
      {"name":"The Hobbit","code":"hob","num":"110","price":{"0":{"p":"114.21"},"2":{"p":"117.30"}}},
      {"name":"The Hobbit (Dragon Hoard)","code":"dhhob","num":"229","price":{"0":{"p":"239.88"}}},
      {"name":"The Hobbit (Dragon Hoard Surge Foil)","code":"dshob","num":"265","price":{"0":{"p":"1988.91"}}}
    ];</script>`;

    expect(parseLigaMagicPrice(html, 'Smaug the Magnificent', {
      setCode: 'HOB', collectorNumber: '110',
    })).toEqual({ price: 114.21, printingMatched: true });
    expect(parseLigaMagicPrice(html, 'Smaug the Magnificent', {
      setCode: 'HOB', collectorNumber: '229',
    })).toEqual({ price: 239.88, printingMatched: true });
  });
});
