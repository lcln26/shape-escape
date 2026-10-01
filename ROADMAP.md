# Shape Escape Roadmap

A running record of the project review, what's been fixed and what's planned next. Tick items off as they land and add notes under each phase.

**Core idea to protect:** morph into the shape that matches what's falling, catch it, dodge the rest. Everything below should make that one choice sharper rather than add unrelated features.

---

## Review summary (October 2026)

### The big design problem: you can survive by dodging everything

- Points only come from catching matching shapes, and difficulty (fall speed and spawn rate) only goes up with **score** (`getObstacleSpeed` / `getSpawnInterval` in `js/game.js`).
- So a player who never catches anything never makes the game harder. A simple bot that never changed shape and only moved away from shapes that would kill it survived **over 3 minutes** with a score around 40, and the fall speed stayed at ~150 px/s the whole time. A human could do this forever.
- Catching is optional: a match only earns points, and there's no cost for letting shapes fall past.
- Each catch is worth `10 × (1 + combo)`, so one long combo multiplies your score and suddenly makes the game much faster. The difficulty curve swings unpredictably.

### Bugs found (all fixed in Phase 1)

| Bug | Cause |
| --- | --- |
| Each pause and resume started another copy of the game loop (121 → 600 frame callbacks a second after 4 pauses on a 120Hz display), and the loop kept running while paused | Resuming called `requestAnimationFrame` again without stopping the existing loop |
| Stars and particles moved twice as fast on 120Hz screens | They moved by a fixed amount per frame instead of per second |
| Fixed 800×600 canvas: in narrow windows the player was cut off and the controls overflowed | No scaling |
| Space is both dash and restart, so a panic dash (or held key) restarted the game before you saw your score | No delay after dying; key auto-repeat not ignored |
| Holding Space dashed over and over | Key auto-repeat not ignored |
| "New High Score!" showed when you only tied the high score (including scoring 0 on your first game) | Compared with `>=` after the high score had already been updated |
| Player disappeared off one edge and reappeared on the other when wrapping, and couldn't collide with anything across the edge | Drawn and collided at a single x position |
| Switching tabs while holding an arrow key left the player moving | The key release happened while the page wasn't focused, so it never arrived |
| README said to open `index.html` directly, which Chrome blocks for JavaScript modules | File loaded from disk instead of a web server |
| Roboto was loaded but the canvas text used the default `sans-serif` | Font name never used in canvas code |

### Code health notes (not bugs)

- `js/game.js` does most of the work: input, rules, spawning, HUD and all menus.
- The object reuse ("pooling") code adds complexity for no gain with ~10 objects on screen.
- The star shape is drawn twice: in `Obstacle.draw` (`js/obstacle.js`) and in `drawShape('star')` (`js/utils.js`).
- Achievements are half-built: there are only two, you're never told when one unlocks, and "survive 60s" is trivial because of the dodging problem.
- The only test is a placeholder (`1 + 1 === 2`). The collision code in `js/utils.js` has no side effects, so it's easy to test. Note that Jest with `"type": "module"` needs `NODE_OPTIONS=--experimental-vm-modules` to import the game's modules.
- Removed obstacles are moved off screen (`obs.y = GAME_HEIGHT + 100`) rather than being removed from the list.
- New obstacles appear on top of the score in the top-left corner.

---

## Phase 1: fix the bugs ✅

- [x] One game loop for the whole page; pause, resume and restart only change state
- [x] Stars and particles move per second instead of per frame
- [x] Canvas scales to fit the window at 4:3, stays sharp on high-DPI screens, 16px side margins, controls wrap on narrow screens
- [x] Space ignored for 0.75s after dying (`RESTART_LOCKOUT` in `js/config.js`); the restart prompt appears when it's ready
- [x] Held Space no longer repeats dash, start, resume or restart
- [x] "New High Score!" only when the score actually beats the old high score
- [x] Player is drawn on both edges while wrapping and collides on both sides
- [x] Losing window or tab focus releases held keys and pauses the game
- [x] Canvas text uses Roboto
- [x] README explains how to run a local server; the controls bar lists Pause

## Phase 1.5: stutter fix ✅

Reported after Phase 1: motion felt stuttery, more so as things sped up.

- Measured with a harness that runs the real `update()` + `draw()` and forces the GPU to finish each frame. Per-frame work **doesn't** grow as the game speeds up (about 3 shapes are on screen early and late, because faster shapes leave sooner). It **does** scale with canvas resolution, and the full-screen gradient fill dominated (~4.4 of ~5.2ms at 1600×1200).
- Likely explanation: frames occasionally missed the 120Hz budget (8.3ms). The faster things move, the bigger each dropped frame's jump looks, so it felt worse later in a run. Phase 1 also let the canvas resolution follow the window size, which made big windows more expensive than the original fixed 1600×1200.
- Caveat: the harness probably pushes Chrome into slower CPU rendering, so the absolute numbers overstate real GPU cost. It hasn't been confirmed on real frames yet.

