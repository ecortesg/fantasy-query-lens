import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import type { RankedList } from '../lib/page/ranks';
import type { ScanResult } from '../lib/page/scan';
import { removeList, forgetSite, listsFromSource, mergeLists, saveScan, scansItem } from '../lib/scans';

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

describe('forgetSite', () => {
  beforeEach(() => fakeBrowser.reset());

  it('removes every week of one site and keeps the other sites', async () => {
    await saveScan(result(3, [list(['QB'], 1)]));
    await saveScan(result(4, [list(['RB'], 4)]));
    await saveScan({ ...result(3, [list(['WR'], 2)]), source: { site: 'thefantasyfootballers.com', siteName: 'Fantasy Footballers', week: 3 } });
    await forgetSite('sports.yahoo.com');
    expect((await scansItem.getValue()).map((l) => [l.site, l.heading])).toEqual([['thefantasyfootballers.com', 'WR']]);
  });
});

describe('removeList', () => {
  beforeEach(() => fakeBrowser.reset());

  it('removes one list, also when another list of the same Scan has its key', async () => {
    const unstated = (rank: number) => ({ ...list([], rank), heading: `Consensus ${rank}` });
    await saveScan(result(3, [unstated(1), unstated(2), list(['QB'], 3)]));
    const [first] = await scansItem.getValue();
    await removeList(first!.id);
    expect((await scansItem.getValue()).map((l) => l.heading)).toEqual(['Consensus 2', 'QB']);
  });
});

describe('scansItem', () => {
  beforeEach(() => fakeBrowser.reset());

  it('gives each list kept before lists had IDs its own ID', async () => {
    const old = { ...list(['QB'], 1), site: 'sports.yahoo.com', siteName: 'Yahoo Sports', week: 3, scannedAt: 1 };
    await fakeBrowser.storage.local.set({ scans: [old, old] });
    // The panel runs it when it loads.
    await scansItem.migrate();
    const ids = (await scansItem.getValue()).map((l) => l.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every(Boolean)).toBe(true);
  });
});
