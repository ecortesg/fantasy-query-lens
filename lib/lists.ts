import type { ScoringFormat } from './league';
import type { RankedList, Ranker } from './page/ranks';
import type { PageSource } from './page/source';
import type { Position } from './players';

const formatOrder: ScoringFormat[] = ['STD', 'HALF', 'PPR'];

/**
 * The lists a League reads, in page order. When any list is in the League's
 * format, lists in other formats are dropped (ADR-0009). Else each list keeps
 * its nearest format. A list whose format the page does not state is always kept.
 */
export function listsForLeague<T extends RankedList>(lists: readonly T[], scoring: ScoringFormat): T[] {
  if (lists.some((l) => l.format === scoring)) return lists.filter((l) => !l.format || l.format === scoring);
  const distance = (format: ScoringFormat) => Math.abs(formatOrder.indexOf(format) - formatOrder.indexOf(scoring));
  const sameList = (l: RankedList) => `${l.positions.toSorted()}|${l.rankers.map((r) => r.name)}`;
  const nearest = new Map<string, number>();
  for (const l of lists) {
    if (!l.format) continue;
    const key = sameList(l);
    nearest.set(key, Math.min(nearest.get(key) ?? Infinity, distance(l.format)));
  }
  return lists.filter((l) => !l.format || distance(l.format) === nearest.get(sameList(l)));
}

/** Every ranker the lists offer, the default first. */
export const rankerNames = (lists: readonly RankedList[]) => [...new Set(lists.flatMap((l) => l.rankers.map((r) => r.name)))];

/** The chosen ranker's column in a list, or the list's default. */
export const rankerIn = (list: RankedList, name: string | undefined): Ranker =>
  list.rankers.find((r) => r.name === name) ?? list.rankers[0]!;

/** "Yahoo Sports · Week 3": the panel's title for a Source. Its Ranker has its own menu. */
export const sourceTitle = (source: PageSource) => `${source.siteName} · ${source.week ? `Week ${source.week}` : 'Week unknown'}`;

/** A short name for what a list covers: "RB", "FLEX", "SUPERFLEX", or the positions joined. */
export function listLabel(positions: readonly Position[]): string {
  const key = positions.toSorted().join(',');
  if (key === 'RB,TE,WR') return 'FLEX';
  if (key === 'QB,RB,TE,WR') return 'SUPERFLEX';
  return positions.join('/') || 'list';
}
