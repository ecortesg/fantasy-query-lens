import { storage } from '#imports';
import type { RankedList } from './page/ranks';
import type { ScanResult } from './page/scan';

/** A Ranked List kept after its Scan, with the page it came from (ADR-0004). */
export type StoredList = RankedList & { site: string; siteName: string; week?: number; scannedAt: number };

export const scansItem = storage.defineItem<StoredList[]>('local:scans', { fallback: [] });

/** Site + week + format + positions + rankers: a newer list with the same key replaces the older one. */
export const keyOf = (l: StoredList) =>
  JSON.stringify([l.site, l.week ?? null, l.format ?? null, l.positions.toSorted(), l.rankers.map((r) => r.name)]);

/** A Scan's lists, tagged with the page they came from. */
export function storedLists(result: ScanResult): StoredList[] {
  const { site, siteName, week } = result.source;
  return result.lists.map((l) => ({ ...l, site, siteName, week, scannedAt: result.scannedAt }));
}

/** Kept lists with newer ones added, each replacing a kept list with the same key. */
export function mergeLists(kept: readonly StoredList[], added: readonly StoredList[]): StoredList[] {
  const keys = new Set(added.map(keyOf));
  return [...kept.filter((l) => !keys.has(keyOf(l))), ...added];
}

// One save at a time, so two quick Scans cannot overwrite each other's lists.
let queue: Promise<void> = Promise.resolve();

export function saveScan(result: ScanResult): Promise<void> {
  const added = storedLists(result);
  if (added.length === 0) return queue;
  queue = queue
    .catch(() => {})
    .then(async () => scansItem.setValue(mergeLists(await scansItem.getValue(), added)));
  return queue;
}

/**
 * The Scan without one of its lists, so a list the user removed stays gone until they scan again.
 * Undefined when its Source has no list left, kept or scanned: the panel then starts again.
 */
export function withoutList(result: ScanResult, list: StoredList, kept: readonly StoredList[]): ScanResult | undefined {
  const key = keyOf(list);
  const stored = storedLists(result);
  const next = { ...result, lists: result.lists.filter((_, i) => keyOf(stored[i]!) !== key) };
  const keptLeft = listsFromSource(kept, result.source.site, result.source.week).some((l) => keyOf(l) !== key);
  return next.lists.length || keptLeft ? next : undefined;
}

/** Removes a kept list the user no longer wants in the lineup. */
export function forgetList(list: StoredList): Promise<void> {
  const key = keyOf(list);
  queue = queue
    .catch(() => {})
    .then(async () => scansItem.setValue((await scansItem.getValue()).filter((l) => keyOf(l) !== key)));
  return queue;
}

/** The kept lists one page's lineup merges: the same site and week. */
export const listsFromSource = (all: readonly StoredList[], site: string, week: number | undefined) =>
  all.filter((l) => l.site === site && l.week === week);
