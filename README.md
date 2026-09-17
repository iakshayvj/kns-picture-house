# KNS Picture House

A private two-person cinema. Four films a night, chosen from the list, on a
glowing board that changes at midnight. Inspired by the illuminated programme
board outside IFC Center, New York.

## What it is today (stage 1, shipped)

- **Programme board**: four unrelated films, fixed for exactly 24 hours,
  rotating at midnight IST. Deterministic — the same programme shows on any
  device. Every pick comes only from the Keep list until the house has enough
  viewing history to recommend.
- **The Ledger**: the full list as an archive, stamped when watched.
- **Real data per film**: poster, year, country, language, 1-2 line plot,
  IMDb score, Rotten Tomatoes score, and where it streams in India.
- **Log a watch**: who watched (Akshay / Kruthika / both), 1-5 stars,
  reaction, notes. Stored per browser for now, exportable as JSON
  ("Share feedback") to be merged into the permanent record.

## Data pipeline

- `data/movies.json` — the database. Source of truth: the Google Keep note
  "Movies to Watch with KNS" (synced manually/agent-assisted; Keep has no
  public API).
- `scripts/enrich.py` — enrichment: IMDb suggestion API + Cinemeta (IMDb
  rating), Wikipedia (plot, country, language, poster), Rotten Tomatoes
  (tomatometer), JustWatch GraphQL (India streaming offers).
- `scripts/build.mjs` — compiles `data/movies.json` into `site/data.js` so the
  site works from `file://` and any static host without CORS issues.
- Posters live in `site/assets/posters/` so the site is self-contained.

## Roadmap (approved build order)

1. ~~Ingest Keep list, four-film rotating experience~~ — this release.
2. Feedback + watched state — UI shipped; localStorage today, shared DB next.
3. Recommendation engine — per-person + shared taste from logged watches;
   international cinema (Iran, Turkey, Brazil, Europe…). Held back until
   enough history exists.
4. Multi-user with Google login, then a public version — only if it earns it.

## Running it

Open `site/index.html` in a browser. That's it.
