const SELECTOR = 'mark[data-fq-lens]';

/**
 * Calls `remark` when the page removes the marks now on it, as a tab click
 * that draws a new table does, with `gone` true. Other changes, like ads, do
 * not count. With no marks, any change calls it, with `gone` false: after a
 * tab without the players, so they come back with their tab, and for `waitMs`
 * after the start, for a page that draws its table after it loads. Returns a
 * function that stops watching.
 */
export function keepMarked(root: Element, remark: (gone: boolean) => void, { delayMs = 300, waitMs = 10_000 } = {}): () => void {
  let marks = [...root.querySelectorAll(SELECTOR)];
  let marked = marks.length > 0;
  const waitUntil = Date.now() + waitMs;
  const options = { childList: true, subtree: true };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const gone = marks.some((m) => !m.isConnected);
      if (marks.length && !gone) return;
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
