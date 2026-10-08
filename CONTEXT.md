# Fantasy Query Lens

A browser extension that shows a user's fantasy roster on any rankings page and suggests a lineup from that page's own ranks. It has no rankings of its own. It is a companion to Fantasy Query and brings users to it.

## Language

**League**:
A user's fantasy league as the extension keeps it: a name, a Scoring Format, its Slots, and a Roster. Imported from Sleeper (by username) or entered by hand (a manual League). A Sleeper league can be added once per username, so a user can also keep a team they help with in the same league. One League is active at a time. The panel lists Leagues by name, then by Sleeper username.
_Avoid_: team, config

**Roster**:
The players on the user's team in a League, starters and bench together. Each entry is active, IR, or taxi. IR and taxi players are highlighted but never suggested to start. A Sleeper Roster, and the players on the league's other teams, are refreshed at a Scan, at most once every 5 minutes (ADR-0005).

**Slot**:
One starting place in a lineup, defined by the set of positions it accepts: FLEX is RB/WR/TE and SUPER_FLEX is QB/RB/WR/TE (ADR-0003). Bench, IR and taxi are not Slots.
_Avoid_: roster position

**Scoring Format**:
STD, HALF or PPR. Sleeper Leagues get it from their points per reception. A manual League sets it by hand, and can change it with Edit League. It picks which table a Scan reads when a page has one for each format. When any list is in the League's format, lists in other formats are not used (ADR-0009).

**Scan**:
One reading of the page the user is on: the user's players and the active League's available players found on it and, when the page ranks them, the Ranked Lists. It reads only what the page shows (ADR-0001). A toolbar click scans any page; the panel's Scan button works only on sites the user allowed (ADR-0002). A new tab or page, or a change to the scanned page, keeps the last Scan until the user scans or removes its last list (ADR-0007, ADR-0009).

**Ranked List**:
Players in a ranker's order with their rank numbers, covering one or more positions. A positional list covers one position. A cross-position list (FLEX, overall) covers several. The rank comes from the page's Rank cell, not from row order, so a sorted table still reads right.

**Source**:
Who ranked a Ranked List, and for what: site + Ranker + week + Scoring Format. The panel titles it by site and week ("Yahoo Sports · Week 3"), with the Ranker as a menu below. Scans with the same Source merge into one set of lists (ADR-0004).

**Ranker**:
The person or column a list's ranks come from. A table with several ranker columns (Consensus, Andy, Jason, Mike) reads Consensus by default and lets the user pick another.
_Avoid_: expert, analyst (except when quoting a site)

**Lineup**:
The suggestion: each Slot filled with the best-ranked eligible player still left (from the widest list that covers the Slot, or the next one when that list ranks no one left), then the bench in rank order, then the players the page does not rank.

**Available player**:
A player on no team in a Sleeper League, at a position one of its Slots takes. A manual League has none, as the extension does not know its other teams. A Scan looks for them by name (ADR-0006).
_Avoid_: free agent, waiver player (Sleeper's waiver state is not read)

**Pickup**:
An Available player for a Slot the Lineup cannot fill (the best-ranked one in the Slot's list), one the Lineup would start in place of a starter if the user added him (ADR-0008), or a bench upgrade: one who ranks above the user's lowest-ranked bench player in the same Ranked List. A cross-position list counts for bench upgrades only when one Slot takes all its positions: a FLEX list compares an RB with a WR.

**Highlight**:
The mark a Scan puts on the user's players on the page: one color for the active League's suggested starters, a lighter one for the rest of its Roster, and a ring for its Pickups. Players of the user's other Leagues and the other available players are marked with no color, so the Scan still reads their ranks. A defense (full name, nickname or team code) is marked only where the page is about defenses: followed by D/ST or DST, in a DST row, or in a list under a defense heading. "SF" in a 49ers player's Team column is not the defense.
