import type { Player } from '../players';
import { findPlayers } from './find';
import { clearHighlights, highlight, type MarkKind } from './highlight';
import { readLists, type RankedList } from './ranks';
import { readSource, type PageSource } from './source';

/**
 * What the side panel sends the page: the players of every League and the
 * active League's available players, so the lists keep ranks for all of them,
 * and how to mark each one. A player with no kind is marked `other`.
 */
export type ScanRequest = {
  type: 'fq-lens:scan';
  players: Player[];
  kinds: Record<string, MarkKind>;
};

/** New colors once the panel has built the Lineup. */
export type KindsUpdate = { type: 'fq-lens:kinds'; kinds: Record<string, MarkKind> };

/** The page read again after it drew new content, such as a tab click. The panel keeps no list from it (ADR-0010). */
export type PageView = { type: 'fq-lens:view'; result: ScanResult };

/** The user removed the last list of the page's Source, so its marks go too. */
export type ClearMarks = { type: 'fq-lens:clear' };

export type ScanResult = {
  url: string;
  title: string;
  /** IDs of the players the page names, in page order. */
  found: string[];
  source: PageSource;
  lists: RankedList[];
  scannedAt: number;
};

export function scanPage(doc: Document, request: ScanRequest): ScanResult {
  clearHighlights(doc.body);
  const hits = findPlayers(doc.body, request.players);
  const marks = highlight(hits, (id) => request.kinds[id]);
  const source = readSource(doc);
  return {
    url: doc.location.href,
    title: doc.title,
    found: [...new Set(hits.map((h) => h.player.id))],
    source,
    lists: readLists(doc.body, marks, {
      pageRanker: source.author ?? source.siteName,
      pageFormat: source.format,
    }),
    scannedAt: Date.now(),
  };
}
