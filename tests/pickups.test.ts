import { describe, expect, it } from 'vitest';
import type { League, Slot } from '../lib/league';
import type { Position } from '../lib/players';
import { buildLineup, type RankSet, type RosterPlayer } from '../lib/lineup';
import { availablePlayers, findPickups, type Pickup } from '../lib/pickups';
import { player } from './helpers';

const mine = (id: string, status: RosterPlayer['status'] = 'active', position: Position = 'RB'): RosterPlayer => ({
  player: player(id, id, [position], 'KC'),
  status,
});
const list = (positions: RankSet['positions'], ranks: Record<string, number>): RankSet => ({ heading: '', positions, ranks });
const ids = (pickups: Pickup[]) =>
  pickups.map((p) => ('slot' in p ? `${p.playerId} for ${p.slot}` : 'replaces' in p ? `${p.playerId} starts over ${p.replaces.playerId}` : `${p.playerId} beats ${p.over.playerId}`));

describe('findPickups', () => {
  const roster = [mine('rb1'), mine('rb2'), mine('hurt', 'ir')];
  const rostered = new Set(['rb1', 'rb2', 'hurt', 'theirs']);
  const byId = new Map(
    [
      player('fa1', 'fa1', ['RB'], 'KC'),
      player('fa2', 'fa2', ['RB'], 'KC'),
      player('wr', 'wr', ['WR'], 'KC'),
      player('te', 'te', ['TE'], 'KC'),
      player('qb', 'qb', ['QB'], 'KC'),
      player('BUF', 'Buffalo Bills', ['DEF'], 'BUF'),
      player('BAL', 'Baltimore Ravens', ['DEF'], 'BAL'),
    ].map((p) => [p.id, p]),
  );
  const pickups = (slots: Slot[], lists: RankSet[], team: RosterPlayer[] = roster) =>
    ids(
      findPickups({
        slots,
        roster: team,
        lists,
        starters: buildLineup(slots, team, lists).starters,
        rostered: new Set([...rostered, ...team.map((r) => r.player.id)]),
        byId,
      }),
    );

  it('puts a player the Lineup would start before one who only beats a bench player, and leaves out IR', () => {
    const rbs = list(['RB'], { fa1: 1, rb1: 2, theirs: 3, fa2: 4, rb2: 5, hurt: 6, fa3: 7 });
    expect(pickups(['RB'], [rbs])).toEqual(['fa1 starts over rb1', 'fa2 beats rb2']);
  });

  it('names the starter who goes to the bench, not the one the player passes', () => {
    // fa1 takes the RB Slot, and rb1 moves to FLEX in place of the WR.
    const team = [mine('rb1'), mine('wr1', 'active', 'WR')];
    const flex = list(['RB', 'WR', 'TE'], { fa1: 1, rb1: 2, wr1: 3 });
    expect(pickups(['RB', 'FLEX'], [flex], team)).toEqual(['fa1 starts over wr1']);
  });

  it('does not start a player only because a FLEX list ranks him over a starter at another position', () => {
    // te ranks over rb1, but cannot play RB, and wr1 keeps FLEX.
    const team = [mine('rb1'), mine('te1', 'active', 'TE'), mine('wr1', 'active', 'WR'), mine('wr2', 'active', 'WR')];
    const flex = list(['RB', 'WR', 'TE'], { te1: 1, wr1: 2, te: 3, rb1: 4, wr2: 5 });
    expect(pickups(['RB', 'TE', 'FLEX'], [flex], team)).toEqual(['te beats wr2']);
  });

  it('starts a player from a list that ranked none of the user\'s players', () => {
    // FLEX reads the preview only once it ranks a player the user has.
    const preview = list(['RB', 'WR', 'TE'], { theirs: 1, wr: 2 });
    const flex = list(['RB', 'WR', 'TE'], { rb1: 1, rb2: 2 });
    expect(pickups(['RB', 'FLEX'], [preview, flex])).toEqual(['wr starts over rb2']);
  });

  it('compares across positions in a list one Slot reads, each player once', () => {
    const rbs = list(['RB'], { fa1: 1, rb1: 2, rb2: 3 });
    const flex = list(['RB', 'WR', 'TE'], { wr: 1, fa1: 2, rb1: 3, rb2: 4 });
    expect(pickups(['RB', 'FLEX'], [rbs, flex])).toEqual(['wr starts over rb2', 'fa1 starts over rb2']);
  });

  it('leaves out a list no Slot reads', () => {
    const superflex = list(['QB', 'RB', 'WR', 'TE'], { qb: 1, rb2: 2 });
    expect(pickups(['RB'], [superflex])).toEqual([]);
  });

  it('fills a Slot the user has no ranked player for with the best available one', () => {
    const defenses = list(['DEF'], { theirs: 1, BUF: 2, BAL: 3 });
    expect(pickups(['RB', 'DEF'], [defenses])).toEqual(['BUF for DEF']);
  });

  it('fills an empty FLEX from the best rank across the position lists', () => {
    const lists = [list(['RB'], { rb1: 1, rb2: 2, fa1: 5 }), list(['WR'], { wr: 3 }), list(['TE'], { te: 9 })];
    expect(pickups(['RB', 'RB', 'FLEX'], lists)).toEqual(['wr for FLEX']);
  });

  it('fills an empty Slot only with a player it takes', () => {
    const superflex = list(['QB', 'RB', 'WR', 'TE'], { qb: 1, wr: 2, rb1: 3, rb2: 4 });
    expect(pickups(['RB', 'RB', 'WR'], [superflex])).toEqual(['wr for WR']);
  });
});

describe('availablePlayers', () => {
  const league = (rostered?: string[]): League => ({
    id: 'L:me',
    name: 'L',
    scoring: 'PPR',
    slots: ['RB', 'FLEX'],
    roster: [],
    sleeper: { leagueId: 'L', userId: 'me', username: 'me', rosterFetchedAt: 0, rostered },
  });
  const players = [
    player('taken', 'Taken', ['RB'], 'KC'),
    player('free', 'Free', ['WR'], 'KC'),
    player('qb', 'Quarterback', ['QB'], 'KC'),
  ];

  it('is the players on no team, at a position a Slot takes', () => {
    expect(availablePlayers(league(['taken']), players).map((p) => p.id)).toEqual(['free']);
  });

  it('is none before the other teams are known', () => {
    expect(availablePlayers(league(), players)).toEqual([]);
  });
});
