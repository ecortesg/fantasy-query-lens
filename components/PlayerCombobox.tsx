import { useId, useMemo, useState } from 'react';
import { searchPlayers, type Player } from '@/lib/players';
import { Badge, inputClass } from './ui';

type Props = {
  players: readonly Player[];
  /** IDs already on the roster, left out of the results. */
  exclude: ReadonlySet<string>;
  onPick: (player: Player) => void;
};

export function PlayerCombobox({ players, exclude, onPick }: Props) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(
    () => searchPlayers(players.filter((p) => !exclude.has(p.id)), query),
    [players, exclude, query],
  );
  const open = results.length > 0;

  const pick = (player: Player) => {
    onPick(player);
    setQuery('');
    setActive(0);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const player = results[active];
      if (player) pick(player);
    } else if (event.key === 'Escape') {
      setQuery('');
    }
  };

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        className={inputClass}
        placeholder="Add a player…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
        >
          {results.map((player, i) => (
            <li
              key={player.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`flex cursor-pointer items-center gap-3 px-2 py-1.5 ${i === active ? 'bg-neutral-100' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(player);
              }}
            >
              <Badge text={player.positions[0] ?? '?'} />
              <span className="min-w-0 flex-1 truncate">{player.name}</span>
              <span className="text-xs text-neutral-400">{player.team}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
