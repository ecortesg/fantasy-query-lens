// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { findPlayers, type Hit } from '../lib/page/find';
import { clearHighlights, highlight } from '../lib/page/highlight';
import { fixture, page, player } from './helpers';

const walker = player('1', 'Kenneth Walker III', ['RB'], 'KC');
const moore = player('2', 'D.J. Moore', ['WR'], 'CHI');
const chase = player('3', "Ja'Marr Chase", ['WR'], 'CIN');
const stBrown = player('4', 'Amon-Ra St. Brown', ['WR'], 'DET');
const gibbs = player('5', 'Jahmyr Gibbs', ['RB'], 'DET');
const higbee = player('9', 'Tyler Higbee', ['TE'], 'LAR');
const ravens = player('BAL', 'Baltimore Ravens', ['DEF'], 'BAL');

const text = (hit: Hit) => hit.parts.map((p) => p.node.data.slice(p.start, p.end)).join('');
const texts = (doc: Document, players = [walker, moore, chase, stBrown, gibbs, ravens]) => findPlayers(doc.body, players).map(text);

describe('findPlayers', () => {
  it('reads names the way pages write them', () => {
    const doc = page(
      `<p>Kenneth Walker III, DJ Moore, Ja’Marr Chase, Amon-Ra St Brown, Ravens D/ST and BAL DST.</p>`,
    );
    expect(texts(doc)).toEqual([
      'Kenneth Walker III',
      'DJ Moore',
      'Ja’Marr Chase',
      'Amon-Ra St Brown',
      'Ravens D/ST',
      'BAL DST',
    ]);
  });

  it('matches whole names only', () => {
    expect(texts(page('<p>Jahmyr Gibbsons and XJahmyr Gibbs</p>'))).toEqual([]);
  });

  it('skips a row that names another team', () => {
    const doc = page(`<table>
      <tr><td>Kenneth Walker</td><td>KC</td></tr>
      <tr><td>Kenneth Walker</td><td>WR</td><td>JAC</td></tr>
      <tr><td>Kenneth Walker</td></tr>
    </table>`);
    expect(findPlayers(doc.body, [walker]).map((h) => h.parts[0]!.node.parentElement!.closest('tr')!.rowIndex)).toEqual([0, 2]);
  });

  it('gives a row to the namesake on its team', () => {
    const lb = player('lb', 'Justin Jefferson', ['LB'], 'CLE');
    const wr = player('wr', 'Justin Jefferson', ['WR'], 'MIN');
    const doc = page(`<table>
      <tr><td>Justin Jefferson</td><td>MIN</td></tr>
      <tr><td>Justin Jefferson</td><td>CLE</td></tr>
    </table>`);
    expect(findPlayers(doc.body, [lb, wr]).map((h) => h.player.id)).toEqual(['wr', 'lb']);
  });

  it('finds players past the first hundred', () => {
    const many = Array.from({ length: 250 }, (_, i) => player(`p${i}`, `Player ${'x'.repeat(i + 1)}`, ['WR'], 'KC'));
    const doc = page(`<p>Player ${'x'.repeat(150)} and Player ${'x'.repeat(250)}</p>`);
    expect(findPlayers(doc.body, many).map((h) => h.player.id)).toEqual(['p149', 'p249']);
  });

  it('ignores scripts and form fields', () => {
    expect(texts(page('<script>"Jahmyr Gibbs"</script><textarea>Jahmyr Gibbs</textarea>'))).toEqual([]);
  });

  it('finds Yahoo names with their suffix', () => {
    const found = texts(fixture('yahoo-boone-flex-week3'), [walker, gibbs]);
    expect(found).toContain('Kenneth Walker III');
    expect(found).toContain('Jahmyr Gibbs');
  });

  it('joins a name the page splits into pieces, and leaves out hidden pieces', () => {
    const doc = page(
      `<table>
        <tr><td><a><span>J</span><span class="short">.</span><span>osh</span> <span>Allen</span></a></td></tr>
        <tr><td><a><span>Jahmyr </span><span class="short">J. </span>Gibbs</a><span>DET</span></td></tr>
      </table>`,
      '<style>.short { display: none }</style>',
    );
    const hits = findPlayers(doc.body, [player('6', 'Josh Allen', ['QB'], 'BUF'), gibbs]);
    // The space between the pieces gets no part.
    expect(hits.map((h) => h.parts.map((p) => p.node.data.slice(p.start, p.end)))).toEqual([
      ['J', 'osh', 'Allen'],
      ['Jahmyr ', 'Gibbs'],
    ]);
  });

  it('does not join names across table cells', () => {
    expect(texts(page('<table><tr><td>Jahmyr</td><td>Gibbs</td></tr></table>'))).toEqual([]);
  });

  it('finds Fantasy Footballers names without a suffix', () => {
    expect(texts(fixture('ffballers-rb-week3'), [walker])).toContain('Kenneth Walker');
  });
});

