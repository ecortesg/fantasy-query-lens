import { browser, storage } from '#imports';
import type { ScanRequest, ScanResult } from './page/scan';

/** Set by a toolbar click. The click grants activeTab, so the panel can now see that tab's URL and ask for its site. */
export const toolbarClickItem = storage.defineItem<{ tabId: number; at: number } | null>('session:toolbarClick', {
  fallback: null,
});

export type ScanOutcome = { kind: 'done'; result: ScanResult } | { kind: 'no-access' };

/** Injects the scan script (a no-op when it is already there) and asks it to scan. */
export async function scanTab(tabId: number, request: ScanRequest): Promise<ScanOutcome> {
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: ['/content-scripts/scan.js'] });
  } catch {
    return { kind: 'no-access' };
  }
  // The page can navigate away between the injection and the message.
  const result = (await browser.tabs.sendMessage(tabId, request).catch(() => undefined)) as
    | ScanResult
    | undefined;
  return result ? { kind: 'done', result } : { kind: 'no-access' };
}

/** The `https://host/*` pattern for a URL, or undefined for pages no extension may read. */
export function sitePattern(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const { protocol, host } = new URL(url);
  return protocol === 'https:' || protocol === 'http:' ? `${protocol}//${host}/*` : undefined;
}

export const ALL_SITES = ['https://*/*', 'http://*/*'];
