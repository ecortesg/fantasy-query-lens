// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { scanPage } from '../lib/page/scan';
import type { Player } from '../lib/players';
import { fixture, page, player } from './helpers';

const allen = player('4984', 'Josh Allen', ['QB'], 'BUF');
const lamar = player('4881', 'Lamar Jackson', ['QB'], 'BAL');
const gibbs = player('9221', 'Jahmyr Gibbs', ['RB'], 'DET');
const walker = player('8151', 'Kenneth Walker', ['RB'], 'KC');
const bijan = player('9509', 'Bijan Robinson', ['RB'], 'ATL');
const stBrown = player('7547', 'Amon-Ra St. Brown', ['WR'], 'DET');

const scan = (doc: Document, players: Player[]) =>
  scanPage(doc, { type: 'fq-lens:scan', players, kinds: {} });

describe('Yahoo', () => {
  it('reads the FLEX table as one cross-position list by Justin Boone', () => {
    const { source, lists } = scan(fixture('yahoo-boone-flex-week3'), [gibbs, walker, stBrown]);
    expect(source).toMatchObject({ siteName: 'Yahoo Sports', author: 'Justin Boone', week: 3 });
    expect(lists).toHaveLength(1);
    expect(lists[0]!.heading).toBe('Week 3 FLEX Rankings');
    expect(lists[0]!.positions.toSorted()).toEqual(['RB', 'TE', 'WR']);
    expect(lists[0]!.rankers).toEqual([
      { name: 'Justin Boone', ranks: { '9221': 1, '8151': 2, '7547': 9 } },
    ]);
  });

  it('reads one list per scoring format on the positions page', () => {
    const { lists } = scan(fixture('yahoo-boone-positions-week3'), [allen]);
    expect(lists.map((l) => [l.format, l.positions, l.rankers[0]!.ranks])).toEqual([
      ['HALF', ['QB'], { '4984': 1 }],
      ['PPR', ['QB'], { '4984': 1 }],
    ]);
  });

  it('reads the defenses table, where each defense is its team code', () => {
    const niners = player('SF', 'San Francisco 49ers', ['DEF'], 'SF');
    const ravens = player('BAL', 'Baltimore Ravens', ['DEF'], 'BAL');
    const doc = fixture('yahoo-boone-defenses-week3');
    const { lists } = scan(doc, [niners, ravens]);
    expect(lists.map((l) => [l.positions, l.rankers[0]!.ranks])).toEqual([[['DEF'], { SF: 7, BAL: 17 }]]);
  });

  it("gives a defense the rank of its own row, not of the row where it is the opponent", () => {
    const def = (code: string, name: string) => player(code, name, ['DEF'], code);
    // WAS and MIA are first opponents after "@", ATL after "vs." (row 6, "GB DST GB vs. ATL").
    const defenses = [def('SEA', 'Seattle Seahawks'), def('WAS', 'Washington Commanders'), def('MIA', 'Miami Dolphins'), def('ATL', 'Atlanta Falcons')];
    const { lists } = scan(fixture('yahoo-boone-defenses-week3'), defenses);
    expect(lists[0]!.rankers[0]!.ranks).toEqual({ SEA: 1, WAS: 30, MIA: 32, ATL: 26 });
  });
});

