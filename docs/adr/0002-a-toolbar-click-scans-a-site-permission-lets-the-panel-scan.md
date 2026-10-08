# A side panel; a toolbar click scans, and a site permission lets the panel's Scan button work

The extension lives in Chrome's side panel, which stays open while the user scrolls. It asks for no host permissions at install.

- **A toolbar click (or its keyboard shortcut)** opens the panel and scans the tab. The click grants `activeTab`, so this Scan needs no prompt.
- **The panel's Scan button** works only on sites the user allowed. On those sites, once scanned, the panel also reads each page by itself to mark the players, and after a reload (ADR-0010). After a toolbar Scan, the panel offers "Allow on this site" and "Allow on all sites" as optional host permissions, and Chrome remembers the answer.

## Why

A click inside the side panel does not grant `activeTab`: only the toolbar icon, a keyboard shortcut, a context menu and the omnibox do. Without a grant the panel cannot even read the tab's URL, so it cannot ask for "this site" until a toolbar Scan has shown it the URL. Extensions such as 1Password ask for all sites at install. That shows a "read and change all your data" warning and puts the extension through a slower store review. Asking at runtime shows no install warning. A user who reads two or three ranking sites allows those. A user who reads many allows all sites once.
