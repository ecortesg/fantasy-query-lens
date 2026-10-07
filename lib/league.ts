import { storage } from '#imports';
import type { Position } from './players';
import { getRosters, type SleeperLeague, type SleeperRoster, type SleeperUser } from './sleeper';

/** Every slot is the set of positions it accepts (ADR-0003). */
export const slotEligibility = {
  QB: ['QB'],
  RB: ['RB'],
  WR: ['WR'],
  TE: ['TE'],
  FLEX: ['RB', 'WR', 'TE'],
  WRRB_FLEX: ['RB', 'WR'],
  REC_FLEX: ['WR', 'TE'],
  SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
  K: ['K'],
  DEF: ['DEF'],
  DL: ['DL'],
  LB: ['LB'],
  DB: ['DB'],
  IDP_FLEX: ['DL', 'LB', 'DB'],
} as const satisfies Record<string, readonly Position[]>;
export type Slot = keyof typeof slotEligibility;

const slotNames: Partial<Record<Slot, string>> = { SUPER_FLEX: 'SUPERFLEX', WRRB_FLEX: 'W/R FLEX', REC_FLEX: 'W/T FLEX', IDP_FLEX: 'IDP FLEX' };
/** A Slot's name in the panel's text. Badges use shorter ones. */
export const slotName = (slot: Slot) => slotNames[slot] ?? slot;

export const scoringFormats = ['STD', 'HALF', 'PPR'] as const;
export type ScoringFormat = (typeof scoringFormats)[number];

/** IR and taxi players are highlighted but never suggested to start. */
export type RosterEntry = { playerId: string; status: 'active' | 'ir' | 'taxi' };

export type League = {
  /** `sleeperLeagueId(…)` for a Sleeper League, or a random ID for a manual League. */
  id: string;
  name: string;
  scoring: ScoringFormat;
  slots: Slot[];
  roster: RosterEntry[];
  sleeper?: {
    leagueId: string;
    userId: string;
    username: string;
    rosterFetchedAt: number;
    /** Every player on a team in the league, the user's too. Leagues stored before it have none until a refresh. */
    rostered?: string[];
  };
};

/** One ID per Sleeper league and user, so a user can also add a team they help with in the same league. */
export const sleeperLeagueId = (leagueId: string, userId: string) => `${leagueId}:${userId}`;

const isSlot = (value: string): value is Slot => value in slotEligibility;

/** Starting slots only: BN, IR and TAXI are not slots. */
export const slotsFromSleeper = (rosterPositions: readonly string[]): Slot[] =>
  rosterPositions.filter(isSlot);

/** The format nearest the league's points per reception. */
export function scoringFromSleeper(settings: Record<string, number>): ScoringFormat {
  const rec = settings.rec ?? 0;
  return rec < 0.25 ? 'STD' : rec < 0.75 ? 'HALF' : 'PPR';
}

/** The user's roster: the one they own or co-own. */
export function rosterFromSleeper(
  rosters: readonly SleeperRoster[],
  userId: string,
): RosterEntry[] | undefined {
  const mine = rosters.find((r) => r.owner_id === userId || r.co_owners?.includes(userId));
  if (!mine) return undefined;

  const reserve = new Set(mine.reserve);
  const taxi = new Set(mine.taxi);
  return (mine.players ?? []).map((playerId) => ({
    playerId,
    status: reserve.has(playerId) ? 'ir' : taxi.has(playerId) ? 'taxi' : 'active',
  }));
}

const rosteredInSleeper = (rosters: readonly SleeperRoster[]) => rosters.flatMap((r) => r.players ?? []);

export function leagueFromSleeper(
  league: SleeperLeague,
  rosters: readonly SleeperRoster[],
  user: Pick<SleeperUser, 'user_id' | 'username'>,
  now = Date.now(),
): League | undefined {
  const roster = rosterFromSleeper(rosters, user.user_id);
  if (!roster) return undefined;
  return {
    id: sleeperLeagueId(league.league_id, user.user_id),
    name: league.name,
    scoring: scoringFromSleeper(league.scoring_settings),
    slots: slotsFromSleeper(league.roster_positions),
    roster,
    sleeper: {
      leagueId: league.league_id,
      userId: user.user_id,
      username: user.username,
      rosterFetchedAt: now,
      rostered: rosteredInSleeper(rosters),
    },
  };
}

export const leaguesItem = storage.defineItem<League[]>('local:leagues', { fallback: [] });
export const activeLeagueIdItem = storage.defineItem<string | null>('local:activeLeagueId', {
  fallback: null,
});

/** Adds leagues, replacing any with the same ID, and makes the first one active. */
export async function saveLeagues(added: readonly League[]): Promise<void> {
  const [first] = added;
  if (!first) return;
  const ids = new Set(added.map((l) => l.id));
  const kept = (await leaguesItem.getValue()).filter((l) => !ids.has(l.id));
  await leaguesItem.setValue([...kept, ...added]);
  await activeLeagueIdItem.setValue(first.id);
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
type Named = Pick<League, 'name' | 'sleeper'>;
/** The order the panel shows Leagues in: by name, then by Sleeper username. */
export const byName = (a: Named, b: Named) =>
  collator.compare(a.name, b.name) || collator.compare(a.sleeper?.username ?? '', b.sleeper?.username ?? '');

export async function removeLeague(id: string): Promise<void> {
  const rest = (await leaguesItem.getValue()).filter((l) => l.id !== id);
  await leaguesItem.setValue(rest);
  if ((await activeLeagueIdItem.getValue()) === id) {
    await activeLeagueIdItem.setValue(rest.toSorted(byName)[0]?.id ?? null);
  }
}

/** Replaces a stored League without changing which one is active. */
export async function updateLeague(league: League): Promise<void> {
  const leagues = await leaguesItem.getValue();
  await leaguesItem.setValue(leagues.map((l) => (l.id === league.id ? league : l)));
}

const ROSTER_TTL_MS = 5 * 60 * 1000;

/**
 * A Sleeper League's Roster and the league's other teams as of now, refreshed
 * when the stored ones are more than 5 minutes old (ADR-0005). If Sleeper does
 * not answer, the stored ones.
 */
export async function refreshRoster(league: League, now = Date.now()): Promise<League> {
  const { sleeper } = league;
  if (!sleeper || (sleeper.rostered && now - sleeper.rosterFetchedAt < ROSTER_TTL_MS)) return league;
  try {
    const rosters = await getRosters(sleeper.leagueId);
    const roster = rosterFromSleeper(rosters, sleeper.userId);
    if (!roster) return league;
    const refreshed = { ...league, roster, sleeper: { ...sleeper, rosterFetchedAt: now, rostered: rosteredInSleeper(rosters) } };
    await updateLeague(refreshed);
    return refreshed;
  } catch {
    return league;
  }
}
