import { Fragment, useEffect, useMemo, useState } from 'react';
import { slotName, type League } from '@/lib/league';
import { buildLineup, type RankSet, type RosterPlayer } from '@/lib/lineup';
import { listLabel, listsForLeague, rankerIn, rankerNames, rankLabel, sourceTitle } from '@/lib/lists';
import type { MarkKind } from '@/lib/page/highlight';
import type { ScanResult } from '@/lib/page/scan';
import type { PageSource } from '@/lib/page/source';
import { findPickups, type Pickup } from '@/lib/pickups';
import type { Player } from '@/lib/players';
import { keyOf, listsFromSource, type StoredList } from '@/lib/scans';
import { asideClass, Badge, count, Line, RosterSection, Section, Select, SourceCard, Swatch, statusNote } from './ui';

type Props = {
  league: League;
  byId: ReadonlyMap<string, Player>;
  source: PageSource;
  /** The page in front, when it shows this Source. */
  page?: ScanResult;
  stored: readonly StoredList[];
  /** The page ranks a player otherwise than the kept lists. */
  outdated: boolean;
  /** Called with the colors the page's marks should have. */
  onKinds: (kinds: Record<string, MarkKind>) => void;
  /** Removes a kept list until the next Scan of its page. */
  onForget: (list: StoredList) => void;
  /** The Source card's button: Scan page or Rescan. */
  action: React.ReactNode;
  /** Shown after the Lineup, before its lists. */
  children?: React.ReactNode;
};

