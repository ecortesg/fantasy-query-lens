import { browser, defineContentScript } from '#imports';
import { recolor } from '@/lib/page/highlight';
import { scanPage, type KindsUpdate, type ScanRequest, type ScanUpdate } from '@/lib/page/scan';

const RESCAN_DELAY_MS = 500;

/**
 * Injected by the side panel. Answers Scan requests and, after the first one,
 * scans again when the page changes (a Yahoo tab click, a sort) and tells the
 * panel. It stops watching once the panel or the extension is gone.
 */
export default defineContentScript({
  registration: 'runtime',
  main() {
    const page = window as Window & { fqLensReady?: true };
    if (page.fqLensReady) return;
    page.fqLensReady = true;

    let request: ScanRequest | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        // A reload or update of the extension leaves this script on the page, and
        // sendMessage then throws instead of rejecting. The id is gone after that.
        if (!browser.runtime?.id) return observer.disconnect();
        const update: ScanUpdate = { type: 'fq-lens:update', result: scan() };
        browser.runtime.sendMessage(update).catch(() => observer.disconnect());
      }, RESCAN_DELAY_MS);
    });

    // Our own marks change the page too, so stop watching while we write them.
    const quietly = <T>(write: () => T): T => {
      observer.disconnect();
      const out = write();
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      return out;
    };
    const scan = () => quietly(() => scanPage(document, request!));

    browser.runtime.onMessage.addListener((message: ScanRequest | KindsUpdate, _sender, sendResponse) => {
      if (message?.type === 'fq-lens:scan') {
        request = message;
        sendResponse(scan());
      } else if (message?.type === 'fq-lens:kinds' && request) {
        request = { ...request, kinds: message.kinds };
        quietly(() => recolor(document.body, (id) => message.kinds[id]));
      }
    });
  },
});
