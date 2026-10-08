# A side panel, whose Scan asks for the site

The extension lives in Chrome's side panel, which stays open while the user scrolls. It asks for no host permissions at install.

- **A toolbar click (or its keyboard shortcut)** opens the panel. It does not scan. The click grants `activeTab`, so the panel can see the tab's URL.
- **The panel's Scan button** asks Chrome for access to that site, inside the click, then scans. Chrome asks once per site and remembers the answer. With access, the site's pages and tabs scan by themselves (ADR-0010). A "No" means no Scan, and the panel says that Lens needs access; one Lens that works fully on a site, or not at all, is easier to predict than one page read and then nothing after a reload.
- **With no grant and no access**, the panel cannot see the URL, so it asks the user to click the Lens icon first. "Allow all sites" is offered there too.

## Why

A click inside the side panel does not grant `activeTab`: only the toolbar icon, a keyboard shortcut, a context menu and the omnibox do. Without a grant the panel cannot even read the tab's URL, so it cannot ask for "this site". A toolbar click that scanned at once, and an "Allow" card after it, made Scan and Allow two steps the user had to learn: without Allow, Lens stopped at the next reload or page, with no reason the user could see. One Scan that asks for the site makes Scan mean "turn Lens on here". The cost is one more click on a new site: the icon, then Scan. Extensions such as 1Password ask for all sites at install. That shows a "read and change all your data" warning and puts the extension through a slower store review. Asking at runtime shows no install warning.
