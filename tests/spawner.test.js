import { BEAT, PLAYER_Y } from '../js/config.js';
import { Spawner, PATTERNS, SHAPE_SIZE, MIN_X, MAX_X, REACH_SPEED, MIN_VERTICAL_GAP, speedAt } from '../js/spawner.js';
import { createRng } from '../js/random.js';
import { makeGame } from './helpers.js';

// Runs a spawner for `seconds` and records every shape it plans.
function plan(seed, seconds, dt = 1 / 120) {
  const spawner = new Spawner(createRng(seed));
  const planned = [];
  const add = spawner.add.bind(spawner);
  spawner.add = (arrival, x, shape, type) => {
    planned.push({ arrival, x, shape, type: type || 'normal' });
    add(arrival, x, shape, type);
  };
  const emitted = [];
  for (let t = 0; t < seconds; t += dt) spawner.update(t, (s) => emitted.push(s));
  return { planned, emitted };
}

const shapesOnly = (planned) => planned.filter(p => p.type === 'normal').sort((a, b) => a.arrival - b.arrival);

test('the same seed produces the same run', () => {
  expect(plan(1234, 120)).toEqual(plan(1234, 120));
});

test('different seeds produce different runs', () => {
  expect(plan(1, 60).planned).not.toEqual(plan(2, 60).planned);
});

test('every shape is on screen', () => {
  for (const p of plan(99, 300).planned) {
    expect(p.x).toBeGreaterThanOrEqual(MIN_X - 1e-9);
    expect(p.x).toBeLessThanOrEqual(MAX_X + 1e-9);
  }
});

// The core fairness rule: with perfect play you can catch every shape, so
// no two shapes arrive at once and each is reachable from the one before
// without dashing.
test.each([1, 2, 3, 4, 5, 6, 7, 8])('every shape is reachable from the previous one (seed %i)', (seed) => {
  const shapes = shapesOnly(plan(seed, 300).planned);
  for (let i = 1; i < shapes.length; i++) {
    const dt = shapes[i].arrival - shapes[i - 1].arrival;
    expect(dt).toBeGreaterThan(0);
    expect(Math.abs(shapes[i].x - shapes[i - 1].x)).toBeLessThanOrEqual(REACH_SPEED * dt + 1e-6);
  }
});

test('shapes arrive on the half-beat grid', () => {
  for (const s of shapesOnly(plan(3, 200).planned)) {
    const halfBeats = s.arrival / (BEAT / 2);
    expect(Math.abs(halfBeats - Math.round(halfBeats))).toBeLessThan(1e-6);
  }
});

test('shapes in the same column never overlap', () => {
  const shapes = shapesOnly(plan(11, 300).planned);
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length && shapes[j].arrival - shapes[i].arrival < 2; j++) {
      if (Math.abs(shapes[j].x - shapes[i].x) >= SHAPE_SIZE * 1.3) continue;
      const gap = (shapes[j].arrival - shapes[i].arrival) * speedAt(shapes[i].arrival);
      expect(gap).toBeGreaterThanOrEqual(MIN_VERTICAL_GAP - 1e-6);
    }
  }
});

// Stars used to take the place of a shape, leaving fewer shapes to catch.
test('shield stars come on their own timer, in addition to shapes', () => {
  const { planned } = plan(7, 120);
  const stars = planned.filter(p => p.type === 'powerup');
  expect(stars.length).toBeGreaterThanOrEqual(120 / 14 - 1);
  expect(stars.length).toBeLessThanOrEqual(120 / 8 + 1);
  expect(stars.every(s => s.shape === 'star')).toBe(true);
});

test.each(PATTERNS.map(p => [p.name, p]))('%s is catchable at every speed', (_, pattern) => {
  const rng = createRng(5);
  for (const speed of [180, 320, 470, 650]) {
    const events = [...pattern.build({ rng, speed })].sort((a, b) => a.beat - b.beat);
    expect(events.length).toBeGreaterThan(1);
    for (let i = 1; i < events.length; i++) {
      const dt = (events[i].beat - events[i - 1].beat) * BEAT;
      expect(dt).toBeGreaterThan(0);
      expect(Math.abs(events[i].x - events[i - 1].x)).toBeLessThanOrEqual(REACH_SPEED * dt + 1e-6);
    }
  }
});

// Through the real game: each shape touches the player at its planned time,
// within one frame, so catches land on the beat.
test.each([1, 2, 3, 4])('shapes reach the player on their planned beat (seed %i)', (seed) => {
  const game = makeGame();
  game.spawner = new Spawner(createRng(seed));
  game.endGame = () => {};
  game.playerHits = () => false; // nothing gets caught, so every shape falls the whole way
  const planned = [];
  const add = game.spawner.add.bind(game.spawner);
  game.spawner.add = (arrival, x, shape, type) => {
    planned.push({ arrival, x });
    add(arrival, x, shape, type);
  };
  const contactY = PLAYER_Y - 45;
  const dt = 1 / 120;
  const seen = new Set();
  const errors = [];
  for (let i = 0; i < 120 * 40; i++) {
    game.energy = 1;
    game.update(dt);
    for (const obs of game.obstacles) {
      if (obs.type !== 'normal' || seen.has(obs) || obs.y < contactY) continue;
      seen.add(obs);
      // Time it actually crossed the contact line, interpolated within the frame.
      const crossed = game.runTime - (obs.y - contactY) / obs.speed;
      // Streams put several shapes in one column, so match on time too.
      const error = Math.min(...planned.filter(p => Math.abs(p.x - obs.x) < 1e-6).map(p => Math.abs(crossed - p.arrival)));
      errors.push(error);
    }
  }
  expect(errors.length).toBeGreaterThan(30);
  expect(Math.max(...errors)).toBeLessThan(dt);
});