export function LineupView({ league, byId, source, page, stored, outdated, onKinds, onForget, action, children }: Props) {
  // The lists kept from every page of this Source (ADR-0004).
  const lists = listsForLeague(listsFromSource(stored, source.site, source.week), league.scoring);
  const names = rankerNames(lists);
  const pageDefault = page && rankerNames(listsForLeague(page.lists, league.scoring))[0];
  const [chosen, setChosen] = useState<string>();
  const [showUpgrades, setShowUpgrades] = useState(false);
  const ranker = [chosen, pageDefault, names[0]].find((n) => n && names.includes(n));

  const used = lists.filter((l) => !ranker || l.rankers.some((r) => r.name === ranker));
  const roster: RosterPlayer[] = league.roster.flatMap((e) => {
    const player = byId.get(e.playerId);
    return player ? [{ player, status: e.status }] : [];
  });
  const sets: RankSet[] = used.map((l) => ({ heading: l.heading, positions: l.positions, ranks: rankerIn(l, ranker).ranks }));
  const lineup = buildLineup(league.slots, roster, sets);
  const rostered = league.sleeper?.rostered;
  const pickups = rostered ? findPickups({ slots: league.slots, roster, lists: sets, starters: lineup.starters, rostered: new Set(rostered), byId }) : [];
  const starts = pickups.filter((p) => !('over' in p));
  const upgrades = pickups.filter((p) => 'over' in p);

  const kinds = useMemo(() => {
    const starters = new Set(lineup.starters.flatMap((s) => ('playerId' in s ? [s.playerId] : [])));
    return Object.fromEntries([
      ...league.roster.map((e) => [e.playerId, starters.has(e.playerId) ? 'starter' : 'bench']),
      ...pickups.map((p) => [p.playerId, 'pickup']),
    ]) as Record<string, MarkKind>;
  }, [lineup, league.roster, pickups]);
  const kindsKey = JSON.stringify(kinds);
  useEffect(() => onKinds(kinds), [kindsKey]); // Only a change of colors triggers this.

  const onPage = page && new Set(page.found);
  const found = onPage && `${league.roster.filter((e) => onPage.has(e.playerId)).length} of ${league.roster.length} on page`;
  const title = sourceTitle(source);
  const scannedAt = Math.max(...lists.map((l) => l.scannedAt));
  const note = outdated ? <span className="text-amber-700">Ranks out of date</span> : `scanned ${scanTime(scannedAt)}`;

  if (!ranker)
    return (
      <>
        <SourceCard title={title} line={<>{page?.lists.length ? 'Not scanned' : 'No ranked lists'}{found && ` · ${found}`}</>} action={action} />
        <div className="space-y-6 px-3 py-3">
          <RosterSection league={league} byId={byId} found={onPage} />
          {children}
        </div>
      </>
    );

  const status = new Map(league.roster.map((e) => [e.playerId, e.status]));
  const badgeOf = (id: string) => byId.get(id)?.positions[0] ?? '?';

  return (
    <>
      <SourceCard
        title={title}
        line={
          <>
            {names.length > 1 ? (
              <Select label="Ranker" value={ranker} options={names.map((n) => ({ value: n, label: n }))} onChange={setChosen} className="text-xs text-neutral-700" />
            ) : (
              ranker
            )}
            <span>
              {' · '}
              {found && `${found} · `}
              {note}
            </span>
          </>
        }
        action={action}
      />
      <div className="space-y-6 px-3 py-3">
        <Section
          title="Lineup"
          aside={
            <span className={`flex items-center gap-2 ${asideClass}`}>
              <Swatch kind="starter" /> Start <Swatch kind="bench" /> Bench
              {pickups.length > 0 && (
                <>
                  <Swatch kind="pickup" /> Pickup
                </>
              )}
            </span>
          }
        >
          {lineup.starters.map((s, i) =>
            'playerId' in s ? (
              <Line
                key={s.playerId}
                badge={s.slot}
                kind="starter"
                id={s.playerId}
                player={byId.get(s.playerId)}
                rank={s.rank}
                from={s.from}
                strong
              />
            ) : (
              <li key={`missing-${i}`} className="flex items-center gap-3 py-2">
                <Badge text={s.slot} />
                <span className="text-xs text-neutral-400">
                  {s.missing === 'list' ? `Scan ${slotName(s.slot)} rankings` : 'No ranked player left'}
                </span>
              </li>
            ),
          )}
        </Section>

        <Section title="Bench">
          {lineup.bench.map((b) => (
            <Line key={b.playerId} badge={badgeOf(b.playerId)} kind="bench" id={b.playerId} player={byId.get(b.playerId)} rank={b.rank} from={b.from} />
          ))}
          {[...lineup.unranked, ...lineup.out].map((id) => (
            <Line key={id} badge={badgeOf(id)} id={id} player={byId.get(id)} note={statusNote(status.get(id), 'Unranked')} faded />
          ))}
        </Section>

        {pickups.length > 0 && (
          <Section title="Pickups">
            <PickupGroups pickups={starts} byId={byId} badgeOf={badgeOf} />
            {upgrades.length > 0 && (
              <li>
                <button className="py-2 text-xs text-neutral-500 hover:text-neutral-800" onClick={() => setShowUpgrades(!showUpgrades)}>
                  {showUpgrades ? 'Hide bench upgrades' : `Show ${count(upgrades.length, 'bench upgrade')}`}
                </button>
              </li>
            )}
            {showUpgrades && <PickupGroups pickups={upgrades} byId={byId} badgeOf={badgeOf} />}
          </Section>
        )}

        {children}

        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer select-none">Ranks from {used.length === 1 ? '1 list' : `${used.length} lists`}</summary>
          <ul className="mt-2 divide-y divide-neutral-100 border-t border-neutral-100">
            {used.map((l) => (
              <li key={keyOf(l)} className="flex items-center gap-3 py-1.5">
                <Badge text={listLabel(l.positions)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-neutral-700" title={l.heading}>
                    {l.heading || listLabel(l.positions)}
                  </p>
                  <p>
                    Scanned {scanTime(l.scannedAt)}
                    {l.format && l.format !== league.scoring && (
                      <span className="text-amber-700">
                        {' '}
                        · {l.format}, not {league.scoring}
                      </span>
                    )}
                  </p>
                </div>
                <button aria-label={`Remove ${l.heading || 'list'}`} className="w-5 shrink-0 text-center text-base text-neutral-400 hover:text-red-700" onClick={() => onForget(l)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </>
  );
}

function PickupGroups({ pickups, byId, badgeOf }: { pickups: Pickup[]; byId: ReadonlyMap<string, Player>; badgeOf: (id: string) => string }) {
  return [...Map.groupBy(pickups, (p) => pickupGroup(p, byId))].map(([group, members]) => (
    <Fragment key={group}>
      <li className="pt-3 pb-1 text-xs font-medium text-neutral-700">{group}</li>
      {members.map((p) => (
        <Line key={p.playerId} badge={badgeOf(p.playerId)} kind="pickup" id={p.playerId} player={byId.get(p.playerId)} rank={p.rank} from={p.from} />
      ))}
    </Fragment>
  ));
}

/**
 * "For empty DEF", "Starts over J.K. Dobbins (DEN) · RB58", or "Better than
 * Diontae Johnson (PIT) · WR143": the full name, as a roster can have two Johnsons.
 */
function pickupGroup(pickup: Pickup, byId: ReadonlyMap<string, Player>): string {
  if ('slot' in pickup) return `For empty ${slotName(pickup.slot)}`;
  const [verb, other, from] = 'replaces' in pickup ? ['Starts over', pickup.replaces, pickup.replaces.from] : ['Better than', pickup.over, pickup.from];
  const player = byId.get(other.playerId);
  // A defense's name is its team.
  const name = !player ? 'your player' : player.positions.includes('DEF') ? player.name : `${player.name} (${player.team})`;
  return `${verb} ${name} · ${rankLabel(from.positions)}${other.rank}`;
}

/** "3:09 PM" today, else with the date. */
function scanTime(at: number): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === new Date().toDateString() ? time : `${d.toLocaleDateString()}, ${time}`;
}
