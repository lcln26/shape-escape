import { GAME_WIDTH, HUD_HEIGHT, PLAYER_Y, MOVE_SPEED, BEAT, PREVIEW_DURATION, SPEED_CURVE, SPAWN_INTERVAL_CURVE, PATTERN_CHANCE_CURVE, STAR_INTERVAL } from "./config.js";
import { interpolate } from "./utils.js";
import { pick, range, intRange } from "./random.js";

export const SHAPES = ['circle', 'square', 'triangle'];
export const SHAPE_SIZE = 40;
export const STAR_SIZE = 30;
export const SPAWN_Y = HUD_HEIGHT + SHAPE_SIZE / 2 + 6;
export const MIN_X = SHAPE_SIZE / 2 + 4;
export const MAX_X = GAME_WIDTH - SHAPE_SIZE / 2 - 4;
// Shapes are caught when they first touch the player, about this far above
// its centre, so that's the moment timed to land on the beat.
const CONTACT_OFFSET = 45;
export const FALL_DISTANCE = PLAYER_Y - CONTACT_OFFSET - SPAWN_Y;
// Every shape is placed so a perfect player moving at this speed (a margin
// under full speed, no dash needed) can reach it from the previous one.
export const REACH_SPEED = MOVE_SPEED * 0.8;
// Shapes that share a column need this much vertical space between them.
export const MIN_VERTICAL_GAP = 70;

export function speedAt(t) {
  return interpolate(SPEED_CURVE, t);
}

// Seconds from a shape spawning (its preview appearing) at run time t until
// it reaches the player. Each shape keeps the speed it is released with.
export function leadTime(t) {
  return PREVIEW_DURATION + FALL_DISTANCE / speedAt(t + PREVIEW_DURATION);
}

function otherShape(rng, shape) {
  return pick(rng, SHAPES.filter(s => s !== shape));
}

// The shortest gap (in beats) that keeps shapes in one column apart.
function columnGapBeats(speed) {
  return speed * BEAT * 0.5 >= MIN_VERTICAL_GAP ? 0.5 : 1;
}

// Patterns are designed groups of shapes, all catchable with perfect play.
// build() returns events ({ beat, x, shape }) with beat offsets from the
// pattern's first shape; the spawner slides the group sideways so its first
// shape is reachable. `from` is the run time (s) a pattern unlocks.
export const PATTERNS = [
  {
    name: 'stream', from: 0, weight: 3,
    // A column of one shape: stay put and build a combo.
    build({ rng, speed }) {
      const shape = pick(rng, SHAPES);
      const x = range(rng, MIN_X, MAX_X);
      const gap = columnGapBeats(speed);
      return Array.from({ length: intRange(rng, 4, 6) }, (_, i) => ({ beat: i * gap, x, shape }));
    },
  },
  {
    name: 'pair', from: 10, weight: 3,
    // Two different shapes a step apart: catch one, morph, catch the other.
    build({ rng }) {
      const shape = pick(rng, SHAPES);
      const x = range(rng, MIN_X, MAX_X - 110);
      const [a, b] = rng() < 0.5 ? [x, x + 110] : [x + 110, x];
      return [{ beat: 0, x: a, shape }, { beat: 1, x: b, shape: otherShape(rng, shape) }];
    },
  },
  {
    name: 'sweep', from: 20, weight: 2,
    // A diagonal line of one shape: run along it.
    build({ rng }) {
      const shape = pick(rng, SHAPES);
      const step = rng() < 0.5 ? 120 : -120;
      return Array.from({ length: 6 }, (_, i) => ({ beat: i, x: GAME_WIDTH / 2 + (i - 2.5) * step, shape }));
    },
  },
  {
    name: 'alternating', from: 30, weight: 2,
    // A column switching between two shapes: morph in rhythm.
    build({ rng, speed }) {
      const a = pick(rng, SHAPES);
      const b = otherShape(rng, a);
      const x = range(rng, MIN_X, MAX_X);
      const gap = Math.max(columnGapBeats(speed), 1);
      return Array.from({ length: intRange(rng, 4, 6) }, (_, i) => ({ beat: i * gap, x, shape: i % 2 ? b : a }));
    },
  },
  {
    name: 'staircase', from: 45, weight: 2, rest: 1.5,
    // A diagonal across most of the screen that changes shape in runs of
    // 1-3: run and morph at the same time.
    build({ rng }) {
      const step = rng() < 0.5 ? 105 : -105;
      const events = [];
      let shape = pick(rng, SHAPES);
      let run = intRange(rng, 1, 3);
      for (let i = 0; i < 7; i++) {
        if (run === 0) {
          shape = otherShape(rng, shape);
          run = intRange(rng, 1, 3);
        }
        events.push({ beat: i, x: GAME_WIDTH / 2 + (i - 3) * step, shape });
        run--;
      }
      return events;
    },
  },
  {
    name: 'zigzag', from: 75, weight: 1,
    // One shape alternating between two columns: move back and forth.
    build({ rng }) {
      const shape = pick(rng, SHAPES);
      const left = range(rng, MIN_X, MAX_X - 140);
      return Array.from({ length: 6 }, (_, i) => ({ beat: i, x: i % 2 ? left + 140 : left, shape }));
    },
  },
  {
    name: 'burst', from: 100, weight: 2,
    // Quick random shapes on half beats, close together: read and morph fast.
    build({ rng }) {
      let x = range(rng, MIN_X + 150, MAX_X - 150);
      return Array.from({ length: 4 }, (_, i) => {
        if (i > 0) x += (rng() < 0.5 ? -1 : 1) * range(rng, 45, 70);
        return { beat: i * 0.5, x, shape: pick(rng, SHAPES) };
      });
    },
  },
];

