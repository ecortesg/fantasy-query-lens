import { norm } from '../names';
import type { Player } from '../players';
import { codeSpellings, teamCode } from '../teams';
import { headingBefore, headingPositions } from './ranks';
import { shownInRun, textRuns } from './text';

/** Where a name is written in one text node. */
export type Part = { node: Text; start: number; end: number };

/** One place a roster player's name appears on the page: one part, or more when the page splits the name. */
export type Hit = { player: Player; parts: Part[] };

/** Joins the pieces of a run of text. It is not a letter, so a name cannot end inside the next piece. */
const BREAK = '\u0000';
const PUNCT = "[.'’‘`\\u0000]*";
const SPACE = String.raw`[\s\u0000]*\s[\s\u0000]*`;
const SUFFIX = String.raw`(?:,?${SPACE}(?:Jr\.?|Sr\.?|II|III|IV|V))?`;
const DEFENSE_WORD = String.raw`(?:${SPACE}(?:D\/ST|DST|DEF|Defense))`;

/**
 * A name as a page may write it: any case, optional periods and apostrophes
 * between letters ("D.J." = "DJ", "Ja'Marr" = "JaMarr"), hyphens or spaces
 * between words, and an optional suffix ("Kenneth Walker" = "Kenneth Walker III").
 */
export function namePattern(name: string): string {
  return norm(name)
    .split(' ')
    .map((word) => [...word].join(PUNCT))
    .join(`${PUNCT}[\\s\\-–][\\s\\-–\\u0000]*`);
}

/**
 * A defense answers to its full name, its nickname and its team code
 * ("Baltimore Ravens", "Ravens D/ST", "BAL"). Only in a defense context,
 * though: see `isDefenseHit`.
 */
function playerPattern(player: Player): string {
  if (!player.positions.includes('DEF')) return namePattern(player.name) + SUFFIX;
  const nickname = player.name.split(' ').at(-1)!;
  return [namePattern(player.name), namePattern(nickname), ...codeSpellings(player.team)]
    .map((name) => `${name}${DEFENSE_WORD}?`)
    .join('|');
}

/**
 * Whether a defense's name is about the defense. "SF" is in the Team column of
 * every 49ers player's row, and "49ers" is in headlines, so a bare name counts
 * only in a row or list about defenses. A bare code must be in capitals ("NO",
 * not "no"). A name after "@", "vs." or "at" in a row is the opponent.
 */
function isDefenseHit(node: Text, start: number, text: string): boolean {
  const entry = node.parentElement?.closest(ENTRY);
  if (entry && /(?:@|\b(?:vs?|at)\.?)\s*$/i.test(textBefore(entry, node, start))) return false;
  if (new RegExp(`${DEFENSE_WORD}$`, 'i').test(text)) return true;
  if (teamCode(text.toUpperCase()) && text !== text.toUpperCase()) return false;
  if (!entry) return false;
  const aboutDefense = (words: string) => /\b(DST|DEF|D ST|defen[cs]es?)\b/i.test(words);
  if (aboutDefense(words(entry).join(' '))) return true;
  const list = entry.closest('table, ol, ul') ?? entry;
  return headingPositions(headingBefore(list)).includes('DEF');
}

/**
 * An element's text up to a point in one of its text nodes, with a space at
 * each node edge: `<td>BUF</td><td>vs. NE</td>` reads "BUF vs. ", not "BUFvs. ".
 */
function textBefore(element: Element, node: Text, offset: number): string {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const before: string[] = [];
  for (let n = walker.nextNode(); n && n !== node; n = walker.nextNode()) before.push(n.nodeValue ?? '');
  return [...before, node.data.slice(0, offset)].join(' ');
}

/** Text we never read: code, form fields, and our own marks. */
const SKIP = 'script, style, noscript, textarea, input, select, option, [contenteditable], mark[data-fq-lens]';

/** The nearest element that reads as one ranked entry: a table row, list item, or heading. */
export const ENTRY = 'tr, li, h1, h2, h3, h4, h5, h6';

