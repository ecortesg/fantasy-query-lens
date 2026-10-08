import { browser, defineContentScript } from '#imports';
import { clearHighlights, recolor } from '@/lib/page/highlight';
import { scanPage, type ClearMarks, type KindsUpdate, type PageView, type ScanRequest } from '@/lib/page/scan';
import { keepMarked } from '@/lib/page/watch';

/**
 * Injected by the side panel to read the page. When the page draws new content
 * over the marks, marks the players again and sends the panel what the page
 * now shows (ADR-0010).
 */
export default defineContentScript({
  registration: 'runtime',
  main() {
    // A reload or update of the extension leaves the old script on the page, cut off from the panel.
    const alive = () => !!browser.runtime?.id;
    const page = window as Window & { fqLens?: { alive: () => boolean } };
    if (page.fqLens?.alive()) return;
    page.fqLens = { alive };

    let stopWatching = () => {};
    // The last request, with the panel's latest colors.
    let request: ScanRequest | undefined;
    const remark = (gone: boolean) => {
      if (!request || !alive()) return stopWatching();
      const result = scanPage(document, request);
      // A view with none of the players tells nothing new after the first.
      if (!gone && !result.found.length) return;
      const view: PageView = { type: 'fq-lens:view', result };
      browser.runtime.sendMessage(view).catch(() => {});
    };

    browser.runtime.onMessage.addListener((message: ScanRequest | KindsUpdate | ClearMarks, _sender, sendResponse) => {
      if (message?.type === 'fq-lens:scan') {
        stopWatching();
        request = message;
        const result = scanPage(document, message);
        stopWatching = keepMarked(document.body, remark);
        sendResponse(result);
      } else if (message?.type === 'fq-lens:kinds') {
        if (request) request = { ...request, kinds: message.kinds };
        recolor(document.body, (id) => message.kinds[id]);
      } else if (message?.type === 'fq-lens:clear') {
        stopWatching();
        request = undefined;
        clearHighlights(document.body);
      }
    });
  },
});
