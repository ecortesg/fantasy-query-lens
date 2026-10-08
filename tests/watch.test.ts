// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findPlayers } from '../lib/page/find';
import { highlight } from '../lib/page/highlight';
import { keepMarked } from '../lib/page/watch';
import { page, player } from './helpers';

const gibbs = player('9221', 'Jahmyr Gibbs', ['RB'], 'DET');
const bijan = player('9509', 'Bijan Robinson', ['RB'], 'ATL');
const settle = () => new Promise((r) => setTimeout(r, 20));
const marked = (doc: Document) => [...doc.querySelectorAll('mark')].map((m) => `${m.textContent}:${m.dataset.fqLens}`);

function scanned() {
  const doc = page('<div id="tab"><table><tr><td>Jahmyr Gibbs</td></tr></table></div><div id="ad"></div>');
  highlight(findPlayers(doc.body, [gibbs]), () => 'bench');
  return doc;
}
const showTab = (doc: Document, html: string) => (doc.getElementById('tab')!.innerHTML = html);

let stop = () => {};
afterEach(() => stop());

describe('keepMarked', () => {
  it('marks the players again, in their latest colors, when a tab click draws a new table', async () => {
    const doc = scanned();
    const onChanged = vi.fn();
    stop = keepMarked(doc.body, [gibbs, bijan], (id) => (id === gibbs.id ? 'starter' : 'pickup'), onChanged, 0);
    showTab(doc, '<table><tr><td>Bijan Robinson</td><td>Jahmyr Gibbs</td></tr></table>');
    await settle();
    expect(marked(doc)).toEqual(['Bijan Robinson:pickup', 'Jahmyr Gibbs:starter']);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('marks a player again when his tab comes back after a tab without him', async () => {
    const doc = scanned();
    const onChanged = vi.fn();
    stop = keepMarked(doc.body, [gibbs], () => 'bench', onChanged, 0);
    showTab(doc, '<table><tr><td>Josh Allen</td></tr></table>');
    await settle();
    expect(marked(doc)).toEqual([]);
    showTab(doc, '<table><tr><td>Jahmyr Gibbs</td></tr></table>');
    await settle();
    expect(marked(doc)).toEqual(['Jahmyr Gibbs:bench']);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when other parts of the page change', async () => {
    const doc = scanned();
    const onChanged = vi.fn();
    stop = keepMarked(doc.body, [gibbs], () => 'bench', onChanged, 0);
    const mark = doc.querySelector('mark');
    doc.getElementById('ad')!.innerHTML = '<iframe></iframe>';
    await settle();
    expect(doc.querySelector('mark')).toBe(mark);
    expect(onChanged).not.toHaveBeenCalled();
  });
});
