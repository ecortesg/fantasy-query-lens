const API = 'https://api.sleeper.app/v1';

export type SleeperUser = { user_id: string; username: string; display_name: string };

export type SleeperLeague = {
  league_id: string;
  name: string;
  roster_positions: string[];
  scoring_settings: Record<string, number>;
};

export type SleeperRoster = {
  owner_id: string | null;
  co_owners: string[] | null;
  /** Every rostered player, the reserve and taxi ones included. */
  players: string[] | null;
  reserve: string[] | null;
  taxi: string[] | null;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`Sleeper request failed: ${res.status}`);
  return res.json() as Promise<T>;
}

/** The season Sleeper creates leagues in; it moves to next year before the NFL's does. */
export const getLeagueSeason = async () =>
  (await get<{ league_season: string }>('/state/nfl')).league_season;

/** Null when no Sleeper user has that username. */
export const getUser = (username: string) =>
  get<SleeperUser | null>(`/user/${encodeURIComponent(username.trim())}`);

export const getLeagues = (userId: string, season: string) =>
  get<SleeperLeague[]>(`/user/${userId}/leagues/nfl/${season}`);

export const getRosters = (leagueId: string) =>
  get<SleeperRoster[]>(`/league/${leagueId}/rosters`);
