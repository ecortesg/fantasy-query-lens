import { useMemo, useState } from 'react';
import { saveLeagues, scoringFormats, slotName, updateLeague, type League, type ScoringFormat, type Slot } from '@/lib/league';
import type { Player } from '@/lib/players';
import { PlayerCombobox } from './PlayerCombobox';
import { asideClass, Badge, count, headingClass, inputClass } from './ui';

/** The slots a manual League can set, in lineup order, with a standard league's counts. */
const standardCounts: [Slot, number][] = [
  ['QB', 1],
  ['RB', 2],
  ['WR', 2],
  ['TE', 1],
  ['FLEX', 1],
  ['SUPER_FLEX', 0],
  ['K', 1],
  ['DEF', 1],
];

type Props = {
  players: readonly Player[];
  /** A manual League to edit. Without it, the form adds a new one. */
  league?: League;
  onDone: () => void;
};

export function ManualLeague({ players, league, onDone }: Props) {
  const [name, setName] = useState(league?.name ?? 'My League');
  const [scoring, setScoring] = useState<ScoringFormat>(league?.scoring ?? 'PPR');
  const [counts, setCounts] = useState(
    () => new Map(standardCounts.map(([slot, n]) => [slot, league ? league.slots.filter((s) => s === slot).length : n])),
  );
  const [roster, setRoster] = useState<Player[]>(() => {
    const byId = new Map(players.map((p) => [p.id, p]));
    return league?.roster.flatMap((e) => byId.get(e.playerId) ?? []) ?? [];
  });
  const [saving, setSaving] = useState(false);
  const onRoster = useMemo(() => new Set(roster.map((p) => p.id)), [roster]);

  const save = async () => {
    setSaving(true);
    const edited = {
      name: name.trim(),
      scoring,
      slots: [...counts].flatMap(([slot, n]) => Array<Slot>(n).fill(slot)),
      roster: roster.map((p) => ({ playerId: p.id, status: 'active' as const })),
    };
    await (league ? updateLeague({ ...league, ...edited }) : saveLeagues([{ id: crypto.randomUUID(), ...edited }]));
    onDone();
  };

  const starters = [...counts.values()].reduce((a, b) => a + b, 0);
  const setCount = (slot: Slot, n: number) => setCounts(new Map(counts).set(slot, Math.max(0, Math.min(9, n))));

  return (
    <>
      <div className="space-y-1.5">
        <span className={headingClass}>League</span>
        <div className="flex gap-2">
          <input aria-label="Name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          <div role="radiogroup" aria-label="Scoring" className="flex shrink-0 rounded-md border border-neutral-300 p-0.5 text-xs font-medium">
            {scoringFormats.map((f) => (
              <button
                key={f}
                role="radio"
                aria-checked={scoring === f}
                className={`rounded px-2 ${scoring === f ? 'bg-brand text-white' : 'text-neutral-500'}`}
                onClick={() => setScoring(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section>
        <h2 className={`flex items-center justify-between pb-1 ${headingClass}`}>
          Starting slots <span className={asideClass}>{count(starters, 'starter')}</span>
        </h2>
        <div className="grid grid-cols-2 gap-x-4 border-t border-neutral-100">
          {[...counts].map(([slot, n]) => (
            <div key={slot} className="flex items-center gap-2 border-b border-neutral-100 py-1.5">
              <Badge text={slot} />
              <span className="flex-1" />
              <Step label={`Fewer ${slotName(slot)}`} disabled={n === 0} onClick={() => setCount(slot, n - 1)}>
                −
              </Step>
              <span className="w-4 text-center font-medium tabular-nums">{n}</span>
              <Step label={`More ${slotName(slot)}`} disabled={n === 9} onClick={() => setCount(slot, n + 1)}>
                +
              </Step>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className={`flex items-center justify-between ${headingClass}`}>
          Roster <span className={asideClass}>{count(roster.length, 'player')}</span>
        </h2>
        <PlayerCombobox players={players} exclude={onRoster} onPick={(p) => setRoster([...roster, p])} />
        {roster.length > 0 && (
          <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
            {roster.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <Badge text={p.positions[0] ?? '?'} />
                <span className="flex min-w-0 flex-1 items-baseline gap-1">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 text-xs text-neutral-400">{p.team}</span>
                </span>
                <button
                  aria-label={`Remove ${p.name}`}
                  className="px-1 text-base text-neutral-400 hover:text-red-700"
                  onClick={() => setRoster(roster.filter((r) => r.id !== p.id))}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button className="btn w-full py-2" disabled={saving || !name.trim() || roster.length === 0} onClick={save}>
        {league ? 'Save' : 'Add league'}
      </button>
    </>
  );
}

function Step(props: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      aria-label={props.label}
      disabled={props.disabled}
      onClick={props.onClick}
      className="flex size-6 items-center justify-center rounded-md border border-neutral-200 text-neutral-600 disabled:opacity-30"
    >
      {props.children}
    </button>
  );
}