- [x] Background gradient moved to CSS; each frame just clears the canvas
- [x] Removed `shadowBlur` from shapes, player and HUD (black shadows on a near-black background were invisible anyway)
- [x] Canvas resolution capped at 2× the logical size (1600×1200)
- [x] Frame meter: press **`** in game to see fps, the worst frame gap and time spent per frame
- [x] Dev server (`.claude/launch.json`) sends `Cache-Control: no-store` so edits show up on reload
- [ ] Confirm in a real browser with the frame meter that frames stay smooth late in a run

Result in the same harness: ~5.3ms → ~0.3ms per frame at 1600×1200.

## Phase 2: make catching matter ✅ (first pass, needs play-testing)

Goal: the player must keep catching shapes to survive, and the pressure keeps building whatever they do.

- [x] **Energy bar** that drains over time and refills on each catch; the run ends when it's empty. Drains 10% per second, each catch refills 20% (`ENERGY_*` in `js/config.js`). Shown along the bottom under the player and pulses red when low.
- [x] **Difficulty based on time survived** instead of score: `SPEED_CURVE` and `SPAWN_INTERVAL_CURVE` keyframes in `js/config.js` (150 → 300 → 450 → 600 px/s at 0/60/180/330s).
- [x] Combo multiplier capped at x8 (`MAX_COMBO_MULTIPLIER`); score no longer affects speed at all.
- [x] Shield decision: unchanged for now. It still absorbs one wrong shape and doesn't touch energy.
- [x] Game-over screen says why the run ended ("Wrong shape!" / "Out of energy!").
- [ ] Play-test and tune: drain rate, refill per catch, ramp speed.

Simulation results (30 seeded runs each, simulated players with a 0.25s reaction time):

| Player | Median survival | How runs ended |
| --- | --- | --- |
| Dodger (never changes shape, only avoids shapes that would kill it) | 10s | all ran out of energy |
| Catcher (goes for reachable shapes, dodges the wrong ones crudely) | 27s | all hit a wrong shape (the bot dodges badly) |
| Catcher with wrong-shape deaths turned off (tests energy only) | 2.4 min (best 4.7) | all ran out of energy as speed rose |

So dodging alone now dies in 10s, a decent catcher keeps its energy up for minutes, and the speed-up eventually ends the run. Before this change the dodger survived 3+ minutes with the speed stuck at 150.

Ideas if it doesn't feel right after play-testing:
- Lives that you lose when a shape you could have caught hits the floor.
- Make the drain rate rise slowly over time too.
- Have the shield also pause the drain while active.

## Phase 3: readability and game feel

Goal: you know what shape something is without reading it, and catches feel good.

- [ ] Give each shape its own colour (and make the player change colour with its shape).
- [ ] Sound effects generated in code with the Web Audio API (no audio files): catch, wrong shape, dash, shield, a combo sound that rises in pitch.
- [ ] Screen shake on death and shield breaks, plus a brief freeze when you catch something.
- [ ] Notifications when an achievement unlocks, and more achievements worth chasing.
- [ ] Move the HUD so new obstacles don't appear on top of the score.

## Phase 4: depth, reach and replay value

- [ ] Designed spawn patterns (a row of three triangles, alternating circle/square, a fast burst of one shape) instead of pure randomness.
- [ ] Better keyboard layout: morph keys next to the arrow keys (e.g. A/S/D or Z/X/C), keeping 1/2/3 as alternates.
- [ ] Touch controls for phones: swipe or drag to move, three on-screen buttons to change shape.
- [ ] Daily challenge: the same random seed for everyone each day, with a shareable result.
- [ ] Deploy to GitHub Pages so there's a link to share.

## Ongoing: code health

- [ ] Split input handling and drawing (HUD and menus) out of `js/game.js`.
- [ ] Remove the object pooling code.
- [ ] Draw the star power-up with `drawShape` instead of duplicate code.
- [ ] Remove caught obstacles properly instead of moving them off screen.
- [ ] Real tests: collision helpers, scoring and combo rules, the restart delay, energy drain/refill, `interpolate`. Fix the Jest setup for ES modules.
- [ ] Turn the balance simulation (simulated dodger/catcher players over seeded runs) into a script in the repo so tuning changes can be checked quickly.
