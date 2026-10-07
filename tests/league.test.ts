import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  activeLeagueIdItem,
  byName,
  leagueFromSleeper,
  leaguesItem,
  refreshRoster,
  removeLeague,
  rosterFromSleeper,
  saveLeagues,
  scoringFromSleeper,
  slotsFromSleeper,
  type League,
} from '../lib/league';
import type { SleeperRoster } from '../lib/sleeper';

const roster = (over: Partial<SleeperRoster>): SleeperRoster => ({
  owner_id: null,
  co_owners: null,
  players: [],
  reserve: null,
  taxi: null,
  ...over,
});

describe('slotsFromSleeper', () => {
  it('keeps starting slots and drops bench, IR and taxi', () => {
    expect(
      slotsFromSleeper(['QB', 'RB', 'RB', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'K', 'DEF', 'BN', 'BN', 'IR', 'TAXI']),
    ).toEqual(['QB', 'RB', 'RB', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'K', 'DEF']);
  });
});

describe('scoringFromSleeper', () => {
  it.each([
    [{}, 'STD'],
    [{ rec: 0 }, 'STD'],
    [{ rec: 0.5 }, 'HALF'],
    [{ rec: 1 }, 'PPR'],
    [{ rec: 0.25 }, 'HALF'],
  ] as const)('%o is %s', (settings, format) => {
    expect(scoringFromSleeper(settings)).toBe(format);
  });
});

describe('rosterFromSleeper', () => {
  const rosters = [
    roster({ owner_id: 'other', players: ['1'] }),
    roster({ owner_id: 'owner', co_owners: ['me'], players: ['10', '11', '12'], reserve: ['11'], taxi: ['12'] }),
  ];

  it('finds a co-owned roster and marks IR and taxi players', () => {
    expect(rosterFromSleeper(rosters, 'me')).toEqual([
      { playerId: '10', status: 'active' },
      { playerId: '11', status: 'ir' },
      { playerId: '12', status: 'taxi' },
    ]);
  });

  it('is undefined for a user with no roster in the league', () => {
    expect(rosterFromSleeper(rosters, 'stranger')).toBeUndefined();
  });

  it('keeps the players of every team in the league', () => {
    const league = { league_id: 'L', name: 'L', roster_positions: [], scoring_settings: {} };
    expect(leagueFromSleeper(league, rosters, { user_id: 'me', username: 'me' })!.sleeper!.rostered).toEqual(['1', '10', '11', '12']);
  });

  it('skips a league where the user has no roster', () => {
    const league = { league_id: 'L', name: 'L', roster_positions: [], scoring_settings: {} };
    expect(leagueFromSleeper(league, rosters, { user_id: 'stranger', username: 'stranger' })).toBeUndefined();
  });
});

describe('two users in one Sleeper league', () => {
  beforeEach(() => fakeBrowser.reset());

  it('keeps both teams', async () => {
    const league = { league_id: 'L', name: 'La Pandilla', roster_positions: [], scoring_settings: {} };
    const rosters = [roster({ owner_id: 'me', players: ['1'] }), roster({ owner_id: 'dad', players: ['2'] })];
    const mine = leagueFromSleeper(league, rosters, { user_id: 'me', username: 'ernesto' })!;
    const dads = leagueFromSleeper(league, rosters, { user_id: 'dad', username: 'papa' })!;
    await saveLeagues([mine]);
    await saveLeagues([dads]);
    expect((await leaguesItem.getValue()).map((l) => [l.sleeper?.username, l.roster[0]?.playerId])).toEqual([
      ['ernesto', '1'],
      ['papa', '2'],
    ]);
  });
});

describe('league storage', () => {
  const league = (id: string, name = id): League => ({ id, name, scoring: 'PPR', slots: [], roster: [] });

  beforeEach(() => fakeBrowser.reset());

  it('replaces a re-imported league and makes the first added one active', async () => {
    await saveLeagues([league('a', 'old'), league('b')]);
    await saveLeagues([league('a', 'new')]);
    expect((await leaguesItem.getValue()).map((l) => [l.id, l.name])).toEqual([
      ['b', 'b'],
      ['a', 'new'],
    ]);
    expect(await activeLeagueIdItem.getValue()).toBe('a');
  });

  it('moves the active league on to the first by name when the active one is removed', async () => {
    await saveLeagues([league('a'), league('c'), league('b')]);
    await removeLeague('a');
    expect(await activeLeagueIdItem.getValue()).toBe('b');
    await removeLeague('b');
    await removeLeague('c');
    expect(await activeLeagueIdItem.getValue()).toBeNull();
  });

  it('orders by name with no regard to case and with numbers by value, then by Sleeper username', () => {
    const team = (name: string, username?: string): League => ({
      ...league(`${name}:${username}`, name),
      sleeper: username ? { leagueId: name, userId: username, username, rosterFetchedAt: 0 } : undefined,
    });
    const leagues = [team('mojo'), team('League 10'), team('La Pandilla', 'ernestoc'), team('League 2'), team('la pandilla', 'ecortesg')];
    expect(leagues.toSorted(byName).map((l) => `${l.name} ${l.sleeper?.username ?? ''}`.trim())).toEqual([
      'la pandilla ecortesg',
      'La Pandilla ernestoc',
      'League 2',
      'League 10',
      'mojo',
    ]);
  });
});

describe('refreshRoster', () => {
  const MIN = 60 * 1000;
  const fetchMock = vi.fn<typeof fetch>();
  const sleeperLeague = (fetchedAt: number): League => ({
    id: 'L:me',
    name: 'L',
    scoring: 'PPR',
    slots: [],
    roster: [{ playerId: 'old', status: 'active' }],
    sleeper: { leagueId: 'L', userId: 'me', username: 'ernesto', rosterFetchedAt: fetchedAt, rostered: ['old'] },
  });

  beforeEach(() => {
    fakeBrowser.reset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps a roster younger than 5 minutes', async () => {
    const league = sleeperLeague(0);
    expect(await refreshRoster(league, 5 * MIN - 1)).toBe(league);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes an older roster and the other teams, and stores them', async () => {
    await saveLeagues([sleeperLeague(0)]);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([roster({ owner_id: 'me', players: ['new'] }), roster({ owner_id: 'rival', players: ['theirs'] })])),
    );
    const refreshed = await refreshRoster(sleeperLeague(0), 5 * MIN);
    expect(fetchMock).toHaveBeenCalledWith('https://api.sleeper.app/v1/league/L/rosters');
    expect(refreshed.roster).toEqual([{ playerId: 'new', status: 'active' }]);
    expect(refreshed.sleeper?.rostered).toEqual(['new', 'theirs']);
    expect((await leaguesItem.getValue())[0]).toEqual(refreshed);
  });

  it('refreshes a young roster stored before the other teams were kept', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([roster({ owner_id: 'me', players: ['new'] })])));
    const old = sleeperLeague(0);
    delete old.sleeper!.rostered;
    expect((await refreshRoster(old, 1)).sleeper?.rostered).toEqual(['new']);
  });

  it('keeps the stored roster when Sleeper fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const league = sleeperLeague(0);
    expect(await refreshRoster(league, 10 * MIN)).toBe(league);
  });

  it('never refreshes a manual League', async () => {
    const manual = { ...sleeperLeague(0), sleeper: undefined };
    expect(await refreshRoster(manual, 10 * MIN)).toBe(manual);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

