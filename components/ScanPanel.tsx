import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from '#imports';
import { refreshRoster, type League } from '@/lib/league';
import type { MarkKind } from '@/lib/page/highlight';
import type { ClearMarks, KindsUpdate, PageView, ScanRequest, ScanResult } from '@/lib/page/scan';
import { siteOf, type PageSource } from '@/lib/page/source';
import { availablePlayers } from '@/lib/pickups';
import { forgetSite, listsFromSource, saveScan, scansItem, type StoredList } from '@/lib/scans';
import type { Player } from '@/lib/players';
import { LineupView } from './LineupView';
import { RosterSection, SourceCard } from './ui';
import { useStorageItem } from './use-storage-item';
import { ALL_SITES, scanRequestItem, scanTab, sitePattern } from '@/lib/scan-client';

/** A toolbar click this recent still asks the panel to scan when the panel opens. */
const FRESH_REQUEST_MS = 10_000;
/** The button shows its busy state at least this long, so a fast Scan still shows a reaction. */
const MIN_BUSY_MS = 400;

type Props = { league: League; leagues: readonly League[]; byId: ReadonlyMap<string, Player> };

/** What a tab showed when it was last read. */
type Read = { tabId: number; result: ScanResult };

/**
 * The panel follows the active tab. On a site the user scanned, it reads each
 * page and tab the user opens like a Scan: it marks the players and keeps the
 * lists, so the Lineup for the page's site and week grows and stays current.
 * Elsewhere, such as on Sleeper, the last Lineup stays (ADR-0010).
 */
