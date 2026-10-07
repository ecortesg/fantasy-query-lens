import type { ScoringFormat } from '../league';
import { formatIn } from './ranks';

/** Who published the page and for which week. Read from its title and metadata, not its content. */
export type PageSource = {
  /** The host without "www.", e.g. "sports.yahoo.com". */
  site: string;
  /** `og:site_name`, or the host. */
  siteName: string;
  author?: string;
  week?: number;
  /** A scoring format the page as a whole names, such as the value of a scoring select. */
  format?: ScoringFormat;
};

export function readSource(doc: Document): PageSource {
  const site = doc.location.hostname.replace(/^www\./, '');
  const meta = (selector: string) => doc.querySelector<HTMLMetaElement>(selector)?.content.trim() || undefined;
  const headline = doc.querySelector('h1')?.textContent ?? '';
  const week = /\bweek\s*(\d{1,2})\b/i.exec(`${doc.title} ${headline}`)?.[1];
  const selected = [...doc.querySelectorAll('select')].map((s) => s.selectedOptions[0]?.textContent ?? '');

  return {
    site,
    siteName: meta('meta[property="og:site_name"]') ?? site,
    author: jsonLdAuthor(doc) ?? meta('meta[name="author"]') ?? articleAuthor(meta('meta[property="article:author"]')),
    week: week ? Number(week) : undefined,
    format: selected.map(formatIn).find(Boolean),
  };
}

/** `article:author` is often a profile URL, which is not a name. */
const articleAuthor = (value: string | undefined) => (value && !/^https?:/.test(value) ? value : undefined);

type JsonLd = { author?: unknown; '@graph'?: unknown };

/** The first author name in the page's JSON-LD (an object, a list of them, or a plain string). */
function jsonLdAuthor(doc: Document): string | undefined {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent ?? '');
    } catch {
      continue;
    }
    const nodes = [data, (data as JsonLd)?.['@graph']].flat(2) as JsonLd[];
    for (const node of nodes) {
      const author = [node?.author].flat()[0];
      const name = typeof author === 'string' ? author : (author as { name?: unknown })?.name;
      if (typeof name === 'string' && name.trim()) return name.trim();
    }
  }
  return undefined;
}
