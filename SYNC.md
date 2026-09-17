# KNS Picture House - Keep-to-site sync runbook

Recurring task (scheduled agent): check the Google Keep note "Movies to watch with KNS"
for additions/removals and republish the site when the list changes.

## Cadence
Daily, once, around 07:30 IST. The on-site programme rotates deterministically at IST
midnight in the browser; this sync only needs to catch list edits.

## Privacy rules (hard)
- Repo is PUBLIC. Commit movie data only. Never commit other Keep notes, credentials,
  2FA seeds, or any non-movie note content.
- The Keep note itself mixes the movie list with credentials. Never copy its full
  innerText anywhere. Extract with a stop-pattern (below).
- Sign-in rule: warn Akshay and wait for explicit approval before any login/OTP/push.
  Use the saved personal Google session (v12.akshay@gmail.com) only; never the work account.
  GitHub changes may hit sudo-mode re-auth; only the email-code route with his approval.

## Sync procedure
1. Acquire a cloud-browser lease (config-c; saved profile has Google + GitHub sessions).
2. keep.google.com -> Search combobox -> "Movies to Watch with KNS" -> open the note.
   The note may not render in the grid without searching.
3. In the note editor (.VIpgJd-TUo6Hb), split innerText on blank lines, keep lines until
   the first line matching /seed|2fa|key|secret|coindelta|bitbns|password|otp|auth|gmail\.com|login|code/i.
   Drop the title line and footer chrome ("List item", "Edited at ...", "Close", promo text).
4. Normalize titles (lowercase, strip) and diff against data/movies.json ids.
   No drift -> done, stay quiet. Drift -> continue.
5. For each new title, run scripts/enrich.py logic: Cinemeta (IMDb rating + id via
   v3-cinemeta.strem.io), RT tomatometer from the Rotten Tomatoes page HTML,
   Wikipedia plot + 2:3 poster (use /wiki/ HTML; the REST summary API rate-limits),
   JustWatch GraphQL for India streaming offers. Save poster JPEGs to site/assets/posters/.
6. Run `node scripts/build.mjs` -> emits site/data.js + site/posters-{a,b,c}.js
   (split so each stays under the ~550KB web-editor paste limit).
7. Commit via GitHub's web editor (/new/main or /edit/main/<path>; filename field accepts
   paths with slashes). Paste content with bulk fill. Click "Commit changes..." then the
   dialog's "Commit changes". Do NOT use the multi-file uploader (numeric filename
   prefixes, crashes on large files).
8. Pages republishes automatically (~1 min). Verify https://iakshayvj.github.io/kns-picture-house/
   returns 200 and a poster image loads; report the diff (titles added/removed) to main.

## Notes
- Poster JPEGs are not in the repo (binary via web editor is impractical). Recover them
  from the deployed posters-*.js with scripts/restore-posters.py, or re-fetch from Wikipedia.
- Site works from file:// too; posters are inlined, no CORS issues.
- Stage 2 (shared feedback DB) and stage 3 (recommendations) are roadmap, not built.
