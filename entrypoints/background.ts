import { browser, defineBackground } from '#imports';
import { scanRequestItem } from '@/lib/scan-client';

/**
 * A toolbar click opens the side panel and asks it to scan the tab. The click
 * grants activeTab, so this Scan needs no site permission (ADR-0002).
 */
export default defineBackground(() => {
  // Chrome keeps this setting across updates, and an early build turned it on,
  // which stops onClicked from firing.
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  browser.action.onClicked.addListener((tab) => {
    // Opening the panel must happen inside the click, before anything is awaited.
    browser.sidePanel.open({ windowId: tab.windowId });
    if (tab.id !== undefined) scanRequestItem.setValue({ tabId: tab.id, at: Date.now() });
  });
});
