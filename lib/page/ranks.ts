import type { ScoringFormat } from '../league';
import type { Position } from '../players';
import { shownText } from './text';

/** One ranker's ranks in a list, for the Roster players the list names. */
export type Ranker = { name: string; ranks: Record<string, number> };

/** Players in a ranker's order, as one table or list on the page shows them. */
export type RankedList = {
  heading: string;
  /** The positions the list ranks; more than one makes it a cross-position list. */
  positions: Position[];
  format?: ScoringFormat;
  /** The first is the default: the consensus when the table has one. */
  rankers: Ranker[];
};

const HEADINGS = 'h1, h2, h3, h4, h5, h6, caption';

/** Words a page uses for positions. FLEX and Superflex name several. */
const POSITION_WORDS: [RegExp, Position[]][] = [
  [/\bsuper\s*-?flex\b/i, ['QB', 'RB', 'WR', 'TE']],
  [/\bflex\b/i, ['RB', 'WR', 'TE']],
  [/\b(qbs?|quarterbacks?)\b/i, ['QB']],
  [/\b(rbs?|running\s*backs?)\b/i, ['RB']],
  [/\b(wrs?|wide\s*receivers?)\b/i, ['WR']],
  [/\b(tes?|tight\s*ends?)\b/i, ['TE']],
  [/\b(k|pk|kickers?)\b/i, ['K']],
  [/\b(dst|d\/st|def|defen[cs]es?)\b/i, ['DEF']],
  [/\b(dl|linemen)\b/i, ['DL']],
  [/\b(lbs?|linebackers?)\b/i, ['LB']],
  [/\b(dbs?|defensive\s*backs?)\b/i, ['DB']],
];

/** A position cell ("RB", "RB12", "D/ST") as one of ours. */
function positionCell(text: string): Position | undefined {
  const cleaned = text.trim().replace(/\d+$/, '');
  if (!cleaned || cleaned.length > 12) return undefined;
  for (const [pattern, positions] of POSITION_WORDS) {
    if (positions.length === 1 && new RegExp(`^(?:${pattern.source})$`, 'i').test(cleaned)) return positions[0];
  }
  return undefined;
}

/**
 * The positions a heading names. A heading that names one position, FLEX or
 * Superflex is trusted; one that lists several ("QB, RB, WR and TE rankings")
 * is a table of contents, not a list's coverage.
 */
export function headingPositions(heading: string): Position[] {
  for (const [pattern, positions] of POSITION_WORDS.slice(0, 2)) {
    if (pattern.test(heading)) return positions;
  }
  const named = POSITION_WORDS.slice(2).filter(([pattern]) => pattern.test(heading));
  return named.length === 1 ? named[0]![1] : [];
}

/** The scoring format a piece of text names, if any. */
export function formatIn(text: string): ScoringFormat | undefined {
  if (/half[\s-]*ppr|0\.5\s*ppr|\bhalf\b/i.test(text)) return 'HALF';
  if (/non[\s-]*ppr|\bstandard\b|\bstd\b/i.test(text)) return 'STD';
  if (/\bppr\b/i.test(text)) return 'PPR';
  return undefined;
}

/** The nearest heading before an element, looking at earlier siblings and then up the tree. */
export function headingBefore(element: Element): string {
  for (let node: Element | null = element; node; node = node.parentElement) {
    const caption = node.matches('table') ? node.querySelector('caption') : null;
    if (caption) return caption.textContent?.trim() ?? '';
    for (let sib = node.previousElementSibling; sib; sib = sib.previousElementSibling) {
      const heading = sib.matches(HEADINGS) ? sib : [...sib.querySelectorAll(HEADINGS)].at(-1);
      if (heading) return heading.textContent?.trim() ?? '';
    }
  }
  return '';
}

/**
 * A header cell's label: the text the page shows, without an update date
 * ("Pat Fitzmaurice 9/23"). Yahoo writes "PositionPos" for a short and a long
 * label, so compare starts.
 */
