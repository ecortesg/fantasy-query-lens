# A Sleeper Roster refreshes at a Scan

A Scan refreshes the active League's Sleeper Roster when the last refresh is more than 5 minutes old. It does so silently, with no Sync button. If Sleeper does not answer, the last copy is used.

## Why

A Scan is the only moment a correct Roster matters, and one roster request is cheap. The side panel has no clear "start": it opens and closes, and the background worker restarts often. A manual Sync button can fail without anyone seeing it: a waiver pickup on Wednesday, a forgotten Sync on Sunday, and a lineup with a dropped player that looks correct. The 5 minute limit stops a burst of re-scans (tab clicks) from sending a request each time.
