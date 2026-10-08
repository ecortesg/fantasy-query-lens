# Scans merge by Source and are never deleted automatically

Each Ranked List a Scan finds is kept under its Source (site + Ranker + week + Scoring Format) and the positions it covers. A later list with the same key replaces the earlier one. The Lineup for a page uses every list kept for that page's Source. A Scan reads ranks for the players of every League, not only the active one, so a list kept while one League was active still serves the others. A change to the page, such as a click on Yahoo's RB tab, waits for the user to scan again (ADR-0009).

## Why

The sites we read show one position at a time: Yahoo with tabs, Fantasy Footballers with one page per position. One Scan alone can rarely fill a lineup. The week is part of the key, so lists from different weeks never mix, and old lists do no harm. When a page does not say its week, the panel shows the date each list was read. The user can always scan again, and can remove a kept list from another page by hand.
