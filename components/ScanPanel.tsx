import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from '#imports';
import { refreshRoster, type League } from '@/lib/league';
import type { MarkKind } from '@/lib/page/highlight';
import type { KindsUpdate, ScanRequest, ScanResult } from '@/lib/page/scan';
import { availablePlayers } from '@/lib/pickups';
import { saveScan, scansItem } from '@/lib/scans';
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

/**
 * The last Scan stays when the user goes to another tab or page, or changes the
 * page, until they scan again (ADR-0007, ADR-0009).
 */
export function ScanPanel({ league, leagues, byId }: Props) {
  const stored = useStorageItem(scansItem);
  const [result, setResult] = useState<ScanResult>();
  /** The tab of `result`, and whether it still shows that page. */
  const [scanned, setScanned] = useState<{ tabId: number; gone: boolean }>();
  const [activeTab, setActiveTab] = useState<number>();
  const [scanning, setScanning] = useState(false);
  /** The user's last Scan could not read the page. */
  const [blocked, setBlocked] = useState(false);
  /** The site pattern to offer access for, once a toolbar Scan showed us the URL. */
  const [askFor, setAskFor] = useState<string>();

  // The latest League, read by scans that listeners start.
  const leagueRef = useRef(league);
  leagueRef.current = league;
  const leaguesRef = useRef(leagues);
  leaguesRef.current = leagues;
  // The Lineup's latest colors. A scan paints its own defaults, so it sends these again when it ends.
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
        const current = await refreshRoster(leagueRef.current);
        // Every League's players, so the kept lists hold ranks for all of them,
        // then the active League's available players, for its Pickups (ADR-0006).
        // Only the active League's Roster is colored.
        const ids = new Set([...leaguesRef.current.filter((l) => l.id !== current.id), current].flatMap((l) => l.roster.map((e) => e.playerId)));
        const available = availablePlayers(current, byId.values()).filter((p) => !ids.has(p.id));
        const request: ScanRequest = {
          type: 'fq-lens:scan',
          players: [...[...ids].flatMap((pid) => byId.get(pid) ?? []), ...available],
          kinds: Object.fromEntries(current.roster.map((e) => [e.playerId, 'bench'])),
        };
        const next = await scanTab(id, request);
        if (next.kind === 'done') {
          await saveScan(next.result).catch((e) => console.error('Lens: could not keep the lists', e));
          if (run === latestScan.current && kindsRef.current) sendKindsTo(id, kindsRef.current);
        }
        if (run !== latestScan.current) return;
        if (next.kind === 'no-access') {
          if (!quiet) setBlocked(true);
          return;
        }
        const pattern = sitePattern(next.result.url);
        const allowed = pattern && (await browser.permissions.contains({ origins: [pattern] }));
        if (run !== latestScan.current) return;
        setResult(next.result);
        setScanned({ tabId: id, gone: false });
        setAskFor(allowed ? undefined : pattern);
      } finally {
        if (!quiet) {
          await new Promise((r) => setTimeout(r, MIN_BUSY_MS - (Date.now() - started)));
          if (shown === latestShown.current) setScanning(false);
        }
      }
    },
    [byId],
  );

  // A toolbar click, now or just before the panel opened.
  useEffect(() => {
    scanRequestItem.getValue().then((req) => {
      if (req && Date.now() - req.at < FRESH_REQUEST_MS) scan(req.tabId);
    });
    return scanRequestItem.watch((req) => req && scan(req.tabId));
  }, [scan]);

  // Which tab the button scans, and whether the scanned page is still there. Neither scans.
  useEffect(() => {
    const onActivated = ({ tabId: id, windowId: win }: { tabId: number; windowId: number }) => {
      if (win !== windowId.current) return;
      setActiveTab(id);
      setBlocked(false);
    };
    const onGone = (id: number) => setScanned((s) => (s?.tabId === id ? { ...s, gone: true } : s));
    const onUpdated = (id: number, change: { status?: string }) => change.status === 'loading' && onGone(id);
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(onGone);
    return () => {
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(onGone);
    };
  }, []);

  // Another League: scan the scanned page again for its Roster and Pickups, if it is still there.
  useEffect(() => {
    if (scanned && !scanned.gone) scan(scanned.tabId, { quiet: true });
  }, [league.id]); // Only a League change triggers this.

  const scannedTab = scanned?.tabId;
  const sendKinds = useCallback(
    (kinds: Record<string, MarkKind>) => {
      kindsRef.current = kinds;
      if (scannedTab !== undefined) sendKindsTo(scannedTab, kinds);
    },
    [scannedTab],
  );

  /** Resolves true when the user granted access. */
  const allow = async (origins: string[]) => {
    const granted = await browser.permissions.request({ origins });
    if (granted) setAskFor(undefined);
    return granted;
  };

  const onScannedPage = scanned && !scanned.gone && scanned.tabId === activeTab;
  const scanButton = (
    // The spinner covers the label, so the button keeps its width and the title does not wrap.
    <button className="btn relative shrink-0" disabled={scanning} aria-busy={scanning} onClick={() => scan()}>
      <span className={scanning ? 'invisible' : undefined}>{onScannedPage ? 'Rescan' : 'Scan page'}</span>
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
      <p className="flex-1">Rescan {new URL(askFor.replace('/*', '')).host} from the panel without the toolbar icon.</p>
      <button className="rounded-md border border-neutral-300 px-2.5 py-1 font-medium text-neutral-900" onClick={() => allow([askFor])}>
        Allow
      </button>
    </div>
  );

  if (result)
    return (
      <>
        {/* The last Scan stays below: this page was not read. */}
        {blocked && (
          <div className="flex items-center gap-3 border-t border-neutral-200 bg-amber-50 px-3 py-2 text-xs text-neutral-700">
            <p className="flex-1">Lens cannot read this page. Click the Lens icon in the toolbar to scan it.</p>
            {allowAll}
          </div>
        )}
        <LineupView league={league} byId={byId} result={result} stored={stored ?? []} onKinds={sendKinds} action={scanButton}>
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

const Spinner = () => (
  <svg viewBox="0 0 16 16" className="size-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M8 2a6 6 0 1 1-6 6" strokeLinecap="round" />
  </svg>
);

function sendKindsTo(tabId: number, kinds: Record<string, MarkKind>) {
  const update: KindsUpdate = { type: 'fq-lens:kinds', kinds };
  browser.tabs.sendMessage(tabId, update).catch(() => {});
}
