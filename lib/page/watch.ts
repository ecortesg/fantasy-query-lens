/**
 * Calls `onGone` once when the page removes any of the marks now on it, such
 * as on a tab click that draws a new table. Other changes, like ads, do not
 * count. Returns a function that stops watching.
 */
export function watchMarks(root: Element, onGone: () => void, delayMs = 300): () => void {
  const marks = [...root.querySelectorAll('mark[data-fq-lens]')];
  if (!marks.length) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!marks.some((m) => !m.isConnected)) return;
      stop();
      onGone();
    }, delayMs);
  });
  const stop = () => {
    observer.disconnect();
    clearTimeout(timer);
  };
  observer.observe(root, { childList: true, subtree: true });
  return stop;
}
