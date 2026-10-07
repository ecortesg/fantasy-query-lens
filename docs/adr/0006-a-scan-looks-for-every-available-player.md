# A Scan looks for every available player

For a Sleeper League, a Scan also looks for every player on no team in the league, at a position one of its Slots takes: about 700 names in a 12-team league with no IDP. A Pickup is one of them for a Slot the Lineup cannot fill, or one who ranks above the user's lowest-ranked active player in the same list. The matcher puts 100 names in each regex.

## Why

The other way was to look only for players on a team and to read each ranked row with no match as an available player. A name the matcher misses ("Kenneth Gainwell" for our "Kenny Gainwell") would then be a player on another team shown as a Pickup. Looking for the available players by name, a miss only hides a Pickup, and each Pickup is a known player with a position and team.

The cost is the regex. V8 compiles one to machine code on its second run, and that time grows much faster than the regex. On Yahoo's FLEX page in Chrome, a first Scan with 750 names takes 130 ms in groups of 100 (21 ms with 40 names). One regex with all 2,180 players took 960 ms.
