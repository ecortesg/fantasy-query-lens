import type { League, RosterEntry } from '@/lib/league';
import type { RankSet } from '@/lib/lineup';
import { rankLabel } from '@/lib/lists';
import { markStyles } from '@/lib/page/highlight';
import { positions, type Player } from '@/lib/players';

/** A native select sized to its text, with the chevron right after it. */
export function Select<T extends string>(props: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <span className="relative inline-flex max-w-full items-center">
      <select
        aria-label={props.label}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value as T)}
        className={`max-w-full appearance-none truncate bg-transparent p-0 pr-5 outline-none [field-sizing:content] ${props.className ?? ''}`}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 16 16" className="pointer-events-none absolute right-0 size-3.5 text-neutral-500" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** What the results come from, and the one action that renews them. */
export function SourceCard({ title, line, action }: { title: React.ReactNode; line: React.ReactNode; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-y border-neutral-200 bg-neutral-50 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        <div className="text-xs text-neutral-500">{line}</div>
      </div>
      {action}
    </div>
  );
}

/** The panel's outer card. */
export const Card = ({ children }: { children: React.ReactNode }) => <div className="rounded-lg border border-neutral-200">{children}</div>;

/** The grey band across a card, under its header. */
export const Band = ({ children }: { children: React.ReactNode }) => (
  <div className="border-y border-neutral-200 bg-neutral-50 px-3 py-2.5">{children}</div>
);

/** "1 player", "15 players" */
export const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

export const headingClass = 'text-[11px] font-semibold tracking-wide text-neutral-500 uppercase';
/** The aside of a heading: small, and in its own case. */
export const asideClass = 'text-[11px] font-normal tracking-normal text-neutral-500 normal-case';
export const inputClass =
  'h-9 w-full rounded-md border border-neutral-300 px-3 outline-none placeholder:text-neutral-400 focus:border-brand';

export function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h2 className={`flex items-center justify-between pb-1 ${headingClass}`}>
        {title}
        {aside}
      </h2>
      <ul className="divide-y divide-neutral-100 border-t border-neutral-100">{children}</ul>
    </section>
  );
}

type LineProps = {
  badge: string;
  /** The Highlight the badge copies, if any. */
  kind?: keyof typeof markStyles;
  id: string;
  player: Player | undefined;
  rank?: number;
  /** The list the rank is from. */
  from?: RankSet;
  note?: string;
  strong?: boolean;
  faded?: boolean;
};

export function Line({ badge, kind, id, player, rank, from, note, strong, faded }: LineProps) {
  return (
    <li className="flex items-center gap-3 py-2">
      <Badge text={badge} kind={kind} />
      {/* The name gives way first; the team code stays whole. */}
      <span className={`flex min-w-0 flex-1 items-baseline gap-1 ${faded ? 'text-neutral-400' : strong ? 'font-medium' : ''}`}>
        <span className="truncate">{player?.name ?? `Unknown player (${id})`}</span>
        {player && <span className="shrink-0 text-xs font-normal text-neutral-400">{player.team}</span>}
      </span>
      {note && <span className="shrink-0 text-xs text-neutral-500">{note}</span>}
      {rank !== undefined && (
        // Two fixed columns, so labels and numbers line up from row to row.
        <span className="flex shrink-0 items-baseline tabular-nums">
          <span className="w-9 text-right text-xs text-neutral-400">{from ? rankLabel(from.positions) : '#'}</span>
          <span className="w-7 text-right text-base font-medium">{rank}</span>
        </span>
      )}
    </li>
  );
}

// A thinner outline than the page's mark, which would look heavy on a badge.
const badgeStyles = { ...markStyles, pickup: { ...markStyles.pickup, outlineWidth: '1.5px' } };

export function Badge({ text, kind }: { text: string; kind?: keyof typeof markStyles }) {
  return (
    <span
      style={kind && badgeStyles[kind]}
      className={`w-11 shrink-0 rounded py-0.5 text-center text-[11px] font-semibold ${kind ? 'text-neutral-900 ring-1 ring-black/15' : 'text-neutral-500 ring-1 ring-neutral-200'}`}
    >
      {slotLabels[text] ?? text}
    </span>
  );
}

/** Slot names short enough for a badge: "SUPER FLEX" does not fit. */
const slotLabels: Record<string, string> = { SUPER_FLEX: 'SF', WRRB_FLEX: 'W/R', REC_FLEX: 'W/T', IDP_FLEX: 'IDP' };

export const Swatch = ({ kind }: { kind: keyof typeof markStyles }) => (
  <span style={markStyles[kind]} className="inline-block size-2.5 rounded-sm ring-1 ring-black/15" />
);

/** "IR" or "TAXI" for a player never suggested, else the note given. */
export function statusNote(status: RosterEntry['status'] | undefined, note?: string): string | undefined {
  return status && status !== 'active' ? status.toUpperCase() : note;
}

/** Before a Scan, or when the page ranks no one: the whole Roster by position, then name. Unknown players last. */
export function RosterSection({ league, byId, found }: { league: League; byId: ReadonlyMap<string, Player>; found?: ReadonlySet<string> }) {
  const rows = league.roster
    .map((entry) => ({ entry, player: byId.get(entry.playerId) }))
    .sort((a, b) => order(a.player) - order(b.player) || (a.player?.name ?? '').localeCompare(b.player?.name ?? ''));
  return (
    <Section title="Roster">
      {rows.map(({ entry, player }) => {
        const onPage = found?.has(entry.playerId);
        return (
          <Line
            key={entry.playerId}
            badge={player?.positions[0] ?? '?'}
            kind={onPage ? 'bench' : undefined}
            id={entry.playerId}
            player={player}
            note={statusNote(entry.status, onPage === false ? 'Not on page' : undefined)}
            faded={onPage === false}
          />
        );
      })}
    </Section>
  );
}

const order = (player: Player | undefined) => {
  const position = player?.positions[0];
  return position ? positions.indexOf(position) : positions.length;
};
