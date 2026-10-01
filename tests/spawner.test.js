import { GAME_WIDTH, SPEED_CURVE } from '../js/config.js';
import { Spawner, PATTERNS, WALL_SPACING, SHAPE_SIZE } from '../js/spawner.js';
import { createRng } from '../js/random.js';
import { interpolate } from '../js/utils.js';

// Runs a spawner for `seconds` of game time and records what it emits.
function record(seed, seconds, dt = 1 / 60) {
  const spawner = new Spawner(createRng(seed));
  const spawns = [];
  for (let t = 0; t < seconds; t += dt) {
    spawner.update(dt, t, interpolate(SPEED_CURVE, t), (s) => spawns.push({ t, ...s }));
  }
  return spawns;
}

test('the same seed produces the same spawns', () => {
  expect(record(1234, 120)).toEqual(record(1234, 120));
});

test('different seeds produce different spawns', () => {
  expect(record(1, 60)).not.toEqual(record(2, 60));
});

test('every spawn is on screen', () => {
  for (const s of record(99, 300)) {
    expect(s.x).toBeGreaterThanOrEqual(SHAPE_SIZE / 2);
    expect(s.x).toBeLessThanOrEqual(GAME_WIDTH - SHAPE_SIZE / 2);
  }
});

// Stars used to take the place of a shape, leaving fewer shapes to catch.
test('shield stars come on their own timer and keep shape spawns steady', () => {
  const spawns = record(7, 120);
  const stars = spawns.filter(s => s.type === 'powerup');
  const shapes = spawns.filter(s => s.type === 'normal');
  expect(stars.length).toBeGreaterThanOrEqual(120 / 14 - 1);
  expect(stars.length).toBeLessThanOrEqual(120 / 8 + 1);
  expect(stars.every(s => s.shape === 'star')).toBe(true);
  expect(shapes.every(s => ['circle', 'square', 'triangle'].includes(s.shape))).toBe(true);
});

test('patterns only appear once unlocked', () => {
  const rng = createRng(5);
  for (const pattern of PATTERNS) {
    const events = pattern.build({ rng, speed: 300 });
    expect(events.length).toBeGreaterThan(1);
  }
  // Nothing but streams and singles before 10s: spawns before then come
  // either one at a time or as a same-shape, same-column stream.
  for (let seed = 1; seed <= 50; seed++) {
    const early = record(seed, 10).filter(s => s.type === 'normal');
    const byTime = new Map();
    early.forEach(s => byTime.set(s.t, [...(byTime.get(s.t) || []), s]));
    for (const group of byTime.values()) expect(group.length).toBe(1);
  }
});

// The player is at least 50px wide (a square); slipping through a wall needs
// a gap at least that wide between neighbouring shapes.
test('a wall spans the screen with gaps too narrow to slip through', () => {
  const wall = PATTERNS.find(p => p.name === 'wall');
  const events = wall.build({ rng: createRng(3), speed: 300 });
  expect(events).toHaveLength(Math.round(GAME_WIDTH / WALL_SPACING));
  expect(events.every(e => e.delay === 0)).toBe(true);
  const xs = events.map(e => e.x).sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1] - SHAPE_SIZE).toBeLessThan(50);
  expect(xs[0]).toBeLessThan(50);
  expect(GAME_WIDTH - xs[xs.length - 1]).toBeLessThan(50);
  // Every wall offers more than one shape to choose from.
  expect(new Set(events.map(e => e.shape)).size).toBeGreaterThan(1);
});

test('shapes in a single column never overlap at any speed', () => {
  const rng = createRng(11);
  for (const name of ['stream', 'alternating']) {
    const pattern = PATTERNS.find(p => p.name === name);
    for (const speed of [180, 400, 650]) {
      const events = pattern.build({ rng, speed });
      for (let i = 1; i < events.length; i++) {
        const verticalGap = (events[i].delay - events[i - 1].delay) * speed;
        expect(verticalGap).toBeGreaterThanOrEqual(SHAPE_SIZE * 1.1 + 20);
      }
    }
  }
});
