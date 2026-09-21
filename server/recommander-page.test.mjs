import { describe, expect, it } from 'vitest';
import { parseCommanderTopPicks } from './recommander-page.mjs';

describe('Recommander commander-page parser', () => {
  it('preserves global order and removes category duplicates', () => {
    const row = (id, name, score, count) =>
      `<li data-rep="print" data-sf="set/1/card" data-score="${score}" data-count="${count}" data-pop="100"><a href="/card/${id}">${name}</a></li>`;
    const html = [
      row('11111111-1111-1111-1111-111111111111', 'Rain of Riches', 0.63, 70),
      row('22222222-2222-2222-2222-222222222222', 'Dragon&#39;s Hoard', 0.61, 60),
      row('11111111-1111-1111-1111-111111111111', 'Rain of Riches', 0.63, 70),
    ].join('');

    expect(parseCommanderTopPicks(html)).toEqual([
      expect.objectContaining({ name: 'Rain of Riches', score: 0.63, commander_count: 70 }),
      expect.objectContaining({ name: "Dragon's Hoard", score: 0.61, commander_count: 60 }),
    ]);
  });
});
