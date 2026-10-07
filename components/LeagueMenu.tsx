import { useEffect, useId, useRef, useState } from 'react';
import { activeLeagueIdItem, removeLeague, type League } from '@/lib/league';
import { count } from './ui';

type Props = {
  leagues: readonly League[];
  active: League;
  onAdd: () => void;
  /** Only for a manual League: a Sleeper League's Roster comes from Sleeper. */
  onEdit?: () => void;
};

/**
 * The active League, and a menu to switch, add or remove one. A native popover:
 * Chrome closes it on Esc and on a click outside, and anchors it to the button.
 */
export function LeagueMenu({ leagues, active, onAdd, onEdit }: Props) {
  const id = useId();
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Remove asks once more, so a slip in the menu does not lose a League typed by hand.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const el = menu.current;
    if (!el) return;
    const onToggle = (e: Event) => {
      const isOpen = (e as ToggleEvent).newState === 'open';
      setOpen(isOpen);
      setConfirming(false);
      if (isOpen) el.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    };
    el.addEventListener('toggle', onToggle);
    return () => el.removeEventListener('toggle', onToggle);
  }, []);

  const close = () => menu.current?.hidePopover();
  /** "Sleeper · HALF · 15 players", with the username when the menu has two teams from one Sleeper league. */
  const detail = (l: League) =>
    [l.sleeper ? 'Sleeper' : 'Manual', owner(l, leagues), l.scoring, count(l.roster.length, 'player')].filter(Boolean).join(' · ');
  const activeOwner = owner(active, leagues);
  const activeName = activeOwner ? `${active.name} (${activeOwner})` : active.name;
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <header className="px-1.5 py-1.5">
      <button
        popoverTarget={id}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left [anchor-name:--league-menu] hover:bg-neutral-100 ${open ? 'bg-neutral-100' : ''}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold" title={active.name}>
            {active.name}
          </span>
          <span className="block truncate text-xs text-neutral-500">{detail(active)}</span>
        </span>
        <Chevron up={open} />
      </button>

      <div
        ref={menu}
        id={id}
        popover="auto"
        role="menu"
        aria-label="Leagues"
        onKeyDown={onKeyDown}
        className="m-0 mt-1 max-h-[calc(100dvh-6rem)] flex-col rounded-lg border border-neutral-200 bg-white py-1 text-sm text-neutral-900 shadow-lg [left:anchor(left)] [position-anchor:--league-menu] [top:anchor(bottom)] [width:anchor-size(width)] [&:popover-open]:flex"
      >
        {/* The menu stops at the panel's bottom (6rem is the header). Only the Leagues scroll, so the actions stay in view. */}
        <div className="min-h-0 overflow-y-auto">
          {leagues.map((l) => (
            <button
              key={l.id}
              role="menuitemradio"
              aria-checked={l.id === active.id}
              onClick={() => {
                activeLeagueIdItem.setValue(l.id);
                close();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100"
            >
              <span className="min-w-0 flex-1">
                <span className={`block truncate ${l.id === active.id ? 'font-semibold' : ''}`} title={l.name}>
                  {l.name}
                </span>
                <span className="block truncate text-xs text-neutral-500">{detail(l)}</span>
              </span>
              {l.id === active.id && <span aria-hidden className="text-brand">✓</span>}
            </button>
          ))}
        </div>
        <div className="my-1 border-t border-neutral-100" />
        {onEdit && (
          <button
            role="menuitem"
            onClick={() => {
              close();
              onEdit();
            }}
            className="flex w-full items-start gap-2 px-3 py-1.5 text-left outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100"
          >
            <Icon d={icons.edit} />
            Edit League
          </button>
        )}
        <button
          role="menuitem"
          onClick={() => {
            close();
            onAdd();
          }}
          className="flex w-full items-start gap-2 px-3 py-1.5 text-left outline-none hover:bg-neutral-100 focus-visible:bg-neutral-100"
        >
          <Icon d={icons.add} />
          Add a League
        </button>
        <button
          role="menuitem"
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            close();
            removeLeague(active.id);
          }}
          className={`flex w-full items-start gap-2 px-3 py-1.5 text-left text-red-700 outline-none hover:bg-red-50 focus-visible:bg-red-50 ${confirming ? 'font-semibold' : ''}`}
        >
          <Icon d={icons.remove} className="text-current" />
          <span className="min-w-0 break-words">{confirming ? `Yes, remove ${activeName}` : `Remove ${activeName}`}</span>
        </button>
      </div>
    </header>
  );
}

/** The Sleeper username, only when another stored League is the same Sleeper league. */
const owner = (l: League, leagues: readonly League[]) =>
  leagues.some((o) => o.id !== l.id && o.sleeper && o.sleeper.leagueId === l.sleeper?.leagueId)
    ? l.sleeper?.username
    : undefined;

const Chevron = ({ up }: { up: boolean }) => (
  <svg viewBox="0 0 16 16" className={`size-4 shrink-0 text-neutral-500 ${up ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const icons = {
  edit: 'M10.5 2.5l3 3L6 13H3v-3zM9 4l3 3',
  add: 'M8 3v10M3 8h10',
  remove: 'M2.5 4.5h11M6 4.5V2.5h4v2M4 4.5l.7 9h6.6l.7-9M6.5 7v4M9.5 7v4',
};

/** Centered on a menu item's first line, so a long label wraps beside it. */
const Icon = ({ d, className = 'text-neutral-500' }: { d: string; className?: string }) => (
  <svg viewBox="0 0 16 16" className={`mt-0.5 size-4 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
    <path d={d} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
