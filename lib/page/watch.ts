const SELECTOR = 'mark[data-fq-lens]';

/**
 * Calls `remark` when the page removes the marks now on it, as a tab click
 * that draws a new table does, with `gone` true. Other changes, like ads, do
 * not count. After a view with no marks, any change calls it, with `gone`
 * false, so the players come back with their tab. Returns a function that stops
 * watching.
 */
export function keepMarked(root: Element, remark: (gone: boolean) => void, delayMs = 300): () => void {
  let marks = [...root.querySelectorAll(SELECTOR)];
  if (!marks.length) return () => {};
  const options = { childList: true, subtree: true };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const gone = marks.some((m) => !m.isConnected);
      if (marks.length && !gone) return;
      // Our own marks are not changes of the page.
      observer.disconnect();
      remark(gone);
      marks = [...root.querySelectorAll(SELECTOR)];
      observer.observe(root, options);
    }, delayMs);
  });
  observer.observe(root, options);
  return () => {
    observer.disconnect();
    clearTimeout(timer);
  };
}