describe('defenses', () => {
  const niners = player('SF', 'San Francisco 49ers', ['DEF'], 'SF');
  const cmc = player('4034', 'Christian McCaffrey', ['RB'], 'SF');
  const found = (body: string, players = [niners, cmc]) =>
    findPlayers(page(body).body, players).map((h) => `${h.player.id}:${text(h)}`);

  it('reads a bare team code in a DST row, once per row', () => {
    expect(found('<table><tr><td>7</td><td>SF</td><td>DST</td><td>SF</td><td>vs. ARI</td></tr></table>')).toEqual(['SF:SF']);
  });

  it('does not read the Team column of a player on that team as the defense', () => {
    expect(found('<table><tr><td>4</td><td>Christian McCaffrey</td><td>RB</td><td>SF</td></tr></table>')).toEqual([
      '4034:Christian McCaffrey',
    ]);
  });

  it('does not read a nickname or full name in prose as the defense', () => {
    expect(found('<h3>49ers Player Imposter</h3><p>The San Francisco 49ers traveled.</p>')).toEqual([]);
  });

  it('reads any name followed by a defense word, anywhere', () => {
    expect(found('<p>Stream the 49ers D/ST this week.</p>')).toEqual(['SF:49ers D/ST']);
  });

  it('reads names in a list under a defense heading', () => {
    expect(found('<h2>Week 3 Defense Rankings</h2><ol><li>49ers</li><li>Ravens</li></ol>')).toEqual(['SF:49ers']);
  });

  it('needs capitals for a bare code', () => {
    const saints = player('NO', 'New Orleans Saints', ['DEF'], 'NO');
    expect(found('<table><tr><td>no</td><td>DST</td></tr><tr><td>NO</td><td>DST</td></tr></table>', [saints])).toEqual([
      'NO:NO',
    ]);
  });
});

describe('highlight', () => {
  it('marks every hit, even two in one text node, and clears back to the original text', () => {
    const doc = page('<p>Start Jahmyr Gibbs over Kenneth Walker III.</p>');
    const before = doc.body.innerHTML;
    const marks = highlight(findPlayers(doc.body, [walker, gibbs]), (id) => (id === '5' ? 'starter' : 'bench'));

    expect(marks.map((m) => [m.textContent, m.dataset.fqLens])).toEqual([
      ['Jahmyr Gibbs', 'starter'],
      ['Kenneth Walker III', 'bench'],
    ]);
    expect(doc.body.textContent).toBe('Start Jahmyr Gibbs over Kenneth Walker III.');

    clearHighlights(doc.body);
    expect(doc.body.innerHTML).toBe(before);
    expect(doc.body.querySelector('p')!.childNodes).toHaveLength(1);
  });

  it('marks each shown piece of a split name, and clears back to the original text', () => {
    const doc = page('<p><a><span>Jahmyr </span><span hidden>J. </span>Gibbs</a></p>');
    const before = doc.body.innerHTML;
    const marks = highlight(findPlayers(doc.body, [gibbs]), () => 'starter');
    expect(marks.map((m) => [m.textContent, m.dataset.fqLensPiece])).toEqual([
      ['Jahmyr ', ''],
      ['Gibbs', ''],
    ]);

    clearHighlights(doc.body);
    expect(doc.body.innerHTML).toBe(before);
  });

  it('gives filled marks dark text, even inside a light link on a dark page', () => {
    const doc = page(
      '<style>a, a * { color: rgb(147, 197, 253); }</style><p><a>Jahmyr Gibbs</a> <a>Kenneth Walker III</a> <a>D.J. Moore</a> <a>Tyler Higbee</a></p>',
    );
    const kinds = { '5': 'starter', '1': 'bench', '2': 'other', '9': 'pickup' } as const;
    const marks = highlight(findPlayers(doc.body, [walker, moore, gibbs, higbee]), (id) => kinds[id as keyof typeof kinds]);
    const view = doc.defaultView!;
    expect(marks.map((m) => [m.dataset.fqLens, view.getComputedStyle(m).color])).toEqual([
      ['starter', 'rgb(23, 23, 23)'],
      ['bench', 'rgb(23, 23, 23)'],
      ['other', 'rgb(147, 197, 253)'],
      ['pickup', 'rgb(147, 197, 253)'],
    ]);
  });

  it('does not match its own marks again', () => {
    const doc = page('<p>Jahmyr Gibbs</p>');
    highlight(findPlayers(doc.body, [gibbs]), () => 'starter');
    expect(findPlayers(doc.body, [gibbs])).toEqual([]);
  });
});
