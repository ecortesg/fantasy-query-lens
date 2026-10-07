import { slotEligibility, type League, type Slot } from './league';
import { buildLineup, type RankSet, type RosterPlayer, type Starter } from './lineup';
import type { Player, Position } from './players';

/** Players on no team in a Sleeper League, at a position one of its Slots takes. None for a manual League. */
export function availablePlayers(league: League, players: Iterable<Player>): Player[] {
  if (!league.sleeper?.rostered) return [];
  const rostered = new Set(league.sleeper.rostered);
  const taken = new Set<Position>(league.slots.flatMap((s) => slotEligibility[s]));
  return [...players].filter((p) => !rostered.has(p.id) && p.positions.some((pos) => taken.has(pos)));
}

/**
 * An available player for a Slot the Lineup cannot fill, one the Lineup would
 * start in place of a starter, or one ranked over the user's lowest-ranked
 * bench player.
 */
export type Pickup = { playerId: string; rank: number; from: RankSet } & (
  | { slot: Slot }
  | { replaces: { playerId: string; rank: number } }
  | { over: { playerId: string; rank: number } }
);

type Input = {
  slots: readonly Slot[];
  roster: readonly RosterPlayer[];
  lists: readonly RankSet[];
  starters: readonly Starter[];
  /** Every player on a team in the league. */
  rostered: ReadonlySet<string>;
  byId: ReadonlyMap<string, Player>;
};

const byRank = (list: RankSet) => Object.entries(list.ranks).sort((a, b) => a[1] - b[1]);

/**
 * First the best available player for each Slot that lists cover but no
 * ranked player of the user fills (no defense, or one the page leaves out).
 * Then the available players the Lineup would start if the user added them,
 * found by building it again with each one (ADR-0008). Then the ones ranked
 * above the user's lowest-ranked bench player in the same list. Only lists one
 * Slot can read: a FLEX list compares an RB with a WR, but an overall list
 * with QBs counts only where a Slot takes them all. Each player once.
 */
export function findPickups({ slots, roster, lists, starters, rostered, byId }: Input): Pickup[] {
  const pickups: Pickup[] = [];
  const seen = new Set<string>();
  const free = (id: string) => !rostered.has(id) && !seen.has(id);

  for (const starter of starters) {
    if (!('missing' in starter) || starter.missing !== 'player') continue;
    const eligible: readonly Position[] = slotEligibility[starter.slot];
    const best = byRank(starter.from).find(([id]) => free(id) && byId.get(id)?.positions.some((p) => eligible.includes(p)));
    if (!best) continue;
    seen.add(best[0]);
    pickups.push({ playerId: best[0], rank: best[1], from: starter.from, slot: starter.slot });
  }

  // Every ranked player, as one can start without passing a starter: a Slot whose widest list
  // ranked none of the user's players reads it once it ranks him.
  const starting = starters.flatMap((s) => ('playerId' in s ? [s] : []));
  const startingIds = new Set(starting.map((s) => s.playerId));
  const candidates = new Set(lists.flatMap((list) => Object.keys(list.ranks).filter((id) => free(id) && byId.has(id))));
  const starts: Extract<Pickup, { replaces: unknown }>[] = [];
  for (const id of candidates) {
    const after = buildLineup(slots, [...roster, { player: byId.get(id)!, status: 'active' }], lists).starters;
    const entry = after.find((s) => 'playerId' in s && s.playerId === id);
    const afterIds = new Set(after.flatMap((s) => ('playerId' in s ? [s.playerId] : [])));
    const replaced = starting.find((s) => !afterIds.has(s.playerId));
    // With no starter replaced, the player fills an empty Slot, which has its best player already.
    if (!entry || !('playerId' in entry) || !replaced) continue;
    starts.push({ playerId: id, rank: entry.rank, from: entry.from, replaces: { playerId: replaced.playerId, rank: replaced.rank } });
  }
  const order = (p: (typeof starts)[number]) => starting.findIndex((s) => s.playerId === p.replaces.playerId);
  for (const pickup of starts.sort((a, b) => order(a) - order(b) || a.rank - b.rank)) {
    seen.add(pickup.playerId);
    pickups.push(pickup);
  }

  const bench = new Set(roster.filter((r) => r.status === 'active' && !startingIds.has(r.player.id)).map((r) => r.player.id));
  const readable = lists
    .filter((l) => l.positions.length && slots.some((s) => l.positions.every((p) => (slotEligibility[s] as readonly Position[]).includes(p))))
    .sort((a, b) => b.positions.length - a.positions.length);
  for (const list of readable) {
    const ranked = byRank(list);
    const lowest = ranked.findLast(([id]) => bench.has(id));
    if (!lowest) continue;
    const [overId, overRank] = lowest;
    for (const [playerId, rank] of ranked) {
      if (rank >= overRank) break;
      if (!free(playerId)) continue;
      seen.add(playerId);
      pickups.push({ playerId, rank, from: list, over: { playerId: overId, rank: overRank } });
    }
  }
  return pickups;
}
