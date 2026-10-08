// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findPlayers } from '../lib/page/find';
import { highlight } from '../lib/page/highlight';
import { watchMarks } from '../lib/page/watch';
import { page, player } from './helpers';

const gibbs = player('9221', 'Jahmyr Gibbs', ['RB'], 'DET');
const settle = () => new Promise((r) => setTimeout(r, 20));

function scanned() {
  const doc = page('<div id="tab"><table><tr><td>Jahmyr Gibbs</td></tr></table></div><div id="ad"></div>');
  highlight(findPlayers(doc.body, [gibbs]), () => 'starter');
  return doc;
}

let stop = () => {};
afterEach(() => stop());

describe('watchMarks', () => {
  it('tells once when the page removes a mark, as a tab click does', async () => {
    const doc = scanned();
    const onGone = vi.fn();
    stop = watchMarks(doc.body, onGone, 0);
    doc.getElementById('tab')!.innerHTML = '<table><tr><td>Bijan Robinson</td></tr></table>';
    await settle();
    doc.getElementById('tab')!.innerHTML = '';
    await settle();
    expect(onGone).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when other parts of the page change', async () => {
    const doc = scanned();
    const onGone = vi.fn();
    stop = watchMarks(doc.body, onGone, 0);
    doc.getElementById('ad')!.innerHTML = '<iframe></iframe>';
    await settle();
    expect(onGone).not.toHaveBeenCalled();
  });
});
