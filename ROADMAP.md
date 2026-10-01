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
- [x] Confirm in a real browser with the frame meter. Play-test showed 120 fps with **average work 0.2ms** but occasional **25ms** gaps, and it still felt laggy at times. See "Stutter, round 2" below.

Result in the same harness: ~5.3ms → ~0.3ms per frame at 1600×1200.

## Stutter, round 2

- **What the meter showed:** 120 fps, average work 0.2ms, but the worst frame gap sometimes reached 25ms (three refreshes).
- **The game's own code isn't causing the gaps.** 2,400 frames of update + draw with a simulated player catching at x8: typical 0–0.2ms, 99.9% under 2ms, slowest single frame 5.9ms. All of that fits inside the 8.3ms frame at 120Hz, so the 25ms gaps come from outside the game's code (browser, GPU or system).
- **The lag feeling was most likely the Phase 3 hit-stop.** Every catch froze the game for 35ms, and streams mean several catches a second. It's removed; catches now make the player pop in size instead (`CATCH_POP`). Regression test: "catching never freezes the game".
- [x] Remove hit-stop
- [x] Frame meter now shows **slow** (frames that missed a refresh), **max work** (slowest single frame of game code) and a graph of the last 240 frame gaps, so outside delays can be told apart from game delays
- [x] Baseline page `tools/framepace.html`: an almost empty animation with the same meter. If it spikes like the game, the cause is outside the game.
- [x] Play-test: the baseline page spiked too, so the cause is outside the game.

## Stutter, round 3: browsers ✅

`tools/framepace.html` now benchmarks the real game with a simulated player under several setups and saves results through the dev server (`scripts/serve.py`, `POST /__bench` → `.bench/`), so it can be run in real browsers on the real display. Results on the dev Mac (120Hz, 30s per run):

| Browser | Game: dropped frames | Empty page: dropped frames | Notes |
| --- | --- | --- | --- |
| Firefox | 0 (three runs) | 5 | smoothest |
| Chrome | 1 | 2 | |
| Safari | 6 | 5 | capped at 60fps; one 281ms stall |

- The game isn't the problem: in every browser the empty page drops frames about as often as the game, and the game's own code never took more than 5ms in a frame.
- An opaque canvas and a 1× resolution made no difference in Firefox, so rendering stays as it is (`Game` has an `opaque` option if that ever changes).
- [x] **Frame smoothing** (`js/framePacer.js`): after a late frame, the game catches up over the next few frames (at most 1.5× a normal step each) instead of jumping all at once. A 25ms hitch at 120Hz becomes four 12.5ms steps instead of one 25ms leap. Tests in `tests/framePacer.test.js`.
- [ ] Not yet tested: sound actually playing in Firefox. Browsers keep audio off until you click, so the automated runs were silent. To test, open `tools/framepace.html?configs=5&seconds=30` in Firefox and click **Run benchmark**. If that drops frames and the silent run doesn't, rework `js/audio.js` to pre-render each sound once instead of creating new audio objects per sound.

## Phase 2: make catching matter ✅

Goal: the player must keep catching shapes to survive, and the pressure keeps building whatever they do.

- [x] **Energy bar** that drains over time and refills on each catch; the run ends when it's empty (`ENERGY_*` in `js/config.js`). Shown along the bottom under the player and pulses red when low.
- [x] **Difficulty based on time survived** instead of score: `SPEED_CURVE` and `SPAWN_INTERVAL_CURVE` keyframes in `js/config.js`.
- [x] Combo multiplier capped at x8 (`MAX_COMBO_MULTIPLIER`); score no longer affects speed at all.
- [x] Shield decision: unchanged for now. It still absorbs one wrong shape and doesn't touch energy.
- [x] Game-over screen says why the run ended ("Wrong shape!" / "Out of energy!").
- [x] Play-test and tune. The first pass was too forgiving and too easy, so it was tightened:

| Setting | First pass | Now |
| --- | --- | --- |
| Energy drain | 10%/s (full bar lasts 10s) | 12%/s (~8s) |
| Energy per catch | 20% (break even at 0.5 catches/s) | 18% (break even at ~0.67 catches/s) |
| Fall speed | 150 → 300 → 450 → 600 px/s at 0 / 60 / 180 / 330s | 180 → 320 → 470 → 650 px/s at 0 / 45 / 120 / 240s |
| Spawn interval | 1.0 → 0.85 → 0.65 → 0.5s, same times | 0.9 → 0.75 → 0.6 → 0.45s, same times |

