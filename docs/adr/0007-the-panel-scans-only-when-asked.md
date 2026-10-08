# The panel scans only when asked

A Scan runs on a toolbar click, on the panel's Scan button, and on a League change (for the page in front, if the panel read it). Only a Scan keeps lists. A new tab or page does not scan, and a change to the page does not either (ADR-0009). On a site the user scanned and allowed, the panel reads each page to mark the players and show its Lineup, but keeps no list (ADR-0010). Elsewhere it keeps the last Lineup, and its button says "Scan page" (not "Rescan").

## Why

The panel used to scan each tab the user brought to the front, on allowed sites. A user who reads rankings and then opens Sleeper to set the lineup lost the Lineup at that moment, and saw "Ranks none of your players" for Sleeper. With "Allow all sites", every tab was scanned, and a page that changes its text all the time, such as YouTube, was scanned again about once a second. A Scan the user asks for is easy to see and to predict. The cost is one click on each new rankings page.
