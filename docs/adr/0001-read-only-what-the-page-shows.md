# Read only what the page shows

A Scan reads the rendered page the user is looking at: text and tables in the DOM. It never reads data a site sends but does not show, such as JSON in a `<script>` tag, and it never fetches article content from a server.

## Why

Fantasy Footballers sends full weekly stat projections for every position to every visitor, and shows the points only behind "Join to Unlock." Reading that data would give a full lineup from one page, but it goes around a paywall. The rule "only what is on screen" is simple, is the same for every site, and never needs a judgment call per site. A full lineup comes from merging Scans instead (ADR-0004).

The page's title and its author metadata (`og:site_name`, JSON-LD `author`, `meta name="author"`, `article:author`) are read for the source line. They name the page; they carry no rankings.
