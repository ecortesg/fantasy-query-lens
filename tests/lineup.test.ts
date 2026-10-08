import { describe, expect, it } from 'vitest';
import { buildLineup, type RankSet, type RosterPlayer } from '../lib/lineup';
import { player } from './helpers';

const qb1 = player('qb1', 'QB One', ['QB'], 'BUF');
const qb2 = player('qb2', 'QB Two', ['QB'], 'BAL');
const rb1 = player('rb1', 'RB One', ['RB'], 'DET');
const rb2 = player('rb2', 'RB Two', ['RB'], 'ATL');
const rb3 = player('rb3', 'RB Three', ['RB'], 'KC');
const wr1 = player('wr1', 'WR One', ['WR'], 'CIN');
const te1 = player('te1', 'TE One', ['TE'], 'KC');
const hurt = player('ir1', 'Hurt RB', ['RB'], 'SF');

const roster: RosterPlayer[] = [qb1, qb2, rb1, rb2, rb3, wr1, te1].map((p) => ({ player: p, status: 'active' }));
const list = (heading: string, positions: RankSet['positions'], ranks: Record<string, number>): RankSet => ({ heading, positions, ranks });

const qbs = list('QB', ['QB'], { qb2: 3, qb1: 8 });
const rbs = list('RB', ['RB'], { rb1: 2, rb2: 5, rb3: 20 });
const flex = list('FLEX', ['RB', 'WR', 'TE'], { rb2: 4, rb1: 6, wr1: 10, te1: 30, rb3: 40 });

const picks = (lineup: ReturnType<typeof buildLineup>) =>
  lineup.starters.map((s) => ('playerId' in s ? `${s.slot}:${s.playerId}` : `${s.slot}:-${s.missing}`));

describe('buildLineup', () => {
  it('fills each slot with the best-ranked eligible player', () => {
    const lineup = buildLineup(['QB', 'RB', 'RB', 'WR', 'TE', 'FLEX'], roster, [qbs, flex]);
    expect(picks(lineup)).toEqual(['QB:qb2', 'RB:rb2', 'RB:rb1', 'WR:wr1', 'TE:te1', 'FLEX:rb3']);
    expect(lineup.bench).toEqual([{ playerId: 'qb1', rank: 8, from: qbs }]);
  });

  it('fills FLEX from position lists by the best position rank', () => {
    const wrs = list('WR', ['WR'], { wr1: 4 });
    const tes = list('TE', ['TE'], { te1: 1 });
    const lineup = buildLineup(['RB', 'FLEX'], roster, [rbs, wrs, tes]);
    expect(picks(lineup)).toEqual(['RB:rb1', 'FLEX:te1']);
    expect(lineup.starters[1]).toEqual({ slot: 'FLEX', playerId: 'te1', rank: 1, from: tes });
  });

  it('says no one is left for FLEX, not that a list is missing, when the position lists rank no one left', () => {
    const wrs = list('WR', ['WR'], {});
    const tes = list('TE', ['TE'], {});
    expect(buildLineup(['FLEX'], [{ player: rb1, status: 'active' }], [list('RB', ['RB'], {}), wrs, tes]).starters[0]).toMatchObject({
      slot: 'FLEX',
      missing: 'player',
    });
  });

  it('cannot fill FLEX when the position lists miss one of its positions', () => {
    const lineup = buildLineup(['RB', 'FLEX'], roster, [rbs]);
    expect(picks(lineup)).toEqual(['RB:rb1', 'FLEX:-list']);
  });

  it('ranks the RB slot with the FLEX list when both exist (the cross-position list wins)', () => {
    // The RB list prefers rb1, the FLEX list prefers rb2.
    expect(picks(buildLineup(['RB'], roster, [rbs, flex]))).toEqual(['RB:rb2']);
  });

  it('fills the narrow slots before the wide ones, whatever their order', () => {
    expect(picks(buildLineup(['FLEX', 'RB', 'RB'], roster, [flex]))).toEqual(['FLEX:wr1', 'RB:rb2', 'RB:rb1']);
  });

  it('fills SUPER_FLEX for sure only from a list across QB, RB, WR and TE', () => {
    const guess = buildLineup(['SUPER_FLEX'], roster, [qbs, flex]).starters[0];
    expect(guess).toMatchObject({ playerId: 'qb2', from: qbs });
    const overall = list('Overall', ['QB', 'RB', 'WR', 'TE'], { rb2: 1, qb2: 2 });
    expect(picks(buildLineup(['QB', 'SUPER_FLEX'], roster, [overall]))).toEqual(['QB:qb2', 'SUPER_FLEX:rb2']);
  });

  it('leaves a slot empty when no list ranks a player left for it', () => {
    const tes = list('TE', ['TE'], { someoneElse: 1 });
    expect(buildLineup(['TE'], roster, [tes]).starters).toEqual([{ slot: 'TE', missing: 'player', from: [tes] }]);
  });

  it('passes a slot to the next list when a short preview has no one left for it', () => {
    // A 4-row preview of a FLEX list: it ranks only rb1 from this Roster.
    const preview = list('Premium flex', ['RB', 'WR', 'TE'], { rb1: 1, someoneElse: 2 });
    const wrs = list('WR', ['WR'], { wr1: 12 });
    const lineup = buildLineup(['RB', 'RB', 'WR'], roster, [preview, rbs, wrs]);
    expect(lineup.starters.map((s) => ('playerId' in s ? [s.playerId, s.rank, s.from.heading] : s))).toEqual([
      ['rb1', 1, 'Premium flex'],
      ['rb2', 5, 'RB'],
      ['wr1', 12, 'WR'],
    ]);
    expect(lineup.bench.map((b) => [b.playerId, b.from.heading])).toEqual([['rb3', 'RB']]);
  });

  it('never suggests IR or taxi players, and lists the unranked apart', () => {
    const withIr: RosterPlayer[] = [...roster, { player: hurt, status: 'ir' }];
    const lineup = buildLineup(['RB'], withIr, [list('RB', ['RB'], { ir1: 1, rb3: 9 })]);
    expect(picks(lineup)).toEqual(['RB:rb3']);
    expect(lineup.out).toEqual(['ir1']);
    expect(lineup.unranked).toEqual(['qb1', 'qb2', 'rb1', 'rb2', 'wr1', 'te1']);
  });

  it('reads the coverage of a list that does not state it from the players it ranks', () => {
    const top = list('Top 50', [], { wr1: 1, rb1: 2, te1: 3 });
    expect(picks(buildLineup(['FLEX'], roster, [top]))).toEqual(['FLEX:wr1']);
  });

  it('orders the bench by list before rank, since ranks from different lists are on different scales', () => {
    const preview = list('Premium flex', ['RB', 'WR', 'TE'], { rb3: 40 });
    const lineup = buildLineup([], roster, [preview, list('RB', ['RB'], { rb1: 2, rb2: 5 })]);
    expect(lineup.bench.filter((b) => b.from.positions.includes('RB')).map((b) => b.playerId)).toEqual(['rb3', 'rb1', 'rb2']);
  });

  it('lets a player with two positions fill either slot', () => {
    const hybrid = player('hy', 'Hybrid', ['QB', 'TE'], 'NO');
    const lineup = buildLineup(['TE'], [{ player: hybrid, status: 'active' }], [list('TE', ['TE'], { hy: 4 })]);
    expect(picks(lineup)).toEqual(['TE:hy']);
  });
});
