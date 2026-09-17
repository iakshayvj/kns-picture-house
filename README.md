# KNS Picture House

**A private two-person cinema programme, built from the films Kruthika and I actually want to watch.**

[Open KNS Picture House](https://iakshayvj.github.io/kns-picture-house/)

## The story

Kruthika and I love watching films, but choosing one kept turning into a 30-minute discussion. We already had a shared list of 11 films, so I wanted something better than another streaming grid: a glowing programme board that gives us four films at a time and changes every night.

KNS Picture House turns that list into a small independent-cinema experience. The current programme is fixed for 24 hours, the full list stays in the Ledger, and every film carries enough context to make a decision without opening five more tabs.

## What works today

| | Feature | What it does |
|---|---|---|
| 🎞️ | Nightly programme | Shows four unrelated films for 24 hours, then rotates at midnight IST |
| 📚 | The Ledger | Keeps the full watchlist in one place and marks watched films |
| 🍅 | Film context | Shows poster, year, country, language, plot, IMDb and Rotten Tomatoes scores |
| 🇮🇳 | India availability | Shows where each film streams in India |
| ✍️ | Watch log | Records who watched, a 1-5 rating, reaction and notes in the current browser |
| 🔄 | Keep sync | Checks the movie list once daily and republishes only when it changes |

## How the data moves

The source list lives in a Google Keep note. A privacy-filtered daily sync extracts movie titles only, compares them with `data/movies.json`, enriches new titles, rebuilds the static site and verifies the published result.

The enrichment pipeline uses Cinemeta, Wikipedia, Rotten Tomatoes and JustWatch India. The site itself is static and hosted on GitHub Pages.

## The honest bit

Watch feedback is stored in `localStorage` today, so it does not yet follow us across devices. Shared accounts, a permanent watch history and taste-based recommendations are the next stages. Recommendations are deliberately held back until there is enough real viewing history to make them useful.

## Run it locally

```sh
node scripts/build.mjs
python3 -m http.server 4173 -d site
```

Then open `http://localhost:4173`.

## Built with Instinct

I set the product direction, source list and taste rules. **Instinct designed and built the experience, researched and enriched the film data, tested it on desktop and mobile, published it to GitHub Pages, and set up the privacy-filtered Keep-to-site sync.**
