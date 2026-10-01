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

## Phase 2: make catching matter

Goal: the player must keep catching shapes to survive, and the pressure keeps building whatever they do.

- [ ] **Energy bar** that drains over time and refills on each catch; the run ends when it's empty. Dodging buys time but can't last forever.
- [ ] **Difficulty based on time survived** instead of score, so the curve is smooth and predictable.
- [ ] Rebalance scoring so combos reward skill without changing the speed.
- [ ] Decide what the shield does once the energy bar exists (absorb one wrong shape? pause the drain?).
- [ ] Play-test and tune: drain rate, refill per catch, ramp speed.
- Alternative to consider if the energy bar doesn't feel right: lives that you lose when a shape you could have caught hits the floor.

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
- [ ] Real tests: collision helpers, scoring and combo rules, the restart delay. Fix the Jest setup for ES modules.
