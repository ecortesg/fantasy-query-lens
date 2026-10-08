import { slotEligibility, type RosterEntry, type Slot } from './league';
import type { Player, Position } from './players';

/** One list read with the chosen ranker: its coverage and its ranks by player ID. */
export type RankSet = { heading: string; positions: Position[]; ranks: Record<string, number> };

export type Starter =
  | { slot: Slot; playerId: string; rank: number; from: RankSet }
  /** No list, or set of position lists, covers every position the slot accepts. */
  | { slot: Slot; missing: 'list' }
  /** Lists cover the slot, but none ranks a player still left for it. */
  | { slot: Slot; missing: 'player'; from: RankSet };

export type Lineup = {
  starters: Starter[];
  /** Active players left over that some list ranks, by position, list and then rank. */
  bench: { playerId: string; rank: number; from: RankSet }[];
  /** Active players no list ranks. */
  unranked: string[];
  /** IR and taxi players, never suggested. */
  out: string[];
};

export type RosterPlayer = { player: Player; status: RosterEntry['status'] };

const positionOrder: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'];

/**
 * The suggested lineup (ADR-0003). Slots that accept fewer positions are filled
 * first. Each slot reads the widest list that covers every position it accepts,
 * so a FLEX list, when there is one, ranks the RB slots too. A list that ranks
 * none of the players left for a slot (a short preview of a longer list) passes
 * the slot to the next list. With no such list, as on a site with no FLEX page,
 * the best rank in the position lists starts. It is a guess, as WR18 and RB18
 * are not worth the same, and its `from` shows it.
 */
export function buildLineup(slots: readonly Slot[], roster: readonly RosterPlayer[], lists: readonly RankSet[]): Lineup {
  const byId = new Map(roster.map((r) => [r.player.id, r.player]));
  // A list that does not say what it covers covers the positions of the players it ranks.
  const coverage = new Map(
    lists.map((l) => [
      l,
      l.positions.length ? l.positions : [...new Set(Object.keys(l.ranks).flatMap((id) => byId.get(id)?.positions ?? []))],
    ]),
  );
  // The lists that cover every eligible position, widest first.
  const listsFor = (eligible: readonly Position[]) =>
    lists
      .filter((l) => eligible.every((p) => coverage.get(l)!.includes(p)))
      .sort((a, b) => coverage.get(b)!.length - coverage.get(a)!.length);
  // The list that ranks a player for one of his positions, widest first.
  const ownList = (p: Player) => p.positions.flatMap((pos) => listsFor([pos])).find((l) => l.ranks[p.id] !== undefined);

  const active = roster.filter((r) => r.status === 'active').map((r) => r.player);
  const used = new Set<string>();
  const starters: Starter[] = [];
  const fillOrder = slots.map((slot, i) => ({ slot, i })).sort((a, b) => slotEligibility[a.slot].length - slotEligibility[b.slot].length);

  for (const { slot, i } of fillOrder) {
    const eligible: readonly Position[] = slotEligibility[slot];
    const candidates = listsFor(eligible);
    const left = active.filter((p) => !used.has(p.id) && p.positions.some((pos) => eligible.includes(pos)));
    if (candidates.length === 0) {
      const covered = eligible.every((pos) => listsFor([pos]).length > 0);
      const guess = covered
        ? left
            .flatMap((p) => {
              const from = ownList(p);
              return from ? [{ playerId: p.id, rank: from.ranks[p.id]!, from }] : [];
            })
            .sort((a, b) => a.rank - b.rank)[0]
        : undefined;
      if (guess) used.add(guess.playerId);
      starters[i] = guess ? { slot, ...guess } : { slot, missing: 'list' };
      continue;
    }
    const pick = candidates
      .map((list) => ({ list, best: left.filter((p) => list.ranks[p.id] !== undefined).sort((a, b) => list.ranks[a.id]! - list.ranks[b.id]!)[0] }))
      .find((c) => c.best);
    if (!pick) {
      starters[i] = { slot, missing: 'player', from: candidates[0]! };
      continue;
    }
    used.add(pick.best!.id);
    starters[i] = { slot, playerId: pick.best!.id, rank: pick.list.ranks[pick.best!.id]!, from: pick.list };
  }

  const bench: Lineup['bench'] = [];
  const unranked: string[] = [];
  for (const player of active) {
    if (used.has(player.id)) continue;
    const from = ownList(player);
    if (!from) unranked.push(player.id);
    else bench.push({ playerId: player.id, rank: from.ranks[player.id]!, from });
  }
  // By position, then by list in the order the slots read them (widest first), then by rank:
  // ranks from different lists are on different scales.
  const order = (id: string) => positionOrder.indexOf(byId.get(id)!.positions[0]!);
  const priority = (list: RankSet) => -coverage.get(list)!.length;
  bench.sort((a, b) => order(a.playerId) - order(b.playerId) || priority(a.from) - priority(b.from) || a.rank - b.rank);

  return { starters, bench, unranked, out: roster.filter((r) => r.status !== 'active').map((r) => r.player.id) };
}
