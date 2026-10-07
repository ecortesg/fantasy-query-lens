// Makes saved pages smaller, in place: `pnpm fixture:trim tests/fixtures/<name>.html`.
// A Scan runs no scripts and a test loads no CSS, so both go. JSON-LD stays: the Scan reads the author from it.
// Article text goes too, as the repo is public and the text is the site's. A Scan reads tables and headings.
import { readFileSync, writeFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const BLOCK = 'p, li, blockquote, figcaption, div';
const KEEP = 'table, h1, h2, h3, h4, h5, h6, select, script';

for (const file of process.argv.slice(2)) {
  const html = readFileSync(file, 'utf8');
  const dom = new JSDOM(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) => (/type=["']?application\/ld\+json/i.test(tag) ? tag : ''))
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ''),
  );
  const doc = dom.window.document;
  const walker = doc.createTreeWalker(doc.body, dom.window.NodeFilter.SHOW_TEXT);
  const prose = [];
  for (let node; (node = walker.nextNode()); ) {
    if (node.parentElement.closest(KEEP)) continue;
    const block = node.parentElement.closest(BLOCK);
    if (block && block.textContent.trim().length > 80) prose.push(node);
  }
  for (const node of prose) node.data = '';
  const trimmed = dom.serialize();
  writeFileSync(file, trimmed);
  console.log(`${file}: ${Math.round(html.length / 1024)} KB → ${Math.round(trimmed.length / 1024)} KB`);
}