A middle step (14% drain, 15% per catch) was too harsh: even a simulated catcher that couldn't die to wrong shapes only lasted ~18s, because breaking even needed nearly every shape.

Current simulation results (`tools/balance.html`):

| Player | Median survival | How runs ended |
| --- | --- | --- |
| Dodger | 8.3s | all ran out of energy |
| Catcher | 23s | mostly wrong shapes (the bot dodges badly) |
| Catcher with wrong-shape deaths turned off | 58s (best 2 min) | all ran out of energy |

First-pass simulation results, for comparison (30 seeded runs each, simulated players with a 0.25s reaction time):

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

## Phase 3: readability and game feel ✅ (needs play-testing)

Goal: you know what shape something is without reading it, and catches feel good.

- [x] Each shape has its own colour (`SHAPE_COLORS`, from the Okabe-Ito palette, which stays distinguishable with common colour blindness): circle sky blue, square orange, triangle pink-purple, shield star yellow. Falling shapes have a tinted fill and solid coloured outline; the player is solid with a white outline and changes colour with its shape.
- [x] Sound effects generated in code (`js/audio.js`, no audio files): catch (rises a semitone per combo step), morph, dash, shield up/break, wrong shape, out of energy, a low-energy beep, achievements. **M** mutes, and it's remembered.
- [x] Screen shake on death and shield breaks; the player shatters on a wrong-shape death. (A 35ms freeze on each catch was tried and removed: it felt like lag.)
- [x] Achievement notifications, and eight achievements (was two): survive 60s / 2 min, 50 catches, max combo, 1,000 / 5,000 points, a catch below 10% energy, 5 shields. The game-over screen shows the count and any new ones.
- [x] HUD moved into a strip along the top; shapes now spawn below it. The game-over screen shows your score.
- [x] Start screen explains the rules and shows the three shapes with their keys.
- [ ] Play-test: is the hit-stop noticeable in a good way? Are the sounds too loud or annoying? Is the shake too much?

## Bug: shield stars broke combos ✅

Reported after Phase 3: picking up a star made the combo run out. Two causes, both fixed:

- Collecting a star didn't reset the 2s combo timer, so the time spent going for one counted against your streak. It now keeps the combo alive without adding to it. Regression test: `tests/combo.test.js`.
- Stars took the place of a shape (10% of spawns), leaving fewer shapes to keep the streak going. They now arrive on their own timer every 8–14s (`STAR_INTERVAL`). Test: `tests/spawner.test.js`.

## Phase 4: depth, reach and replay value

Priorities from play-testing: designed patterns first, then daily challenge and phone controls. **Keyboard controls stay as they are, and GitHub Pages waits.**

- [x] **Designed spawn patterns** (`js/spawner.js`). Single shapes are mixed with patterns that unlock over time and become more common (20% of spawns at the start → 65% at 4 min, `PATTERN_CHANCE_CURVE`). The same pattern never comes twice in a row.

| Pattern | What it asks | Unlocks |
| --- | --- | --- |
| Stream: a column of one shape | stay put and build a combo | 0s |
| Twins: two different shapes side by side (twice) | pick one, avoid the other | 10s |
| Sweep: a diagonal line of one shape | chase it | 20s |
| Alternating: a column switching between two shapes | change shape in rhythm | 30s |
| Wall: a full-width row in runs of 1–3, gaps narrower than the player | line up under a match; you can't dodge it | 45s |
| Zigzag: one shape alternating between two columns | move back and forth | 75s |
| Burst: four random shapes in quick succession | read fast | 100s |

- [x] Spawning uses a seeded random number generator (`js/random.js`), so the same seed always gives the same run.
- [x] **Daily challenge**: **D** on the start screen (or the Daily button on touch). Everyone gets the same seed for the local date. A separate daily best per day; **C** (or Share) copies a result like `Score 1240 · survived 1:32 · best combo x8`.
- [x] **Touch controls** (`js/touch.js`), shown on touch screens (or with `?touch` in the URL): hold ◀ ▶ to move, double-tap one to dash, tap a shape to morph, plus Play / Daily / Pause / Retry / Menu / Share buttons. Portrait puts them under the game; landscape puts them either side.
- [x] New keys added without changing existing ones: **D** daily (start screen), **Esc** back to the menu (game over), **C** copy result (daily game over).
- [x] Energy retuned for patterns: streams handed out so many easy catches that a simulated catcher lasted ~3 min on energy alone, so energy per catch dropped from 18% to 11% (back to ~65s).
- [ ] Play-test patterns: are any unfair or boring? Is the wall too punishing at 45s?
- [ ] Try touch controls on a real phone (only tested in simulated sizes and with simulated taps).
- [ ] Text inside the game is small on phones in portrait (the canvas is ~350px wide there). Consider a bigger HUD on small screens, or nudging players to landscape.
- [ ] ~~Better keyboard layout~~: keeping the current controls.
- [ ] Deploy to GitHub Pages (later).

