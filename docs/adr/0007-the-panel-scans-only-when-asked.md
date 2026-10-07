# The panel scans only when asked

A Scan runs on a toolbar click, on the panel's Scan button, and on a League change (for the scanned page, if it is still open). A new tab or page does not scan: the panel keeps the last Scan, and its button says "Scan page" (not "Rescan") until the user scans. The scanned page still rescans itself when it changes, such as a click on Yahoo's RB tab (ADR-0004).

## Why

The panel used to scan each tab the user brought to the front, on allowed sites. A user who reads rankings and then opens Sleeper to set the lineup lost the Lineup at that moment, and saw "Ranks none of your players" for Sleeper. With "Allow all sites", every tab was scanned, and a page that changes its text all the time, such as YouTube, was scanned again about once a second. A Scan the user asks for is easy to see and to predict. The cost is one click on each new rankings page.
