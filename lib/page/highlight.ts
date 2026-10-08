import type { Hit, Part } from './find';

/**
 * Suggested starters get the strong color, the rest of the active League's
 * Roster the light one. Its Pickups get an outline with no fill, as they
 * are not the user's yet.
 * Players of the user's other Leagues and other available players are marked
 * with no color, so the Scan still reads their ranks.
 */
export type MarkKind = 'starter' | 'bench' | 'pickup' | 'other';

/** The marks' looks. The panel's badges use them too, so a badge reads like its mark. */
export const markStyles = {
  starter: { background: '#fcd34d' },
  bench: { background: '#fef3c7' },
  pickup: { outline: '2px solid #f59e0b', boxShadow: 'none' },
} as const satisfies Partial<Record<MarkKind, { background?: string; outline?: string; boxShadow?: string }>>;

const STYLE_ID = 'fq-lens-style';
// Dark text on a colored mark, so light text on a dark page stays readable. `!important` beats a site's `a *` rules.
// No padding, as some sites pad `mark`, so the page keeps its layout.
const CSS = `
mark[data-fq-lens] { color: inherit; padding: 0; border-radius: 2px; box-shadow: 0 0 0 1px rgb(0 0 0 / 0.15); }
mark[data-fq-lens="starter"], mark[data-fq-lens="bench"] { color: #171717 !important; }
mark[data-fq-lens="starter"] { background: ${markStyles.starter.background}; }
mark[data-fq-lens="bench"] { background: ${markStyles.bench.background}; }
mark[data-fq-lens="pickup"] { background: none; box-shadow: none; outline: ${markStyles.pickup.outline}; }
mark[data-fq-lens="other"] { background: none; box-shadow: none; }
mark[data-fq-lens-piece] { border-radius: 0; box-shadow: none; }
`;

/** Wraps each part of each hit in a mark. Returns the marks in page order. */
export function highlight(hits: readonly Hit[], kindOf: (playerId: string) => MarkKind | undefined): HTMLElement[] {
  const doc = hits[0]?.parts[0]!.node.ownerDocument;
  if (!doc) return [];
  if (!doc.getElementById(STYLE_ID)) {
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    doc.head.append(style);
  }

  const parts = hits.flatMap((hit) => hit.parts.map((part) => ({ ...part, player: hit.player, piece: hit.parts.length > 1 })));
  const marks = new Map<Part, HTMLElement>();
  // Split from the end of each text node first, so earlier offsets stay valid.
  const byNode = Map.groupBy(parts, (part) => part.node);
  for (const [node, nodeParts] of byNode) {
    for (const part of nodeParts.toSorted((a, b) => b.start - a.start)) {
      node.splitText(part.end);
      const text = node.splitText(part.start);
      const mark = doc.createElement('mark');
      mark.dataset.fqLens = kindOf(part.player.id) ?? 'other';
      mark.dataset.fqLensPlayer = part.player.id;
      // Pieces of a split name, with no outline between them, so they read as one mark.
      if (part.piece) mark.dataset.fqLensPiece = '';
      text.replaceWith(mark);
      mark.append(text);
      marks.set(part, mark);
    }
  }
  return parts.map((part) => marks.get(part)!);
}

/** Changes the colors of existing marks without scanning again. */
export function recolor(root: Element, kindOf: (playerId: string) => MarkKind | undefined): void {
  for (const mark of root.querySelectorAll<HTMLElement>('mark[data-fq-lens]')) {
    mark.dataset.fqLens = kindOf(mark.dataset.fqLensPlayer!) ?? 'other';
  }
}

export function clearHighlights(root: Element): void {
  for (const mark of root.querySelectorAll('mark[data-fq-lens]')) {
    const parent = mark.parentNode;
    mark.replaceWith(...mark.childNodes);
    parent?.normalize();
  }
}
