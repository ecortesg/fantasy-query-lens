// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { scanPage } from '../lib/page/scan';
import { keepMarked } from '../lib/page/watch';
import { page, player } from './helpers';

const gibbs = player('9221', 'Jahmyr Gibbs', ['RB'], 'DET');
const settle = () => new Promise((r) => setTimeout(r, 20));
const marked = (doc: Document) => [...doc.querySelectorAll('mark')].map((m) => m.textContent);

let stop = () => {};
afterEach(() => stop());

/** A scanned page whose watcher scans again, as the content script does. */
function watched(tab = '<table><tr><td>Jahmyr Gibbs</td></tr></table>') {
  const doc = page(`<div id="tab">${tab}</div><div id="ad"></div>`);
  const request = { type: 'fq-lens:scan' as const, players: [gibbs], kinds: {} };
  scanPage(doc, request);
  const remark = vi.fn(() => void scanPage(doc, request));
  stop = keepMarked(doc.body, remark, { delayMs: 0 });
  const showTab = (html: string) => (doc.getElementById('tab')!.innerHTML = html);
  return { doc, remark, showTab };
}

describe('keepMarked', () => {
  it('marks again when a tab click draws a new table', async () => {
    const { doc, remark, showTab } = watched();
    showTab('<table><tr><td>Bijan Robinson</td><td>Jahmyr Gibbs</td></tr></table>');
    await settle();
    expect(remark.mock.calls).toEqual([[true]]);
    expect(marked(doc)).toEqual(['Jahmyr Gibbs']);
  });

  it('marks a player again when his tab comes back after a tab without him', async () => {
    const { doc, remark, showTab } = watched();
    showTab('<table><tr><td>Josh Allen</td></tr></table>');
    await settle();
    showTab('<table><tr><td>Jahmyr Gibbs</td></tr></table>');
    await settle();
    expect(remark.mock.calls).toEqual([[true], [false]]);
    expect(marked(doc)).toEqual(['Jahmyr Gibbs']);
  });

  it('marks the players when the page draws its table after it loads', async () => {
    const { doc, remark, showTab } = watched('');
    showTab('<table><tr><td>Jahmyr Gibbs</td></tr></table>');
    await settle();
    expect(remark.mock.calls).toEqual([[false]]);
    expect(marked(doc)).toEqual(['Jahmyr Gibbs']);
  });

  it('stays quiet when other parts of the page change', async () => {
    const { doc, remark } = watched();
    doc.getElementById('ad')!.innerHTML = '<iframe></iframe>';
    await settle();
    expect(remark).not.toHaveBeenCalled();
  });
});
