import { useEffect, useMemo, useState } from 'react';
import { LeagueMenu } from '@/components/LeagueMenu';
import { ManualLeague } from '@/components/ManualLeague';
import { ScanPanel } from '@/components/ScanPanel';
import { SleeperImport } from '@/components/SleeperImport';
import { Band, Card } from '@/components/ui';
import { useStorageItem } from '@/components/use-storage-item';
import { activeLeagueIdItem, byName, leaguesItem, type League } from '@/lib/league';
import { loadPlayers, type Player } from '@/lib/players';

export default function App() {
  const leagues = useStorageItem(leaguesItem)?.toSorted(byName);
  const activeId = useStorageItem(activeLeagueIdItem);
  const [players, setPlayers] = useState<Player[]>();
  const [playersError, setPlayersError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [screen, setScreen] = useState<'lineup' | 'add' | 'edit'>('lineup');

  const byId = useMemo(() => new Map(players?.map((p) => [p.id, p])), [players]);

  useEffect(() => {
    loadPlayers().then(setPlayers, (e) => setPlayersError(String(e)));
  }, [attempt]);

  if (playersError) {
    return (
      <Shell>
        <Card>
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Could not load the player list</p>
              <p className="text-xs text-neutral-500">Lens needs it to find your players. Check your connection.</p>
            </div>
            <button
              className="btn shrink-0"
              onClick={() => {
                setPlayersError(undefined);
                setAttempt(attempt + 1);
              }}
            >
              Try again
            </button>
          </div>
          <p className="rounded-b-lg border-t border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[11px] break-words text-neutral-500">
            {playersError}
          </p>
        </Card>
      </Shell>
    );
  }
  if (!leagues || activeId === undefined || !players) {
    return (
      <Shell>
        <Card>
          <p className="px-3 py-3 text-neutral-500">Loading the player list…</p>
        </Card>
      </Shell>
    );
  }

  const active = leagues.find((l) => l.id === activeId) ?? leagues[0];
  const done = () => setScreen('lineup');
  if (screen === 'add' || !active) {
    return (
      <Shell>
        <AddLeague players={players} leagues={leagues} onDone={done} canCancel={!!active} />
      </Shell>
    );
  }
  if (screen === 'edit' && !active.sleeper) {
    return (
      <Shell>
        <Card>
          <ScreenHeader title={`Edit ${active.name}`} line="Change the roster after a trade or a pickup." onCancel={done} />
          <div className="space-y-4 border-t border-neutral-200 px-3 py-3">
            <ManualLeague players={players} league={active} onDone={done} />
          </div>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card>
        <LeagueMenu
          leagues={leagues}
          active={active}
          onAdd={() => setScreen('add')}
          onEdit={active.sleeper ? undefined : () => setScreen('edit')}
        />
        <ScanPanel league={active} leagues={leagues} byId={byId} />
      </Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="p-3 text-sm text-neutral-900">{children}</main>;
}

function AddLeague(props: { players: Player[]; leagues: readonly League[]; onDone: () => void; canCancel: boolean }) {
  const [source, setSource] = useState<'sleeper' | 'manual'>('sleeper');
  // With no League yet, this is the first screen a user sees.
  const first = !props.canCancel;
  return (
    <Card>
      <ScreenHeader
        title={first ? 'Add your first league' : 'Add a league'}
        line={first ? 'Lens shows its players on any rankings page.' : 'Import it from Sleeper, or enter it by hand.'}
        onCancel={first ? undefined : props.onDone}
      />
      <Band>
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-md bg-neutral-200/60 p-0.5 text-xs font-medium">
          {(['sleeper', 'manual'] as const).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={source === s}
              className={`rounded py-1.5 ${source === s ? 'bg-white text-brand shadow-sm ring-1 ring-black/5' : 'text-neutral-500'}`}
              onClick={() => setSource(s)}
            >
              {s === 'sleeper' ? 'Sleeper' : 'Manual'}
            </button>
          ))}
        </div>
      </Band>
      <div className="space-y-4 px-3 py-3">
        {source === 'sleeper' ? (
          <SleeperImport leagues={props.leagues} onDone={props.onDone} />
        ) : (
          <ManualLeague players={props.players} onDone={props.onDone} />
        )}
      </div>
    </Card>
  );
}

function ScreenHeader(props: { title: string; line: string; onCancel?: () => void }) {
  return (
    <header className="flex items-center gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold" title={props.title}>
          {props.title}
        </h1>
        <p className="text-xs text-neutral-500">{props.line}</p>
      </div>
      {props.onCancel && (
        <button
          aria-label="Cancel"
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 text-lg text-neutral-600"
          onClick={props.onCancel}
        >
          ×
        </button>
      )}
    </header>
  );
}