/**
 * Whether the text around a name agrees with the player's team. A row that
 * names NFL teams must name this one, so a namesake on another team is left alone.
 * Prose outside a row is always accepted.
 */
function fitsTeam(node: Text, player: Player): boolean {
  const entry = node.parentElement?.closest(ENTRY);
  if (!entry) return true;
  const teams = new Set(words(entry).flatMap((w) => teamCode(w) ?? []));
  return teams.size === 0 || teams.has(player.team);
}

/** The words of an element, split at element edges too: `<td>Walker</td><td>SEA</td>` is two words. */
export function words(element: Element): string[] {
  const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const out: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    out.push(...(node.nodeValue ?? '').split(/[^A-Za-z]+/).filter(Boolean));
  }
  return out;
}

/**
 * Names per regex. V8 compiles a regex to machine code on its second run, and
 * that time grows much faster than the regex: in Chrome, 2,180 names in one
 * regex took 960 ms, in groups of 100 they took 330 ms (ADR-0006).
 */
const GROUP = 100;

type Match = { index: number; text: string; order: number };

export function findPlayers(root: Element, players: readonly Player[]): Hit[] {
  if (players.length === 0) return [];
  // Namesakes share a pattern, and the first one whose team fits the row gets the match.
  const byPattern = Map.groupBy(players, playerPattern);
  const patterns = [...byPattern.keys()];
  // One capture group per pattern, so the group that matched names the players.
  const regexes = Array.from({ length: Math.ceil(patterns.length / GROUP) }, (_, g) => {
    const alternatives = patterns.slice(g * GROUP, (g + 1) * GROUP).map((p) => `(${p})`).join('|');
    return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives})(?![\\p{L}\\p{N}])`, 'giu');
  });

  const shown = shownInRun();
  const hits: Hit[] = [];
  // A row names a player once: Yahoo's defense rows write "SF" as the player and again as the team.
  const marked = new Map<Element, Set<string>>();
  for (const run of textRuns(root, (node) => !node.parentElement?.closest(SKIP))) {
    // Pieces the page hides are left out: CBS writes "Jahmyr J. Gibbs" and shows "Jahmyr Gibbs".
    const nodes = run.length > 1 ? run.filter(shown) : run;
    const starts: number[] = [];
    let text = '';
    for (const [i, node] of nodes.entries()) {
      if (i > 0) text += BREAK;
      starts.push(text.length);
      text += node.data;
    }
    const matches: Match[] = regexes.flatMap((regex, g) =>
      [...text.matchAll(regex)].map((m) => ({ index: m.index, text: m[0], order: g * GROUP + m.slice(1).findIndex((x) => x !== undefined) })),
    );
    // In page order. Where two regexes match the same text, the earlier pattern wins, as in one regex.
    matches.sort((a, b) => a.index - b.index || a.order - b.order);
    let free = 0;
    for (const match of matches) {
      if (match.index < free) continue;
      // A piece with only spaces gets no part: a mark would make it a box in a flex layout.
      const parts = nodes.flatMap((node, i) => {
        const start = Math.max(match.index - starts[i]!, 0);
        const end = Math.min(match.index + match.text.length - starts[i]!, node.length);
        return start < end && node.data.slice(start, end).trim() ? [{ node, start, end }] : [];
      });
      const { node, start } = parts[0]!;
      const player = byPattern.get(patterns[match.order]!)!.find(
        (p) => fitsTeam(node, p) && (!p.positions.includes('DEF') || isDefenseHit(node, start, match.text.replaceAll(BREAK, ''))),
      );
      if (!player) continue;
      const entry = node.parentElement?.closest(ENTRY);
      if (entry) {
        const inEntry = marked.get(entry) ?? new Set();
        if (inEntry.has(player.id)) continue;
        marked.set(entry, inEntry.add(player.id));
      }
      hits.push({ player, parts });
      free = match.index + match.text.length;
    }
  }
  return hits;
}

