import type { Player } from '../players';
import { findPlayers } from './find';
import { clearHighlights, highlight, type MarkKind } from './highlight';

const SELECTOR = 'mark[data-fq-lens]';

/**
 * Marks the players again when the page removes the marks now on it, as a tab
 * click that draws a new table does, and calls `onChanged`. Other changes, like
 * ads, do not count. After a view with none of the players, any change marks
 * again, so the players come back with their tab. Ranks are not read again
 * (ADR-0009). Returns a function that stops watching.
 */
export function keepMarked(
  root: Element,
  players: readonly Player[],
  kind: (playerId: string) => MarkKind | undefined,
  onChanged: () => void,
  delayMs = 300,
): () => void {
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
      clearHighlights(root);
      marks = highlight(findPlayers(root, players), kind);
      observer.observe(root, options);
      if (gone) onChanged();
    }, delayMs);
  });
  observer.observe(root, options);
  return () => {
    observer.disconnect();
    clearTimeout(timer);
  };
}
