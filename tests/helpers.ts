import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import type { Player } from '../lib/players';

const sites: Record<string, string> = {
  yahoo: 'https://sports.yahoo.com/fantasy/article/rankings.html',
  ffballers: 'https://www.thefantasyfootballers.com/2026-running-back-rankings/',
  nbc: 'https://www.nbcsports.com/fantasy/football/news/week-3-fantasy-football-rankings-rb',
  rotoballer: 'https://www.rotoballer.com/week-3-running-back-rb-rankings-for-fantasy-football-weekend-updates-2026/1950809',
};

/** A saved page, at the site it was saved from. Trim it with `pnpm fixture:trim`. */
export const fixture = (name: string) =>
  new JSDOM(readFileSync(resolve('tests/fixtures', `${name}.html`), 'utf8'), {
    url: sites[name.split('-')[0]!],
  }).window.document;

export const page = (body: string, head = '') =>
  new JSDOM(`<!doctype html><head>${head}</head><body>${body}</body>`, { url: 'https://example.com/' }).window
    .document;

export const player = (id: string, name: string, positions: Player['positions'], team: string): Player => ({
  id,
  name,
  positions,
  team,
});