function pickWeighted(rng, items) {
  let roll = rng() * items.reduce((sum, p) => sum + p.weight, 0);
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

function quantize(value, step) {
  return Math.round(value / step) * step;
}

// Decides what falls and when. Shapes are planned by arrival time (when they
// reach the player) on a half-beat grid, then spawned early enough to arrive
// exactly then. Each arrival is reachable from the one before, so a perfect
// run can catch everything. All randomness comes from the rng passed in, so
// the same seed always produces the same run. Shield stars are extra: they
// come on their own timer and never take the place of a shape.
export class Spawner {
  constructor(rng) {
    this.rng = rng;
    this.planned = []; // { arrival, x, shape, type }, sorted by arrival
    this.last = { arrival: 0, x: GAME_WIDTH / 2 };
    // First shape lands on the first full beat after it can possibly arrive.
    this.nextArrival = Math.ceil((leadTime(0) + 0.5) / BEAT) * BEAT;
    this.nextStar = range(rng, STAR_INTERVAL[0], STAR_INTERVAL[1]);
    this.lastPattern = null;
  }

  // Calls emit({ x, shape, type, lateBy }) for each shape due to spawn by
  // run time `now`. lateBy is how far past its ideal spawn time this frame
  // is, so the caller can start it that far along and keep it on the beat.
  update(now, emit) {
    const horizon = now + leadTime(now) + 2 * BEAT;
    while (this.nextArrival < horizon) this.plan();
    while (this.planned.length) {
      const next = this.planned[0];
      const spawnAt = next.arrival - leadTime(now);
      if (now < spawnAt) break;
      this.planned.shift();
      emit({ x: next.x, shape: next.shape, type: next.type, lateBy: now - spawnAt });
    }
  }

  add(arrival, x, shape, type = 'normal') {
    this.planned.push({ arrival, x, shape, type });
    this.planned.sort((a, b) => a.arrival - b.arrival);
    if (type === 'normal') this.last = { arrival, x };
  }

  // Furthest a perfect player can travel from the last shape by `arrival`.
  reach(arrival) {
    return REACH_SPEED * (arrival - this.last.arrival);
  }

  plan() {
    const t = this.nextArrival;
    const intervalBeats = Math.max(1, quantize(interpolate(SPAWN_INTERVAL_CURVE, t) / BEAT, 0.5));

    if (t >= this.nextStar) {
      // Off the shape grid by half a beat, anywhere on screen: a bonus to go for.
      this.add(t - BEAT / 2, range(this.rng, MIN_X, MAX_X), 'star', 'powerup');
      this.nextStar = t + range(this.rng, STAR_INTERVAL[0], STAR_INTERVAL[1]);
    }

    const unlocked = PATTERNS.filter(p => t >= p.from && p !== this.lastPattern);
    if (unlocked.length && this.rng() < interpolate(PATTERN_CHANCE_CURVE, t)) {
      const pattern = pickWeighted(this.rng, unlocked);
      this.lastPattern = pattern;
      const { events, start } = this.placePattern(pattern.build({ rng: this.rng, speed: speedAt(t) }), t);
      for (const e of events) this.add(start + e.beat * BEAT, e.x, e.shape);
      const lastBeat = Math.max(...events.map(e => e.beat));
      const restBeats = Math.max(1, quantize(intervalBeats * (pattern.rest || 1), 0.5));
      this.nextArrival = start + (lastBeat + restBeats) * BEAT;
    } else {
      this.lastPattern = null;
      const reach = this.reach(t);
      const x = range(this.rng, Math.max(MIN_X, this.last.x - reach), Math.min(MAX_X, this.last.x + reach));
      this.add(t, x, pick(this.rng, SHAPES));
      this.nextArrival = t + intervalBeats * BEAT;
    }
  }

  // Slides a pattern sideways so it stays on screen with its first shape
  // reachable from the last one. If even the closest on-screen position is
  // too far to reach by `t`, the pattern starts a few half-beats later.
  // Returns the placed events and the arrival time of the first one.
  placePattern(events, t) {
    const xs = events.map(e => e.x);
    const firstX = events.find(e => e.beat === 0).x;
    const lo = MIN_X - Math.min(...xs);
    const hi = MAX_X - Math.max(...xs);
    // The on-screen shift that brings the first shape closest to the player.
    const closest = Math.min(hi, Math.max(lo, this.last.x - firstX));
    const distance = Math.abs(firstX + closest - this.last.x);
    let start = t;
    while (this.reach(start) < distance) start += BEAT / 2;
    const reach = this.reach(start);
    const shiftLo = Math.max(lo, this.last.x - reach - firstX);
    const shiftHi = Math.min(hi, this.last.x + reach - firstX);
    const shift = range(this.rng, shiftLo, shiftHi);
    return { events: events.map(e => ({ ...e, x: e.x + shift })), start };
  }
}