## Fair patterns ✅

Play-test: shapes falling in a horizontal line were impossible to all catch. Checking the numbers, three patterns broke "catchable with perfect play": the wall (10 shapes at once), the sweep (needed ~850px/s; the player moves at 400) and the zigzag (~580px/s).

- [x] The spawner now plans each shape by **when it reaches the player**, on a half-beat grid, and every shape is reachable from the previous one at 80% of move speed without dashing (`REACH_SPEED`). Patterns slide sideways or wait a few half-beats to stay reachable.
- [x] The wall became a **staircase**: a diagonal that changes shape in runs. Twins became a staggered **pair**.
- [x] Tests check reachability over 300s for 8 seeds, every pattern at every speed, the beat grid, and column spacing.
- [x] Energy per catch 11% → 10%, since everything is now catchable (simulated catcher on energy alone: 77s → 63s).

## Phase 5: first attempt at music (replaced)

Built a 128 BPM synth track (square/sawtooth leads, white-noise hats, claps), catch notes on a separate pluck pitched up as combos grew, "Attempt N", and white flashes at music drops. **Play-test: the sounds were awful, catches clashed with the music, and it read as a Geometry Dash clone.** The goal was that level of polish and popularity, not copying it.

What went wrong, measured afterwards: the hi-hat sat almost entirely above 3kHz (centroid 13.7kHz), and catch notes were pitched up to ~6× on long combos, in a different register and timbre from the music. The audio was only checked for clipping and timing, never for how it sounded.

Kept: shapes landing on the beat, music following the game clock, the beat pulse and gentle hue shifts.

## Phase 6: identity ✅ (needs a listen)

See [DESIGN.md](DESIGN.md) for the pillars. In short: the shapes are the characters, your catches are the melody, calm surface with intense depth, fair and readable.

- [x] **One scale for everything** (A minor pentatonic): chords, bass and catch notes, so a catch can't clash. Tested.
- [x] **A voice per shape**: circle bell, square marimba, triangle plucked string (Karplus-Strong). A streak climbs the scale from the current chord's root, A4 to D6 at most. Panned by where you catch.
- [x] **Calm music bed**: warm pads and soft bass, then a soft kick (20s), shaker (40s), busier bass (70s). Soft waveforms only.
- [x] Shared reverb, gentle compression, a sample per note (no pitch-shifted playback). Music fades out through a closing filter on death. Heartbeat for low energy.
- [x] Measured: the melody voices sit at 440–910Hz with essentially nothing above 3kHz; the whole mix through the real audio chain peaks at 0.75.
- [x] **N** toggles music; touch pause menu has Music and Sound buttons.
- [x] `tools/sounds.html`: every voice, the music at each stage (with simulated catches), every effect.
- [x] **Visible morph**: outline and colour blend over 0.12s; gameplay still switches instantly.
- [x] **Catch ripple**: the caught shape's outline expands and fades.
- [x] Removed "Attempt N", the white flash and shake at music changes. Background hue shifts gently (blue → indigo → violet → purple).
- [ ] **Listen on `tools/sounds.html` and say what's off.** This is the step that was skipped last time.
- [ ] Open questions in DESIGN.md: music energy late in a run, a note on morph, levels vs endless.

## Ongoing: code health

- [x] Move HUD and menu drawing out of `js/game.js` (now `js/hud.js`).
- [x] Move input handling out of `js/game.js` (keyboard in `js/input.js`, touch in `js/touch.js`; both call the game's action methods).
- [x] Remove obstacle pooling (particles still pool).
- [x] Draw the star power-up with `drawShape` instead of duplicate code.
- [ ] Remove caught obstacles properly instead of moving them off screen.
- [x] Jest set up for ES modules (`npm test`). 25 tests in `tests/` cover combos, the spawner and patterns, the daily challenge, keyboard and touch input.
- [ ] More tests: collision helpers, energy drain/refill, `interpolate`.
- [x] Balance simulation lives in `tools/balance.html` (open it on the dev server; it doesn't touch your real high score).
