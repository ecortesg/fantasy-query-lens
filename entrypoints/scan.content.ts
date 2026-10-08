import { browser, defineContentScript } from '#imports';
import { clearHighlights, recolor, type MarkKind } from '@/lib/page/highlight';
import { scanPage, type ClearMarks, type KindsUpdate, type PageChanged, type ScanRequest } from '@/lib/page/scan';
import { keepMarked } from '@/lib/page/watch';

/**
 * Injected by the side panel. Scans only when the panel asks (ADR-0009). When
 * the page removes the Scan's marks, marks the players again and tells the panel.
 */
export default defineContentScript({
  registration: 'runtime',
  main() {
    const page = window as Window & { fqLensReady?: true };
    if (page.fqLensReady) return;
    page.fqLensReady = true;

    let stopWatching = () => {};
    // The latest colors from the panel, for marks made again.
    let kinds: Record<string, MarkKind> = {};
    const tellChanged = () => {
      // A reload or update of the extension leaves this script on the page, and sendMessage then throws.
      if (!browser.runtime?.id) return stopWatching();
      const changed: PageChanged = { type: 'fq-lens:changed' };
      browser.runtime.sendMessage(changed).catch(() => {});
    };

    browser.runtime.onMessage.addListener((message: ScanRequest | KindsUpdate | ClearMarks, _sender, sendResponse) => {
      if (message?.type === 'fq-lens:scan') {
        stopWatching();
        const result = scanPage(document, message);
        kinds = message.kinds;
        stopWatching = keepMarked(document.body, message.players, (id) => kinds[id], tellChanged);
        sendResponse(result);
      } else if (message?.type === 'fq-lens:kinds') {
        kinds = message.kinds;
        recolor(document.body, (id) => kinds[id]);
      } else if (message?.type === 'fq-lens:clear') {
        stopWatching();
        clearHighlights(document.body);
      }
    });
  },
});
