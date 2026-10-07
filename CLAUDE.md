# CLAUDE.md

Fantasy Query Lens: a WXT (Manifest V3) extension. The side panel is React + Tailwind. The code that runs inside other sites' pages (`lib/`) is plain TypeScript and must not import React.

- `pnpm verify` runs typecheck and tests. Tests use Vitest with WXT's fake browser, and jsdom for page fixtures in `tests/fixtures/`. Trim a newly saved page with `pnpm fixture:trim <file>`.
- Domain language: `CONTEXT.md`. Decisions: `docs/adr/`. Use the glossary's terms in code and copy.
- The WXT docs are the source for manifest, entrypoint and storage APIs. Import WXT APIs explicitly from `#imports`.
