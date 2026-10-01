import { GAME_WIDTH, SPAWN_INTERVAL_CURVE, PATTERN_CHANCE_CURVE, STAR_INTERVAL } from "./config.js";
import { interpolate } from "./utils.js";
import { pick, range, intRange } from "./random.js";

export const SHAPES = ['circle', 'square', 'triangle'];
export const SHAPE_SIZE = 40;
export const STAR_SIZE = 30;
const MIN_X = SHAPE_SIZE / 2 + 4;
const MAX_X = GAME_WIDTH - SHAPE_SIZE / 2 - 4;

// A wall spans the full width with gaps narrower than the player, so it
// can't be dodged: you have to line up under a shape you match.
export const WALL_SLOTS = 10;
export const WALL_SPACING = GAME_WIDTH / WALL_SLOTS;

function otherShape(rng, shape) {
  return pick(rng, SHAPES.filter(s => s !== shape));
}

function clampX(x) {
  return Math.min(MAX_X, Math.max(MIN_X, x));
}

// Patterns are designed groups of shapes. Each build() returns events
// ({ delay, x, shape }) relative to the pattern's start. `from` is the run
// time (s) at which a pattern can first appear, `rest` scales the gap after
// it, and spacing is derived from the current fall speed so shapes in a
// column never overlap.
export const PATTERNS = [
  {
    name: 'stream', from: 0, weight: 3,
    // A column of one shape: stay put and build a combo.
    build({ rng, speed }) {
      const shape = pick(rng, SHAPES);
      const x = range(rng, MIN_X, MAX_X);
      const gap = Math.max(80 / speed, 0.18);
      return Array.from({ length: intRange(rng, 4, 6) }, (_, i) => ({ delay: i * gap, x, shape }));
    },
  },
  {
    name: 'twins', from: 10, weight: 3,
    // Two different shapes side by side, twice: pick one, avoid the other.
    build({ rng }) {
      const events = [];
      for (let pair = 0; pair < 2; pair++) {
        const x = range(rng, MIN_X, MAX_X - 90);
        const shape = pick(rng, SHAPES);
        events.push({ delay: pair * 0.7, x, shape });
        events.push({ delay: pair * 0.7, x: x + 90, shape: otherShape(rng, shape) });
      }
      return events;
    },
  },
  {
    name: 'sweep', from: 20, weight: 2,
    // A diagonal line of one shape across the screen: chase it.
    build({ rng }) {
      const shape = pick(rng, SHAPES);
      const leftToRight = rng() < 0.5;
      const count = 6;
      const start = range(rng, MIN_X, GAME_WIDTH - count * 110);
      return Array.from({ length: count }, (_, i) => {
        const offset = start + i * 110;
        return { delay: i * 0.13, x: clampX(leftToRight ? offset : GAME_WIDTH - offset), shape };
      });
    },
  },
  {
    name: 'alternating', from: 30, weight: 2,
    // A column switching between two shapes: change shape in rhythm.
    build({ rng, speed }) {
      const a = pick(rng, SHAPES);
      const b = otherShape(rng, a);
      const x = range(rng, MIN_X, MAX_X);
      const gap = Math.max(130 / speed, 0.35);
      return Array.from({ length: intRange(rng, 4, 6) }, (_, i) => ({ delay: i * gap, x, shape: i % 2 ? b : a }));
    },
  },
  {
    name: 'wall', from: 45, weight: 2, rest: 1.6,
    // A full-width row in runs of 1-3 of the same shape.
    build({ rng }) {
      const events = [];
      let shape = pick(rng, SHAPES);
      let run = intRange(rng, 1, 3);
      for (let i = 0; i < WALL_SLOTS; i++) {
        if (run === 0) {
          shape = otherShape(rng, shape);
          run = intRange(rng, 1, 3);
        }
        events.push({ delay: 0, x: WALL_SPACING * (i + 0.5), shape });
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
      const left = range(rng, MIN_X, MAX_X - 220);
      return Array.from({ length: 6 }, (_, i) => ({ delay: i * 0.38, x: i % 2 ? left + 220 : left, shape }));
    },
  },
  {
    name: 'burst', from: 100, weight: 2,
    // A quick cluster of random shapes: read fast.
    build({ rng }) {
      return Array.from({ length: 4 }, (_, i) => ({ delay: i * 0.15, x: range(rng, MIN_X, MAX_X), shape: pick(rng, SHAPES) }));
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

// Decides what falls and when. Everything random comes from the rng passed
// in, so the same seed always produces the same run. Shield stars run on
// their own timer and never take the place of a shape.
export class Spawner {
  constructor(rng) {
    this.rng = rng;
    this.clock = 0;
    this.queue = [];
    this.cooldown = 0.6;
    this.starTimer = range(rng, STAR_INTERVAL[0], STAR_INTERVAL[1]);
    this.lastPattern = null;
  }

  // Calls emit({ x, shape, type }) for each spawn due this frame.
  update(dt, runTime, speed, emit) {
    this.clock += dt;
    while (this.queue.length && this.queue[0].at <= this.clock) {
      const { x, shape } = this.queue.shift();
      emit({ x, shape, type: 'normal' });
    }
    if (this.queue.length === 0) {
      this.cooldown -= dt;
      if (this.cooldown <= 0) this.plan(runTime, speed);
    }
    this.starTimer -= dt;
    if (this.starTimer <= 0) {
      emit({ x: range(this.rng, MIN_X, MAX_X), shape: 'star', type: 'powerup' });
      this.starTimer = range(this.rng, STAR_INTERVAL[0], STAR_INTERVAL[1]);
    }
  }

  plan(runTime, speed) {
    const interval = interpolate(SPAWN_INTERVAL_CURVE, runTime);
    const unlocked = PATTERNS.filter(p => runTime >= p.from && p !== this.lastPattern);
    if (unlocked.length && this.rng() < interpolate(PATTERN_CHANCE_CURVE, runTime)) {
      const pattern = pickWeighted(this.rng, unlocked);
      this.lastPattern = pattern;
      for (const e of pattern.build({ rng: this.rng, speed })) {
        this.queue.push({ at: this.clock + e.delay, x: e.x, shape: e.shape });
      }
      this.queue.sort((a, b) => a.at - b.at);
      this.cooldown = interval * (pattern.rest || 1.2);
    } else {
      this.lastPattern = null;
      this.queue.push({ at: this.clock, x: range(this.rng, MIN_X, MAX_X), shape: pick(this.rng, SHAPES) });
      this.cooldown = interval;
    }
  }
}
