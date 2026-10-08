import { browser, defineContentScript } from '#imports';
import { recolor } from '@/lib/page/highlight';
import { scanPage, type KindsUpdate, type ScanRequest } from '@/lib/page/scan';

/** Injected by the side panel. Scans only when the panel asks (ADR-0009). */
export default defineContentScript({
  registration: 'runtime',
  main() {
    const page = window as Window & { fqLensReady?: true };
    if (page.fqLensReady) return;
    page.fqLensReady = true;

    browser.runtime.onMessage.addListener((message: ScanRequest | KindsUpdate, _sender, sendResponse) => {
      if (message?.type === 'fq-lens:scan') {
        sendResponse(scanPage(document, message));
      } else if (message?.type === 'fq-lens:kinds') {
        recolor(document.body, (id) => message.kinds[id]);
      }
    });
  },
});
