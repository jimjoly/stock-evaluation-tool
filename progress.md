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
