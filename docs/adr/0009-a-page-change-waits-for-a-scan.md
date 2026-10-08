# A page change waits for a Scan, and the League's format wins

A Scan runs only when the user asks for one (ADR-0007). A change to the scanned page, such as a click on Yahoo's RB tab, no longer scans the page again: the panel keeps the last Scan, and the user clicks Rescan. When the page removes the last Scan's marks, as a tab click does, the Source card says "page changed" beside its Rescan button. Changes that leave the marks, such as ads, say nothing. When any list the Lineup could use is in the League's Scoring Format, the lists in other formats are dropped. A position that only another format ranks shows "Scan … rankings", and the user opens that tab and rescans.

## Why

The page watched itself for changes and scanned again 500 ms after each one. Yahoo's video player, ads and late content change the page too, so lists came and went with no click the user could see. On a Yahoo page with a Half-PPR table and a PPR table, one click read the QB tab of one and the RB tab of the other, and a Half-PPR League then started running backs by PPR ranks. The panel only said so inside "Ranks from 2 lists". Ranks in the wrong format look right and are not, which is worse than a slot that asks for a Scan. The cost is one Rescan click after each tab on the page.
