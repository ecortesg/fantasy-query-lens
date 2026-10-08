const SELECTOR = 'mark[data-fq-lens]';

/**
 * Calls `remark` when the page removes the marks now on it, as a tab click
 * that draws a new table does, with `gone` true. A change inside a table calls
 * it too, with `gone` false: a tab can come back while another table keeps its
 * marks, as Yahoo's PPR table does beside the Half-PPR one. Other changes, like
 * ads, do not count. With no marks, any change calls it: after a tab without
 * the players, and for `waitMs` after the start, for a page that draws its
 * table after it loads. Returns a function that stops watching.
 */
export function keepMarked(root: Element, remark: (gone: boolean) => void, { delayMs = 300, waitMs = 10_000 } = {}): () => void {
  let marks = [...root.querySelectorAll(SELECTOR)];
  let marked = marks.length > 0;
  const waitUntil = Date.now() + waitMs;
  const options = { childList: true, subtree: true };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let tableChanged = false;
  const observer = new MutationObserver((records) => {
    tableChanged ||= records.some(touchesTable);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const gone = marks.some((m) => !m.isConnected);
      if (marks.length && !gone && !tableChanged) return;
      tableChanged = false;
      if (!marked && Date.now() > waitUntil) return stop();
      // Our own marks are not changes of the page.
      observer.disconnect();
      remark(gone);
      marks = [...root.querySelectorAll(SELECTOR)];
      marked ||= marks.length > 0;
      observer.observe(root, options);
    }, delayMs);
  });
  const stop = () => {
    observer.disconnect();
    clearTimeout(timer);
  };
  observer.observe(root, options);
  return stop;
}

const ELEMENT = 1;
const isTable = (node: Node) => node.nodeType === ELEMENT && ((node as Element).matches('table') || !!(node as Element).querySelector('table'));

/** A change in a table's rows, or a table that came or went. */
function touchesTable(record: MutationRecord): boolean {
  const target = record.target.nodeType === ELEMENT ? (record.target as Element) : record.target.parentElement;
  return !!target?.closest('table') || [...record.addedNodes, ...record.removedNodes].some(isTable);
}
