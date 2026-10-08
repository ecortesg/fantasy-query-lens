import { browser, defineBackground } from '#imports';
import { toolbarClickItem } from '@/lib/scan-client';

/**
 * A toolbar click opens the side panel. The click grants activeTab, so the
 * panel can see the tab's URL and ask for its site at the Scan (ADR-0002).
 */
export default defineBackground(() => {
  // Chrome keeps this setting across updates, and an early build turned it on,
  // which stops onClicked from firing.
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});
  browser.action.onClicked.addListener((tab) => {
    // Opening the panel must happen inside the click, before anything is awaited.
    browser.sidePanel.open({ windowId: tab.windowId });
    if (tab.id !== undefined) toolbarClickItem.setValue({ tabId: tab.id, at: Date.now() });
  });
});
