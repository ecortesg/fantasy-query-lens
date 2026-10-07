import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { loadPlayers, searchPlayers, type Player } from '../lib/players';

const p = (id: string, name: string, positions: Player['positions'], team: string): Player => ({
  id,
  name,
  positions,
  team,
});

const walker = p('1', 'Kenneth Walker III', ['RB'], 'SEA');
const travis = p('2', 'Travis Walker', ['WR'], 'LAR');
const players = [
  walker,
  travis,
  p('3', 'D.J. Moore', ['WR'], 'CHI'),
  p('4', "Ja'Marr Chase", ['WR'], 'CIN'),
  p('BAL', 'Baltimore Ravens', ['DEF'], 'BAL'),
  p('5', 'Walker Little', ['DL'], 'JAX'),
  p('6', 'Charles Walker', ['DL'], 'PHI'),
];

describe('searchPlayers', () => {
  const names = (query: string) => searchPlayers(players, query).map((x) => x.name);

  it('matches word starts in any order', () => {
    expect(names('ken wal')).toEqual(['Kenneth Walker III']);
    expect(names('walker kenneth')).toEqual(['Kenneth Walker III']);
  });

  it('ranks last-name hits first, and IDP players after the rest', () => {
    expect(names('walk')).toEqual(['Kenneth Walker III', 'Travis Walker', 'Charles Walker', 'Walker Little']);
  });

  it('ignores punctuation and suffixes', () => {
    expect(names('dj moore')).toEqual(['D.J. Moore']);
    expect(names('jamarr')).toEqual(["Ja'Marr Chase"]);
    expect(names('walker iii')).toEqual(['Kenneth Walker III', 'Travis Walker', 'Charles Walker', 'Walker Little']);
  });

  it('finds a defense by team code', () => {
    expect(names('bal')).toEqual(['Baltimore Ravens']);
  });

  it('returns nothing for an empty query', () => {
    expect(names('  ')).toEqual([]);
  });
});

describe('loadPlayers', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const fetchMock = vi.fn<typeof fetch>();
  const respond = (list: Player[]) =>
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ players: list })));

  beforeEach(() => {
    fakeBrowser.reset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('fetches at most once a day', async () => {
    respond([walker]);
    await loadPlayers(0);
    expect(await loadPlayers(DAY - 1)).toEqual([walker]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    respond([travis]);
    expect(await loadPlayers(DAY)).toEqual([travis]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the last copy when a refresh fails', async () => {
    respond([walker]);
    await loadPlayers(0);
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    expect(await loadPlayers(2 * DAY)).toEqual([walker]);
  });

  it('fails when there is no copy to fall back to', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await expect(loadPlayers(0)).rejects.toThrow('offline');
  });
});
