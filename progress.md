Original prompt: build a classic pac man type game

- Initialized progress tracking for a Pac-Man-style web game replacement.
- Next: replace frontend files with canvas game and add deterministic test hooks.

- Replaced frontend with a canvas-based Pac-Man-style game.
- Implemented maze, pellets, ghosts, scoring, lives, win/lose states, and start/restart flow.
- Added `window.render_game_to_text` and `window.advanceTime(ms)` deterministic hook.
- Added fullscreen toggle on `f`.
- Next: run app + Playwright game client and inspect screenshots/state for gameplay validation.

- Refined ghost randomness to use a seeded PRNG for deterministic `advanceTime` behavior during automated tests.
- Re-running Playwright loop after RNG change.

- Installed `playwright` dev dependency and browser binaries to run the required web-game client.
- Ran Playwright loop on `output/web-game` with no console/page errors.
- Reviewed screenshots (`shot-0..2`) and JSON state captures (`state-0..2`) confirming movement, pellet score increases, life loss, and game-over overlay.
- Ran a second Playwright scenario (`output/web-game-restart`) confirming `R` restart returns to `mode: play` with `lives: 3`.

TODO / suggestions for next agent:
- Optional polish: add ghost vulnerable/frightened mode after power pellets for closer classic Pac-Man behavior.
- Optional polish: add attract screen sound effects and level progression speed ramp.

- New user prompt: create a Scrabble-like game playable with family.
- Added a new `/family-word-game` web app with local multiplayer setup (2-4 players), tile bag, racks, board multipliers, turn validation, word scoring, pass/swap/recall actions, and game-over scoring.
- Integrated new landing-page card and Express route so the game is accessible from `/` and `/family-word-game`.
- Ran required Playwright web-game client against `/family-word-game` and found/fixed a setup-time page error (`Cannot read properties of undefined`) by guarding board reads before setup starts.
- Added keyboard gameplay controls for deterministic test automation and accessibility: arrow keys move cursor, `Space` selects/places, `Enter` submits, `A` recalls, `B` passes, `F` fullscreen.
- Re-ran Playwright after fixes and captured clean artifacts in `output/family-word-game` (`shot-0..2.png`, `state-0..2.json`) with no `errors-*.json` files generated.

TODO / suggestions for next agent:
- Optional polish: add blank tiles and a letter-picker modal to get closer to official Scrabble rules.
- Optional polish: expand dictionary coverage or make dictionary mode toggleable in UI for strict vs relaxed family play.

- Follow-up request completed: implemented both pending polish items.
- Added blank wildcard tiles (`?`) to tile distribution and a letter-picker modal (`A-Z`) that appears when placing a blank tile.
- Added strict dictionary toggle in setup and in-game controls; validation now enforces dictionary only in strict mode.
- Updated render/state payload to include `strictDictionary` and blank metadata (`isBlank`) for both locked and in-turn tiles.
- Verified with Playwright client screenshots/states in `output/family-word-game`.
- Ran an additional focused Playwright script confirming: blank modal opens, chosen blank letter is applied, and strict mode toggles off correctly.

- New request: make game playable online with 4 players.
- Added server-side multiplayer room engine (`family-word-game-server.js`) with in-memory rooms, host/join/start flow, turn-authoritative actions, and 2-4 player cap.
- Added new APIs:
  - `POST /api/family-word-game/rooms`
  - `POST /api/family-word-game/rooms/:roomCode/join`
  - `GET /api/family-word-game/rooms/:roomCode/state`
  - `POST /api/family-word-game/rooms/:roomCode/start`
  - `POST /api/family-word-game/rooms/:roomCode/action`
- Wired API routes into `server.js` and enabled JSON body parsing.
- Replaced family-word-game frontend with online room UX: create/join lobby, host start, polling state sync, online turn actions, blank tile letter modal, strict/relaxed dictionary toggle (host-controlled).
- Validation:
  - `node -c` checks passed for `server.js` and `family-word-game-server.js`.
  - End-to-end API smoke test passed (create room, join second player, start, place+submit, synced state).
  - Browser smoke test passed (create room and lobby visible).
  - Ran required Playwright web-game client on new flow with artifacts in `output/family-word-game-online`.
