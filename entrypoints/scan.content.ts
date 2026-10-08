import { browser, defineContentScript } from '#imports';
import { recolor } from '@/lib/page/highlight';
import { scanPage, type KindsUpdate, type PageChanged, type ScanRequest } from '@/lib/page/scan';
import { watchMarks } from '@/lib/page/watch';

/**
 * Injected by the side panel. Scans only when the panel asks (ADR-0009), then
 * tells the panel once if the page removes the Scan's marks.
 */
export default defineContentScript({
  registration: 'runtime',
  main() {
    const page = window as Window & { fqLensReady?: true };
    if (page.fqLensReady) return;
    page.fqLensReady = true;

    let stopWatching = () => {};
    const tellChanged = () => {
      // A reload or update of the extension leaves this script on the page, and sendMessage then throws.
      if (!browser.runtime?.id) return;
      const changed: PageChanged = { type: 'fq-lens:changed' };
      browser.runtime.sendMessage(changed).catch(() => {});
    };

    browser.runtime.onMessage.addListener((message: ScanRequest | KindsUpdate, _sender, sendResponse) => {
      if (message?.type === 'fq-lens:scan') {
        stopWatching();
        const result = scanPage(document, message);
        stopWatching = watchMarks(document.body, tellChanged);
        sendResponse(result);
      } else if (message?.type === 'fq-lens:kinds') {
        recolor(document.body, (id) => message.kinds[id]);
      }
    });
  },
});
