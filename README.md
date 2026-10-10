# doku

A little room for every pet. An ad-free region-placement puzzle for the family.

One pet in each row, column and color region. Pets cannot touch, even diagonally.
128 original, uniquely solvable boards across 5×5, 6×6, 7×7 and 8×8 sizes.
Cat and poodle skins, daylight and evening themes, undo, free hints, optional
region numbers, progress export/import, and a daily selection from the same pool.

Play: [doku.royashbrook.com](https://doku.royashbrook.com).

Inspired by the rules of games such as Meowdoku, not a copy of its assets or boards.
No ads, hearts, accounts, timers, purchases, analytics or third-party runtime requests.
Progress stays in browser storage. Export it before moving to another browser or shortcut.

## development

Node 24+, npm. `npm ci`, `npx playwright install chromium webkit`, then `npm run verify`.
`npm run dev` serves localhost:4321. Browser tests own localhost:4322; override
`DOKU_TEST_PORT` to run a second checkout without sharing a preview.

The UI is Svelte 5 with strict TypeScript, bundled by Vite. Pure puzzle and save
functions live in `src/lib`. `npm run generate` deterministically rebuilds the pool;
the tests verify every board has exactly one solution and connected regions.
The four tier names describe board size, not a measured human difficulty score.

## releases

Immutable tags are `vMAJOR.MINOR`. The patch is the number of commits reachable
since the nearest first-parent anchor. CI requires complete history and a clean tree.
The content fingerprint identifies a built snapshot independently of its version.
The deployment workflow checks current main, refuses superseded releases and queues
production writes. Its Cloudflare token is configured as a GitHub secret, never in source.

Installation caches the entire snapshot, including art and dependency notices.
Updates download in the background and require an explicit Update tap. An incomplete
candidate is rejected without deleting the current cache. Old snapshots are retained
while an open client still reports using them. Ordinary document zoom remains available;
only the puzzle surface suppresses browser gestures.

## limits and checks

This is the first family-playtest release, not a claim of finished product design.
Chromium and WebKit automation covers gameplay, save validation, phone sizing,
offline navigation, dependency notices and consent-based updates. Browser emulation
is not a physical iPhone install/update test. Those checks still belong to the family.
Daily puzzles repeat from the finite pool. Browser storage can be cleared by the OS;
exporting progress is the fallback. No server stores a recovery copy.

Original pet illustrations were generated for this project with OpenAI image
generation. See `public/art-notice.txt` and `docs/art.md`. Code is MIT; emitted
dependency notices are included in the app at `/licenses.md`.
