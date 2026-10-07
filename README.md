# Fantasy Query Lens

A Chrome and Edge extension that highlights your fantasy roster on any rankings page and suggests a lineup from that page's own ranks.

## Develop

```sh
pnpm install
pnpm dev          # Chrome with the extension loaded
pnpm dev:edge
pnpm verify       # typecheck + tests
pnpm build        # .output/chrome-mv3
```

Domain language is in `CONTEXT.md`; decisions are in `docs/adr/`. Store release steps and listing text: `docs/store-listing.md`.

## Try it locally

1. `pnpm install`, then `pnpm dev`. WXT opens a Chrome window with the extension loaded. To use your own Chrome instead, run `pnpm build` and load `.output/chrome-mv3` with "Load unpacked" in `chrome://extensions`.
2. Click the Lens icon (or press Alt+Shift+L) to open the side panel. Add a League: a Sleeper username, or a manual League.
3. Open a rankings page and click the Lens icon again. The panel scans the page, highlights your players, and suggests a lineup. To let the panel's Scan button work on that site by itself, use "Allow on this site".
4. On a site that shows one position at a time, scan each position page (or click each Yahoo tab while the panel is open). The lineup merges them.

The player list comes from Fantasy Query's `/api/lens/players` in production. To work on that route, run Fantasy Query locally and copy `.env.example` to `.env`.

## Test fixtures

`tests/fixtures/` holds rendered rankings pages saved from the browser. The parser is tested against them rather than against guessed page structure. To add one, open the page, run `copy(document.documentElement.outerHTML)` in DevTools, and save it here.
