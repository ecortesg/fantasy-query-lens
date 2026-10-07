import { storage } from '#imports';
import { norm } from './names';

export const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DL', 'LB', 'DB'] as const;
export type Position = (typeof positions)[number];

/** A player as Fantasy Query's `/api/lens/players` serves them. */
export type Player = {
  /** Sleeper's player ID; the team code for a team defense. */
  id: string;
  name: string;
  positions: Position[];
  team: string;
};

const IDP = new Set<Position>(['DL', 'LB', 'DB']);

// The www host: the bare domain redirects there, and the redirect has no CORS header.
const PLAYERS_URL = `${import.meta.env.WXT_FQ_URL ?? 'https://www.fantasyquery.com'}/api/lens/players`;
const DAY_MS = 24 * 60 * 60 * 1000;

const playersCache = storage.defineItem<{ fetchedAt: number; players: Player[] }>(
  'local:players',
);

/** The player list, fetched at most once a day. A failed fetch falls back to the last copy. */
export async function loadPlayers(now = Date.now()): Promise<Player[]> {
  const cached = await playersCache.getValue();
  if (cached && now - cached.fetchedAt < DAY_MS) return cached.players;

  try {
    const res = await fetch(PLAYERS_URL);
    if (!res.ok) throw new Error(`Player list request failed: ${res.status}`);
    const { players } = (await res.json()) as { players: Player[] };
    await playersCache.setValue({ fetchedAt: now, players });
    return players;
  } catch (error) {
    if (cached) return cached.players;
    throw error;
  }
}

/**
 * Players whose name has a word starting with each typed word, in any order:
 * "walk" and "ken wal" both find Kenneth Walker III. A defense also answers to
 * its team code. Names whose last word the query starts come first, then
 * offense, kickers and defenses before IDP players, who are highlight-only.
 */
export function searchPlayers(players: readonly Player[], query: string, limit = 8): Player[] {
  const typed = norm(query).split(' ').filter(Boolean);
  if (typed.length === 0) return [];

  const hits = players.filter((player) => {
    const words = norm(player.name).split(' ');
    if (player.positions.includes('DEF')) words.push(player.team.toLowerCase());
    return typed.every((t) => words.some((w) => w.startsWith(t)));
  });

  const lastWordHit = (player: Player) =>
    norm(player.name).split(' ').at(-1)!.startsWith(typed.at(-1)!) ? 0 : 1;
  const idp = (player: Player) => (player.positions.every((p) => IDP.has(p)) ? 1 : 0);
  return hits
    .sort((a, b) => lastWordHit(a) - lastWordHit(b) || idp(a) - idp(b) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
