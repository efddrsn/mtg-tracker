import { describe, expect, it } from 'vitest';
import { cardTutorCsv, lowestAvailablePrice, type CardTutorResult } from './cardtutor';

const result: CardTutorResult = {
  oracleId: '1', name: 'Fire, Ice', setCode: 'hob', collectorNumber: '110',
  url: 'https://example.test/item', matched: true,
  listings: [
    { editionId: '1', edition: 'Regular', language: 'Inglês', quality: 'NM', extras: '', stock: 0, price: 5 },
    { editionId: '2', edition: 'Foil', language: 'Inglês', quality: 'NM', extras: 'Foil', stock: 2, price: 8.5 },
  ],
};

describe('CardTutor export', () => {
  it('uses only available listings for the lowest price', () => {
    expect(lowestAvailablePrice(result)).toBe(8.5);
  });

  it('exports a spreadsheet-safe CSV', () => {
    const csv = cardTutorCsv([result]);
    expect(csv).toContain('"Fire, Ice",HOB,110');
    expect(csv).toContain(',yes,8.50,Foil,');
  });
});