export function ScanPanel({ league, leagues, byId }: Props) {
  const stored = useStorageItem(scansItem);
  const [read, setRead] = useState<Read>();
  /** The Source of the last Lineup shown, kept on pages the panel cannot read. */
  const [lastSource, setLastSource] = useState<PageSource>();
  const [activeTab, setActiveTab] = useState<number>();
  const [scanning, setScanning] = useState(false);
  /** The user's last Scan could not read the page. */
  const [blocked, setBlocked] = useState(false);
  /** The site pattern to offer access for, once a toolbar Scan showed us the URL. */
  const [askFor, setAskFor] = useState<string>();

  // The latest values, read by listeners and scans they start.
  const leagueRef = useRef(league);
  leagueRef.current = league;
  const leaguesRef = useRef(leagues);
  leaguesRef.current = leagues;
  const storedRef = useRef(stored);
  storedRef.current = stored;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const readRef = useRef(read);
  readRef.current = read;
  // The Lineup's latest colors, so a page is marked in them from the start.
  const kindsRef = useRef<Record<string, MarkKind> | undefined>(undefined);
  // Only the latest scan may write its result; an older one that ends later is dropped.
  const latestScan = useRef(0);
  // The latest Scan that shows the busy state; a quiet one does not count.
  const latestShown = useRef(0);
  const windowId = useRef<number | undefined>(undefined);
  useEffect(() => {
    browser.windows.getCurrent().then((w) => (windowId.current = w.id));
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => setActiveTab(tab?.id));
  }, []);

  // Every League's players, so the kept lists hold ranks for all of them,
  // then the active League's available players, for its Pickups (ADR-0006).
  // Only the active League's Roster is colored.
  const requestFor = useCallback(async (): Promise<ScanRequest> => {
    const current = await refreshRoster(leagueRef.current);
    const ids = new Set([...leaguesRef.current.filter((l) => l.id !== current.id), current].flatMap((l) => l.roster.map((e) => e.playerId)));
    const available = availablePlayers(current, byId.values()).filter((p) => !ids.has(p.id));
    return {
      type: 'fq-lens:scan',
      players: [...[...ids].flatMap((pid) => byId.get(pid) ?? []), ...available],
      kinds: kindsRef.current ?? Object.fromEntries(current.roster.map((e) => [e.playerId, 'bench'])),
    };
  }, [byId]);

  const keep = (result: ScanResult) => saveScan(result).catch((e) => console.error('Lens: could not keep the lists', e));

  const scan = useCallback(
    async (target?: number, { quiet = false } = {}) => {
      const id = target ?? (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;
      if (id === undefined) return;
      const run = ++latestScan.current;
      const started = Date.now();
      const shown = quiet ? 0 : ++latestShown.current;
      if (!quiet) {
        setScanning(true);
        setBlocked(false);
      }
      try {
        const next = await scanTab(id, await requestFor());
        if (next.kind === 'done') await keep(next.result);
        if (run !== latestScan.current) return;
        if (next.kind === 'no-access') {
          if (!quiet) setBlocked(true);
          return;
        }
        const pattern = sitePattern(next.result.url);
        const allowed = pattern && (await browser.permissions.contains({ origins: [pattern] }));
        if (run !== latestScan.current) return;
        setRead({ tabId: id, result: next.result });
        setAskFor(allowed ? undefined : pattern);
      } finally {
        if (!quiet) {
          await new Promise((r) => setTimeout(r, MIN_BUSY_MS - (Date.now() - started)));
          if (shown === latestShown.current) setScanning(false);
        }
      }
    },
    [requestFor],
  );

  /** Scans a page of a site the user scanned, with no click. With no access, Chrome lets no script in. */
  const look = useCallback(
    async (tabId: number) => {
      const tab = await browser.tabs.get(tabId).catch(() => undefined);
      const site = siteOf(tab?.url);
      if (!site || !storedRef.current?.some((l) => l.site === site)) return;
      const next = await scanTab(tabId, await requestFor());
      if (next.kind !== 'done') return;
      await keep(next.result);
      if (tabId === activeTabRef.current) setRead({ tabId, result: next.result });
    },
    [requestFor],
  );

  // A toolbar click, now or just before the panel opened.
  useEffect(() => {
    scanRequestItem.getValue().then((req) => {
      if (req && Date.now() - req.at < FRESH_REQUEST_MS) scan(req.tabId);
    });
    return scanRequestItem.watch((req) => req && scan(req.tabId));
  }, [scan]);

  // The page in front: read it once the kept lists are loaded.
  const loaded = stored !== undefined;
  useEffect(() => {
    if (loaded && activeTab !== undefined) look(activeTab);
  }, [loaded, activeTab, look]);

  // Which tab is in front, and its loads.
  useEffect(() => {
    const onActivated = ({ tabId: id, windowId: win }: { tabId: number; windowId: number }) => {
      if (win !== windowId.current) return;
      setActiveTab(id);
      setBlocked(false);
    };
    const forget = (id: number) => setRead((r) => (r?.tabId === id ? undefined : r));
    const onUpdated = (id: number, change: { status?: string }) => {
      if (change.status === 'loading') forget(id);
      else if (change.status === 'complete' && id === activeTabRef.current) look(id);
    };
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(forget);
    return () => {
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(forget);
    };
  }, [look]);

  // The page in front drew new content, such as on a tab click, and read it again.
  useEffect(() => {
    const onMessage = (message: PageView, sender: { tab?: { id?: number } }) => {
      const id = sender.tab?.id;
      if (message?.type !== 'fq-lens:view' || id === undefined || id !== activeTabRef.current) return;
      keep(message.result).then(() => setRead({ tabId: id, result: message.result }));
    };
    browser.runtime.onMessage.addListener(onMessage);
    return () => browser.runtime.onMessage.removeListener(onMessage);
  }, []);

  // Another League: scan the page in front again for its Roster and Pickups (ADR-0007).
  useEffect(() => {
    const r = readRef.current;
    if (r && r.tabId === activeTabRef.current) scan(r.tabId, { quiet: true });
  }, [league.id]); // Only a League change triggers this.

  const kept = stored ?? [];
  const onPage = read !== undefined && read.tabId === activeTab;
  const pageSource = onPage ? read.result.source : undefined;
  const pageHasLists = !!pageSource && listsFromSource(kept, pageSource.site, pageSource.week).length > 0;
  const source = pageSource ?? lastSource;
  useEffect(() => {
    if (loaded) setLastSource((s) => s ?? latestSource(storedRef.current ?? []));
  }, [loaded]);
  useEffect(() => {
    if (pageHasLists) setLastSource(pageSource);
  }, [pageHasLists, pageSource]);

  const sendKinds = useCallback(
    (kinds: Record<string, MarkKind>) => {
      kindsRef.current = kinds;
      const r = readRef.current;
      if (r && r.tabId === activeTabRef.current) sendKindsTo(r.tabId, kinds);
    },
    [],
  );

  // The site's lists and marks go, and Lens waits for a Scan there again.
  const forget = (site: string) => {
    forgetSite(site);
    if (read && read.result.source.site === site) {
      const clear: ClearMarks = { type: 'fq-lens:clear' };
      browser.tabs.sendMessage(read.tabId, clear).catch(() => {});
      setRead(undefined);
    }
    kindsRef.current = undefined;
    setLastSource(undefined);
  };

  /** Resolves true when the user granted access. */
  const allow = async (origins: string[]) => {
    const granted = await browser.permissions.request({ origins });
    if (granted) setAskFor(undefined);
    return granted;
  };

  // "Rescan" on a site the user scanned, "Scan page" elsewhere.
  const siteScanned = onPage && kept.some((l) => l.site === read.result.source.site);
  const scanButton = (
    // The spinner covers the label, so the button keeps its width and the title does not wrap.
    <button className="btn relative shrink-0" disabled={scanning} aria-busy={scanning} onClick={() => scan()}>
      <span className={scanning ? 'invisible' : undefined}>{siteScanned ? 'Rescan' : 'Scan page'}</span>
      {scanning && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
    </button>
  );
  const allowAll = (
    <button
      className="shrink-0 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium"
      onClick={async () => (await allow(ALL_SITES)) && scan()}
    >
      Allow all sites
    </button>
  );
  const allowCard = askFor && (
    <div className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-xs text-neutral-600">
      <p className="flex-1">Keep Lens on {new URL(askFor.replace('/*', '')).host}: highlights on its other pages and after a reload.</p>
      <button className="rounded-md border border-neutral-300 px-2.5 py-1 font-medium text-neutral-900" onClick={() => allow([askFor])}>
        Allow
      </button>
    </div>
  );

  if (source)
    return (
      <>
        {/* The Lineup stays below: this page was not read. */}
        {blocked && (
          <div className="flex items-center gap-3 border-t border-neutral-200 bg-amber-50 px-3 py-2 text-xs text-neutral-700">
            <p className="flex-1">Lens cannot read this page. Click the Lens icon in the toolbar to scan it.</p>
            {allowAll}
          </div>
        )}
        <LineupView
          league={league}
          byId={byId}
          source={source}
          page={onPage ? read.result : undefined}
          stored={kept}
          onKinds={sendKinds}
          onForget={() => forget(source.site)}
          action={scanButton}
        >
          {allowCard}
        </LineupView>
      </>
    );

  return (
    <>
      {blocked ? (
        <SourceCard title="Lens cannot read this page" line="Click the Lens icon in the toolbar to scan it." action={allowAll} />
      ) : scanning ? (
        <SourceCard title="Reading the page…" line="Your players, then the ranks." action={scanButton} />
      ) : (
        <SourceCard title="No scan yet" line="Open a rankings page, then scan it." action={scanButton} />
      )}
      <div className="space-y-6 px-3 py-3">
        <RosterSection league={league} byId={byId} />
      </div>
    </>
  );
}

/** The Source of the newest kept list, for a panel that opens on a page it cannot read. */
function latestSource(kept: readonly StoredList[]): PageSource | undefined {
  const newest = kept.reduce<StoredList | undefined>((a, l) => (!a || l.scannedAt > a.scannedAt ? l : a), undefined);
  return newest && { site: newest.site, siteName: newest.siteName, week: newest.week };
}

const Spinner = () => (
  <svg viewBox="0 0 16 16" className="size-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M8 2a6 6 0 1 1-6 6" strokeLinecap="round" />
  </svg>
);

function sendKindsTo(tabId: number, kinds: Record<string, MarkKind>) {
  const update: KindsUpdate = { type: 'fq-lens:kinds', kinds };
  browser.tabs.sendMessage(tabId, update).catch(() => {});
}
