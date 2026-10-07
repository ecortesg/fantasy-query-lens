/**
 * The name key both sides of a match are compared on: diacritics dropped,
 * apostrophes and periods removed outright (so `Ja'Marr` = `Ja’Marr` = `jamarr`
 * and `A.J.` = `AJ` = `aj`), any other punctuation turned into a space, and
 * suffixes dropped. Copied from Fantasy Query's Cheat Sheet import matcher.
 */
export function norm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['‘’`]/gu, '')
    .replace(/\./g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
