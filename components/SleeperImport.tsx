import { useState } from 'react';
import { byName, leagueFromSleeper, saveLeagues, scoringFromSleeper, sleeperLeagueId, slotName, slotsFromSleeper, type League } from '@/lib/league';
import { getLeagues, getLeagueSeason, getRosters, getUser, type SleeperLeague, type SleeperUser } from '@/lib/sleeper';
import { asideClass, count, headingClass, inputClass, Section } from './ui';

type Found = { user: SleeperUser; season: string; leagues: SleeperLeague[] };

type Props = {
  /** The Leagues already added. One of them can be picked again, which updates it. */
  leagues: readonly League[];
  onDone: () => void;
};

export function SleeperImport({ leagues, onDone }: Props) {
  const added = new Set(leagues.map((l) => l.id));
  const isAdded = (l: SleeperLeague, user: SleeperUser) => added.has(sleeperLeagueId(l.league_id, user.user_id));
  const [username, setUsername] = useState('');
  const [found, setFound] = useState<Found>();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const find = () =>
    run(async () => {
      const user = await getUser(username);
      if (!user) throw new Error('No Sleeper user has that username.');
      const season = await getLeagueSeason();
      const leagues = await getLeagues(user.user_id, season);
      setFound({ user, season, leagues: leagues.toSorted(byName) });
      setPicked(new Set(leagues.flatMap((l) => (isAdded(l, user) ? [] : [l.league_id]))));
    });

  const importPicked = () =>
    run(async () => {
      if (!found) return;
      const chosen = found.leagues.filter((l) => picked.has(l.league_id));
      const imported = await Promise.all(
        chosen.map(async (l) => leagueFromSleeper(l, await getRosters(l.league_id), found.user)),
      );
      const withTeam = imported.filter((l): l is League => l !== undefined);
      if (withTeam.length === 0) throw new Error('You have no team in the chosen leagues.');
      await saveLeagues(withTeam);
      onDone();
    });

  const errorLine = error && <p className="text-sm text-red-700">{error}</p>;

  if (!found) {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          find();
        }}
      >
        <label className="block space-y-1.5">
          <span className={headingClass}>Sleeper username</span>
          <input className={inputClass} value={username} onChange={(e) => setUsername(e.target.value)} />
          <span className="block text-xs text-neutral-500">Lens reads your public Sleeper leagues. It asks for no password.</span>
        </label>
        <button className="btn w-full py-2" disabled={busy || !username.trim()}>
          {busy ? 'Finding leagues…' : 'Find leagues'}
        </button>
        {errorLine}
      </form>
    );
  }

  const change = () => {
    setFound(undefined);
    setError(undefined);
  };

  if (found.leagues.length === 0) {
    return (
      <>
        <p className="rounded-lg border border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-500">
          {username} has no Sleeper leagues for the {found.season} season.
        </p>
        <button className="w-full rounded-md border border-neutral-300 py-2 font-medium" onClick={change}>
          Try another username
        </button>
      </>
    );
  }

  return (
    <>
      <Section
        title={`${found.season} leagues`}
        aside={
          <span className={asideClass}>
            {username} ·{' '}
            <button className="underline" onClick={change}>
              Change
            </button>
          </span>
        }
      >
        {found.leagues.map((l) => (
          <li key={l.league_id}>
            <label className="flex cursor-pointer items-center gap-3 py-2">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={picked.has(l.league_id)}
                onChange={(e) => {
                  const next = new Set(picked);
                  if (e.target.checked) next.add(l.league_id);
                  else next.delete(l.league_id);
                  setPicked(next);
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate" title={l.name}>
                  {l.name}
                </span>
                <span className="block text-xs text-neutral-400">{describe(l)}</span>
              </span>
              {isAdded(l, found.user) && <span className="shrink-0 text-xs text-neutral-400">Added</span>}
            </label>
          </li>
        ))}
      </Section>
      <button className="btn w-full py-2" disabled={busy || picked.size === 0} onClick={importPicked}>
        {busy ? 'Adding…' : `Add ${count(picked.size, 'league')}`}
      </button>
      {errorLine}
    </>
  );
}

/** "PPR · 10 starters · SUPERFLEX" */
function describe(l: SleeperLeague): string {
  const slots = slotsFromSleeper(l.roster_positions);
  return [scoringFromSleeper(l.scoring_settings), count(slots.length, 'starter'), slots.includes('SUPER_FLEX') && slotName('SUPER_FLEX')].filter(Boolean).join(' · ');
}
