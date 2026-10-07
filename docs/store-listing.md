# Store listing

Text for the Chrome Web Store and Edge Add-ons forms. Keep it in sync with the extension.

## Release

1. Raise `version` in `package.json`. Each upload needs a higher version.
2. `pnpm verify`, then `pnpm zip` (Chrome) or `pnpm zip:edge` (Edge).
3. Upload the zip from `.output/`.

## Listing

**Name:** Fantasy Query Lens

**Summary** (132 characters max):

> Your fantasy roster on any rankings page, and a lineup from that page’s ranks.

**Description:**

> Open any fantasy football rankings page and see your players at a glance.
>
> Fantasy Query Lens highlights the players on your roster right on the page, then suggests your best lineup from that page's own ranks. Compare experts by scanning their pages: each one becomes its own list, and you can switch between them in the side panel.
>
> • Import your Leagues from Sleeper, or add a League by hand
> • Highlights your starters and bench on the page
> • Suggests a lineup that fills your League's slots, including flex and IDP
> • Finds Pickups: available players who would start for you or upgrade your bench
> • Merges position pages, so a site that shows one position at a time still gives a full lineup
> • Works on the rankings sites you already read
>
> No account, no tracking. The extension reads a page only when you ask it to.
>
> Open source: https://github.com/ecortesg/fantasy-query-lens

**Category:** Lifestyle → Entertainment

**Language:** English (United States)

**Homepage URL:** https://github.com/ecortesg/fantasy-query-lens

**Support URL:** https://github.com/ecortesg/fantasy-query-lens/issues

**Assets:**

- Store icon: `public/icon/128.png` (all sizes are made from `assets/icon.svg`).
- Screenshots: 1 to 5 at 1280×800, of the panel beside a highlighted rankings page. Now: the Lineup, then the Pickups.
- Small promo tile: 440×280. The icon, the name with "Lens" marked in yellow, and the tagline on the brand blue.

Screenshots and tiles must be JPEG or PNG with no alpha. A macOS screenshot has alpha: a round trip through JPEG with `sips` removes it.

## Privacy tab

**Single purpose:**

> Shows the user's fantasy football roster on the rankings page they are reading, and suggests a lineup from that page's ranks.

**Permission justifications:**

- `activeTab`: reads the rankings page in the current tab when the user clicks the toolbar icon or presses the shortcut.
- `sidePanel`: shows the extension's interface in Chrome's side panel, beside the rankings page. WXT adds it to the manifest.
- `scripting`: runs the scan and the highlight in that tab.
- `storage`: keeps the user's Leagues, their Scans and the player list on the device.
- Optional host permissions (`https://*/*`, `http://*/*`): asked only when the user clicks "Allow" in the panel, for one site or for all sites. They let the panel's Scan button rescan that site without a toolbar click. Rankings pages are on many different sites, so no fixed list of hosts works.

**Remote code:** No. All code is in the package.

**Data use:** the extension reads website content (the scanned page) on the device and sends none of it. The Sleeper username goes only to Sleeper's public API. Declare "Website content", and certify that data is not sold, not used for unrelated purposes, and not used for credit decisions.

**Privacy policy URL:** https://www.fantasyquery.com/lens/privacy (the page lives in the Fantasy Query repo).
