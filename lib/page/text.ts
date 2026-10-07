/** Tags that flow inside a line of text. A custom element is inline too, as browsers show it by default. */
const INLINE = new Set([
  'A', 'ABBR', 'B', 'BDI', 'BDO', 'CITE', 'CODE', 'DATA', 'DFN', 'EM', 'FONT', 'I', 'KBD', 'LABEL',
  'MARK', 'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR',
]);
const isInline = (el: Element) => INLINE.has(el.tagName) || el.tagName.includes('-');

/**
 * The text nodes under `root`, in runs that read as one line: the pieces
 * inside one element that is not inline. "<a><span>J</span><span>osh</span>
 * Allen</a>" is one run; two table cells are two.
 */
export function textRuns(root: Element, accept: (node: Text) => boolean): Text[][] {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (accept(node as Text) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const runs: Text[][] = [];
  let block: Element | null = null;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    let el = node.parentElement;
    while (el && el !== root && isInline(el)) el = el.parentElement;
    if (el === block) runs.at(-1)!.push(node);
    else runs.push([node]);
    block = el;
  }
  return runs;
}

/**
 * Whether the page shows a text node, as far as the elements between it and
 * the first `stop` element decide. Remembers each answer, as styles cost time.
 */
export function shownCheck(stop: (el: Element) => boolean): (node: Text) => boolean {
  const known = new Map<Element, boolean>();
  const shown = (el: Element | null): boolean => {
    if (!el || stop(el)) return true;
    let answer = known.get(el);
    if (answer === undefined) {
      const style = el.ownerDocument.defaultView!.getComputedStyle(el);
      answer = style.display !== 'none' && style.visibility !== 'hidden' && shown(el.parentElement);
      known.set(el, answer);
    }
    return answer;
  };
  return (node) => shown(node.parentElement);
}

/**
 * Whether no inline element between a text node and its block hides it: all
 * that decides how the pieces of a run join. Cheaper than a check up to the root.
 */
export const shownInRun = () => shownCheck((el) => !isInline(el));

/** The text the page shows in an element, as one line. */
export function shownText(element: Element): string {
  return textRuns(element, shownCheck((el) => el === element))
    .map((run) => run.map((node) => node.data).join(''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}