describe('Fantasy Footballers', () => {
  it('reads consensus and each analyst, the position from the heading, and the format from the select', () => {
    const { source, lists } = scan(fixture('ffballers-rb-week3'), [walker, gibbs, bijan]);
    expect(source).toMatchObject({ siteName: 'Fantasy Footballers Podcast', author: undefined, week: 3, format: 'STD' });
    expect(lists).toHaveLength(1);
    const [list] = lists;
    expect(list!.positions).toEqual(['RB']);
    expect(list!.format).toBe('STD');
    expect(list!.rankers.map((r) => r.name)).toEqual(['Consensus', 'Andy', 'Jason', 'Mike']);
    expect(list!.rankers[0]!.ranks['8151']).toBe(1);
    expect(list!.rankers[2]!.ranks['8151']).toBe(2);
  });

  it('reads the QB page as a QB list', () => {
    const { lists } = scan(fixture('ffballers-qb-week3'), [lamar]);
    expect(lists.map((l) => [l.positions, l.rankers[0]!.ranks])).toEqual([[['QB'], { '4881': 1 }]]);
  });

  it('gives a defense the rank of its own row, not of the row where it is the opponent with no "vs."', () => {
    // The Opp column writes a home opponent bare: "Washington Commanders WAS (7) NYG 11".
    const giants = player('NYG', 'New York Giants', ['DEF'], 'NYG');
    const bengals = player('CIN', 'Cincinnati Bengals', ['DEF'], 'CIN');
    const { lists } = scan(fixture('ffballers-dst-week5'), [giants, bengals]);
    expect(lists.map((l) => [l.positions, l.rankers.map((r) => [r.name, r.ranks])])).toEqual([
      [
        ['DEF'],
        [
          ['Consensus', { NYG: 18, CIN: 2 }],
          ['Andy', { NYG: 18, CIN: 2 }],
          ['Jason', { NYG: 18, CIN: 3 }],
          ['Mike', { NYG: 18, CIN: 2 }],
        ],
      ],
    ]);
  });
});

describe('tables with no <th> header row', () => {
  it('reads NBC Sports, where the table has no header row', () => {
    const { lists } = scan(fixture('nbc-daugherty-rb-week3'), [gibbs, walker, bijan]);
    expect(lists.map((l) => [l.positions, l.rankers])).toEqual([
      [['RB'], [{ name: 'Patrick Daugherty', ranks: { '9221': 1, '9509': 2, '8151': 3 } }]],
    ]);
  });

  it('reads RotoBaller, where the header row is made of td cells', () => {
    const { lists } = scan(fixture('rotoballer-roberts-rb-week3'), [gibbs, walker, bijan]);
    expect(lists.map((l) => [l.positions, l.rankers[0]])).toEqual([
      [['RB'], { name: 'Alex Roberts', ranks: { '9221': 1, '8151': 2, '9509': 3 } }],
    ]);
  });
});

describe('generic pages', () => {
  it('takes the rank from the Rank cell, so a sorted table still reads right', () => {
    const doc = page(`<h2>Week 5 RB Rankings (PPR)</h2><table>
      <thead><tr><th>Rk</th><th>Player</th><th>Bye</th></tr></thead>
      <tbody>
        <tr><td>3</td><td>Bijan Robinson</td><td>5</td></tr>
        <tr><td>2</td><td>Kenneth Walker</td><td>7</td></tr>
        <tr><td>1</td><td>Jahmyr Gibbs</td><td>5</td></tr>
      </tbody></table>`);
    const { lists, source } = scan(doc, [gibbs, walker, bijan]);
    expect(source.week).toBeUndefined();
    expect(lists).toEqual([
      {
        heading: 'Week 5 RB Rankings (PPR)',
        positions: ['RB'],
        format: 'PPR',
        rankers: [{ name: 'example.com', ranks: { '9509': 3, '8151': 2, '9221': 1 } }],
      },
    ]);
  });

  it('reads a numbered list and "1. Name, TEAM" headings', () => {
    const doc = page(
      `<h2>Top RBs</h2><ol start="4"><li>Jahmyr Gibbs</li><li>Bijan Robinson</li></ol>
       <h2>Quarterbacks</h2><div><h3>1. Josh Allen, BUF</h3><p>Great matchup.</p><h3>2. Lamar Jackson, BAL</h3></div>`,
      '<meta name="author" content="Pat Ranker">',
    );
    expect(scan(doc, [gibbs, bijan, allen, lamar]).lists).toEqual([
      { heading: 'Top RBs', positions: ['RB'], format: undefined, rankers: [{ name: 'Pat Ranker', ranks: { '9221': 4, '9509': 5 } }] },
      { heading: 'Quarterbacks', positions: ['QB'], format: undefined, rankers: [{ name: 'Pat Ranker', ranks: { '4984': 1, '4881': 2 } }] },
    ]);
  });

  it('leaves prose mentions out of the lists', () => {
    expect(scan(page('<p>Start Jahmyr Gibbs this week.</p>'), [gibbs]).lists).toEqual([]);
  });

  it('leaves out lists from later infinite-scroll articles', () => {
    const table = (n: number) =>
      `<h2>RB</h2><table><tr><th>Rank</th><th>Player</th></tr><tr><td>${n}</td><td>Jahmyr Gibbs</td></tr><tr><td>${n + 1}</td><td>X</td></tr></table>`;
    const lists = scan(page(`<article>${table(1)}</article><article>${table(7)}</article>`), [gibbs]).lists;
    expect(lists.map((l) => l.rankers[0]!.ranks)).toEqual([{ '9221': 1 }]);
  });
});

