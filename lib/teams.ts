/** NFL team codes as Sleeper and Fantasy Query write them. */
export const teamCodes = new Set([
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND',
  'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF',
  'TB', 'TEN', 'WAS',
]);

/** Codes a rankings page writes that are not ours. From Fantasy Query's import matcher. */
const teamAliases: Record<string, string> = {
  JAC: 'JAX',
  WSH: 'WAS',
  LA: 'LAR',
  OAK: 'LV',
  SD: 'LAC',
  STL: 'LAR',
  HST: 'HOU',
  BLT: 'BAL',
  CLV: 'CLE',
  ARZ: 'ARI',
  GNB: 'GB',
  KAN: 'KC',
  NWE: 'NE',
  NOR: 'NO',
  SFO: 'SF',
  TAM: 'TB',
  LVR: 'LV',
};

/** Every way a page may write a team's code: "JAX" and "JAC". */
export const codeSpellings = (code: string) => [
  code,
  ...Object.keys(teamAliases).filter((alias) => teamAliases[alias] === code),
];

/** A token as one of our team codes, or undefined when it is not one. Case-sensitive: "no" is a word, "NO" a team. */
export function teamCode(token: string): string | undefined {
  const code = teamAliases[token] ?? token;
  return teamCodes.has(code) ? code : undefined;
}