const label = (cell: Element) => shownText(cell).replace(/\s+\d{1,2}\/\d{1,2}$/, '');
const isPositionHeader = (text: string) => /^(pos|position)/i.test(text);
const isRankHeader = (text: string) => /^(rank|rk|#|ecr|overall|consensus)|\b(rank|rk)$/i.test(text);
/** Columns of whole numbers that are not ranks. */
const NOT_A_RANK = /bye|pts|points|proj|age|yds|yards|td|opp|game|week|salary|\$|exp|years|%/i;

type Table = { header: string[]; rows: Element[][] };

/**
 * The header is the last `<thead>` row, else a row of `<th>` cells, else a
 * first row with no number in it (RotoBaller writes its header in `<td>`
 * cells). A table with none of these has empty labels (NBC Sports).
 */
function readTable(table: HTMLTableElement): Table | undefined {
  const first = table.rows[0];
  if (!first) return undefined;
  const headRow =
    table.tHead?.rows[table.tHead.rows.length - 1] ??
    [...table.rows].find((r) => r.querySelector('th') && !r.querySelector('td')) ??
    ([...first.cells].every((c) => !/^\d+$/.test(label(c))) ? first : undefined);
  const header = headRow ? [...headRow.cells].map(label) : [...first.cells].map(() => '');
  const rows = [...table.rows]
    .filter((r) => r !== headRow && r.parentElement !== table.tHead && r.cells.length === header.length)
    .map((r) => [...r.cells]);
  return { header, rows };
}

/**
 * Columns whose cells are whole numbers that read as ranks: almost all
 * different (a bye week repeats) and none far beyond the row count.
 */
function rankColumns({ header, rows }: Table): number[] {
  return header.flatMap((name, col) => {
    if (NOT_A_RANK.test(name)) return [];
    const values = rows.map((r) => (r[col]?.textContent ?? '').trim());
    const numbers = values.filter((v) => /^\d{1,3}$/.test(v)).map(Number);
    if (numbers.length < Math.max(2, rows.length * 0.8)) return [];
    const distinct = new Set(numbers).size;
    // A later page of a list starts past 1 (51, 52, …), so measure the spread, not the values.
    const min = Math.min(...numbers);
    const plausible = min >= 1 && Math.max(...numbers) - min < rows.length * 2;
    return distinct >= numbers.length * 0.9 && plausible ? [col] : [];
  });
}

/**
 * The name of a rank column. "ECR" is the consensus. A generic rank ("Rank",
 * "#", "RB Rank") is the consensus beside columns named for rankers, else the
 * page's own ranker.
 */
function rankerName(header: string, besideNamed: boolean, pageRanker: string): string {
  if (/^(ecr|consensus)/i.test(header)) return 'Consensus';
  if (header && !isRankHeader(header)) return header;
  return besideNamed ? 'Consensus' : pageRanker;
}

/**
 * Reads the ranked lists the page's marks sit in: tables with rank columns,
 * numbered lists, and runs of "1. Name, TEAM" entries. Prose mentions are left out.
 */
export function readLists(
  root: Element,
  marks: readonly HTMLElement[],
  context: { pageRanker: string; pageFormat?: ScoringFormat },
): RankedList[] {
  const byContainer = new Map<Element, HTMLElement[]>();
  for (const mark of marks) {
    const container = mark.closest('table') ?? mark.closest('ol') ?? numberedRun(mark);
    if (container && root.contains(container)) {
      byContainer.set(container, [...(byContainer.get(container) ?? []), mark]);
    }
  }

  // Infinite-scroll pages append more articles below the one the user opened.
  // The first article with a list is that one; lists in later articles are left out.
  const mainArticle = [...byContainer.keys()].map((c) => c.closest('article')).find(Boolean);
  for (const container of byContainer.keys()) {
    const article = container.closest('article');
    if (article && article !== mainArticle) byContainer.delete(container);
  }

  return [...byContainer].flatMap(([container, containerMarks]) => {
    const heading = headingBefore(container);
    const format = formatIn(heading) ?? context.pageFormat;
    const list =
      container.matches('table')
        ? tableList(container as HTMLTableElement, containerMarks, heading, context.pageRanker)
        : numberedList(container, containerMarks, heading, context.pageRanker);
    return list && list.rankers.some((r) => Object.keys(r.ranks).length) ? [{ ...list, format }] : [];
  });
}

function tableList(
  table: HTMLTableElement,
  marks: readonly HTMLElement[],
  heading: string,
  pageRanker: string,
): Omit<RankedList, 'format'> | undefined {
  const parsed = readTable(table);
  if (!parsed) return undefined;
  const rankCols = rankColumns(parsed);
  // Generic ranks first, so the consensus or the page's own ranker is the default.
  rankCols.sort((a, b) => Number(isRankHeader(parsed.header[b]!)) - Number(isRankHeader(parsed.header[a]!)));
  const besideNamed = rankCols.some((col) => parsed.header[col] && !isRankHeader(parsed.header[col]));
  // Two columns can name one ranker ("RB Rank" and "Overall Rank"): the first counts.
  const columns = rankCols
    .map((col) => ({ col, name: rankerName(parsed.header[col]!, besideNamed, pageRanker) }))
    .filter((c, i, all) => all.findIndex((o) => o.name === c.name) === i);

  // The Pos column shows only the rows the page shows: a 4-row preview of a
  // FLEX list may have no TE. So the heading's positions count too.
  const posCol = parsed.header.findIndex(isPositionHeader);
  const shown = posCol >= 0 ? parsed.rows.flatMap((r) => positionCell(r[posCol]?.textContent ?? '') ?? []) : [];
  const positions = [...new Set([...shown, ...headingPositions(heading)])];

  const rankers: Ranker[] =
    columns.length > 0
      ? columns.map(({ name }) => ({ name, ranks: {} }))
      : // No rank column: the row order is the rank.
        [{ name: pageRanker, ranks: {} }];

  for (const mark of marks) {
    const row = mark.closest('tr');
    if (!row) continue;
    const cells = [...row.children];
    const playerId = mark.dataset.fqLensPlayer!;
    rankers.forEach((ranker, i) => {
      const col = columns[i]?.col;
      const rank = col === undefined ? parsed.rows.findIndex((r) => r[0]?.parentElement === row) + 1 : Number(cells[col]?.textContent?.trim());
      if (Number.isInteger(rank) && rank > 0) ranker.ranks[playerId] ??= rank;
    });
  }
  return { heading, positions, rankers };
}

const LEADING_NUMBER = /^\s*(\d{1,3})\s*[.):-]\s/;

