import { describe, expect, it } from 'vitest';
import { listLabel, listsForLeague, sourceTitle } from '../lib/lists';
import type { RankedList } from '../lib/page/ranks';

const list = (format: RankedList['format'], positions: RankedList['positions'] = ['QB']): RankedList => ({
  heading: '',
  positions,
  format,
  rankers: [{ name: 'Boone', ranks: {} }],
});

describe('listsForLeague', () => {
  it('keeps the list in the League format when the page has one per format', () => {
    expect(listsForLeague([list('HALF'), list('PPR')], 'PPR')).toEqual([list('PPR')]);
  });

  it('falls back to the nearest format', () => {
    expect(listsForLeague([list('STD'), list('HALF')], 'PPR')).toEqual([list('HALF')]);
  });

  it('drops lists in other formats when one list is in the League format', () => {
    // Yahoo shows a Half-PPR table with its QB tab open, and a PPR table with its RB tab open.
    expect(listsForLeague([list('HALF', ['QB']), list('PPR', ['RB'])], 'HALF')).toEqual([list('HALF', ['QB'])]);
  });

  it('keeps the nearest format of each list when no list is in the League format', () => {
    expect(listsForLeague([list('PPR', ['RB']), list('STD', ['QB'])], 'HALF')).toEqual([
      list('PPR', ['RB']),
      list('STD', ['QB']),
    ]);
  });

  it('keeps every list whose format the page does not state', () => {
    expect(listsForLeague([list(undefined), list(undefined), list('PPR')], 'PPR')).toEqual([
      list(undefined),
      list(undefined),
      list('PPR'),
    ]);
  });

  it('keeps different lists apart', () => {
    const lists = [list('HALF', ['QB']), list('HALF', ['RB', 'WR', 'TE'])];
    expect(listsForLeague(lists, 'PPR')).toEqual(lists);
  });
});

describe('sourceTitle', () => {
  const source = { site: 'sports.yahoo.com', siteName: 'Yahoo Sports', week: 3 };

  it('names site and week', () => {
    expect(sourceTitle(source)).toBe('Yahoo Sports · Week 3');
    expect(sourceTitle({ ...source, week: undefined })).toBe('Yahoo Sports · Week unknown');
  });
});

describe('listLabel', () => {
  it.each([
    [['RB'], 'RB'],
    [['WR', 'RB', 'TE'], 'FLEX'],
    [['QB', 'RB', 'WR', 'TE'], 'SUPERFLEX'],
    [['RB', 'WR'], 'RB/WR'],
  ] as const)('%o is %s', (positions, label) => {
    expect(listLabel(positions)).toBe(label);
  });
});
