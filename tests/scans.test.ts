import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { RankedList } from '../lib/page/ranks';
import type { ScanResult } from '../lib/page/scan';
import { forgetList, listsFromSource, mergeLists, saveScan, scansItem, storedLists, withoutList } from '../lib/scans';

const list = (positions: RankedList['positions'], rank: number): RankedList => ({
  heading: positions.join('/'),
  positions,
  format: 'PPR',
  rankers: [{ name: 'Boone', ranks: { p: rank } }],
});

const result = (week: number, lists: RankedList[], scannedAt = 1): ScanResult => ({
  url: 'https://sports.yahoo.com/x',
  title: '',
  found: [],
  source: { site: 'sports.yahoo.com', siteName: 'Yahoo Sports', week },
  lists,
  scannedAt,
});

describe('saveScan', () => {
  beforeEach(() => fakeBrowser.reset());

  it('merges lists from several pages and replaces a list scanned again', async () => {
    await saveScan(result(3, [list(['QB'], 1)]));
    await saveScan(result(3, [list(['RB'], 4)]));
    await saveScan(result(3, [list(['QB'], 2)], 2));

    const kept = listsFromSource(await scansItem.getValue(), 'sports.yahoo.com', 3);
    expect(kept.map((l) => [l.heading, l.rankers[0]!.ranks.p])).toEqual([
      ['RB', 4],
      ['QB', 2],
    ]);
  });

  it('keeps weeks apart', async () => {
    await saveScan(result(3, [list(['QB'], 1)]));
    await saveScan(result(4, [list(['QB'], 9)]));
    const all = await scansItem.getValue();
    expect(listsFromSource(all, 'sports.yahoo.com', 3).map((l) => l.rankers[0]!.ranks.p)).toEqual([1]);
    expect(listsFromSource(all, 'sports.yahoo.com', 4).map((l) => l.rankers[0]!.ranks.p)).toEqual([9]);
  });
});

describe('saveScan, twice at once', () => {
  beforeEach(() => fakeBrowser.reset());

  it('keeps both lists', async () => {
    await Promise.all([saveScan(result(3, [list(['QB'], 1)])), saveScan(result(3, [list(['RB'], 4)]))]);
    expect((await scansItem.getValue()).map((l) => l.heading)).toEqual(['QB', 'RB']);
  });
});

describe('forgetList', () => {
  beforeEach(() => fakeBrowser.reset());

  it('removes one kept list and keeps the rest', async () => {
    await saveScan(result(3, [list(['QB'], 1), list(['RB'], 4)]));
    const [qb] = await scansItem.getValue();
    await forgetList(qb!);
    expect((await scansItem.getValue()).map((l) => l.heading)).toEqual(['RB']);
  });
});

describe('withoutList', () => {
  beforeEach(() => fakeBrowser.reset());

  it('removes a list of the last Scan from the panel until the next Scan', async () => {
    const last = result(3, [list(['QB'], 1), list(['RB'], 4)]);
    await saveScan(last);
    const qb = storedLists(last)[0]!;
    await forgetList(qb);
    // The panel shows the kept lists plus the last Scan's.
    const kept = await scansItem.getValue();
    const shown = mergeLists(kept, storedLists(withoutList(last, qb, kept)!));
    expect(shown.map((l) => l.heading)).toEqual(['RB']);
  });

  it('ends the Scan when its Source has no list left', async () => {
    const last = result(3, [list(['QB'], 1)]);
    await saveScan(last);
    await saveScan(result(4, [list(['RB'], 4)]));
    const qb = storedLists(last)[0]!;
    expect(withoutList(last, qb, await scansItem.getValue())).toBeUndefined();
  });

  it('keeps the Scan while another page of its Source has a list', async () => {
    const last = result(3, [list(['QB'], 1)]);
    await saveScan(last);
    await saveScan(result(3, [list(['RB'], 4)]));
    const qb = storedLists(last)[0]!;
    expect(withoutList(last, qb, await scansItem.getValue())?.lists).toEqual([]);
  });
});