/** The parent of a "1. Name, TEAM" entry, when the mark's entry starts with a number. */
function numberedRun(mark: HTMLElement): Element | undefined {
  const entry = mark.closest('li, p, h1, h2, h3, h4, h5, h6, div');
  return entry && LEADING_NUMBER.test(entry.textContent ?? '') ? entry.parentElement ?? undefined : undefined;
}

function numberedList(
  container: Element,
  marks: readonly HTMLElement[],
  heading: string,
  pageRanker: string,
): Omit<RankedList, 'format'> {
  const ranker: Ranker = { name: pageRanker, ranks: {} };
  const ol = container.matches('ol') ? (container as HTMLOListElement) : undefined;
  const items = ol ? [...ol.children].filter((c) => c.matches('li')) : [];
  for (const mark of marks) {
    const playerId = mark.dataset.fqLensPlayer!;
    const entry = ol ? mark.closest('li') : mark.closest('li, p, h1, h2, h3, h4, h5, h6, div');
    if (!entry) continue;
    const written = LEADING_NUMBER.exec(entry.textContent ?? '')?.[1];
    const rank = written ? Number(written) : items.indexOf(entry) + (ol?.start ?? 1);
    if (rank > 0) ranker.ranks[playerId] ??= rank;
  }
  return { heading, positions: headingPositions(heading), rankers: [ranker] };
}