describe('coverage', () => {
  it('adds the heading positions to a Pos column that shows only a few rows', () => {
    const doc = page(`<h2>Premium flex rankings for week 3</h2><table>
      <thead><tr><th>Player</th><th>Pos</th><th>Rank</th></tr></thead>
      <tbody><tr><td>Kenneth Walker</td><td>RB</td><td>1</td></tr><tr><td>Jahmyr Gibbs</td><td>RB</td><td>2</td></tr></tbody></table>`);
    expect(scan(doc, [walker]).lists[0]!.positions.toSorted()).toEqual(['RB', 'TE', 'WR']);
  });
});

describe('rank columns', () => {
  it('names a ranker by the header text the page shows', () => {
    const doc = page(
      `<h2>RB</h2><table><tr><th>Rank</th><th>Player</th>
         <th><a>Pat Fitzmaurice</a><a class="short">P. Fitzm...</a><div>9/23</div></th>
         <th><a>JAMEY</a><div class="card">Jamey Eisenberg<div>Senior Fantasy Writer</div></div></th></tr>
       <tr><td>1</td><td>Jahmyr Gibbs</td><td>2</td><td>1</td></tr><tr><td>2</td><td>Bijan Robinson</td><td>1</td><td>2</td></tr></table>`,
      '<style>.short, .card { display: none }</style>',
    );
    expect(scan(doc, [gibbs]).lists[0]!.rankers.map((r) => r.name)).toEqual(['Consensus', 'Pat Fitzmaurice', 'JAMEY']);
  });

  it("names a generic rank the page's ranker, and ECR the consensus", () => {
    const doc = page(
      `<h2>QB</h2><table><tr><th>#</th><th>Player</th><th>ECR</th></tr>
       <tr><td>1</td><td>Josh Allen</td><td>2</td></tr><tr><td>2</td><td>Lamar Jackson</td><td>1</td></tr></table>`,
      '<meta name="author" content="The Wolf">',
    );
    expect(scan(doc, [allen, lamar]).lists[0]!.rankers).toEqual([
      { name: 'The Wolf', ranks: { '4984': 1, '4881': 2 } },
      { name: 'Consensus', ranks: { '4984': 2, '4881': 1 } },
    ]);
  });

  it('reads a later page of a list, where ranks start past 1', () => {
    const rows = Array.from({ length: 50 }, (_, i) => `<tr><td>${151 + i}</td><td>${i === 3 ? 'Jahmyr Gibbs' : `P${i}`}</td></tr>`);
    const doc = page(`<h2>RB</h2><table><tr><th>Rank</th><th>Player</th></tr>${rows.join('')}</table>`);
    expect(scan(doc, [gibbs]).lists[0]!.rankers[0]!.ranks).toEqual({ '9221': 154 });
  });
});
