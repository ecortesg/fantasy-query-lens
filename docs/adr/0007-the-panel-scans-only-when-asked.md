# The panel scans only when asked

A Scan runs on a toolbar click, on the panel's Scan button, and on a League change (for the scanned page, if it is still open). A new tab or page does not scan: the panel keeps the last Scan until the user scans, also when they close the panel and open it again. In another tab its button says "Scan page" (not "Rescan"). When the user removes the last list of the Scan's Source, the Scan and its marks go, and the panel says "No scan yet". A change to the scanned page does not scan it either (ADR-0009).

## Why

The panel used to scan each tab the user brought to the front, on allowed sites. A user who reads rankings and then opens Sleeper to set the lineup lost the Lineup at that moment, and saw "Ranks none of your players" for Sleeper. With "Allow all sites", every tab was scanned, and a page that changes its text all the time, such as YouTube, was scanned again about once a second. A Scan the user asks for is easy to see and to predict. The cost is one click on each new rankings page.
