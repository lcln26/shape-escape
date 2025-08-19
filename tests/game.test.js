import test from 'node:test';
import assert from 'node:assert/strict';

// Provide minimal browser-like globals required by the game modules.
global.window = { devicePixelRatio: 1 };
global.document = { addEventListener() {}, removeEventListener() {} };
global.localStorage = { getItem() { return '0'; }, setItem() {} };
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => {};

// Dynamically import Game after globals are set.
const { Game } = await import('../js/game.js');

function createGame() {
  const canvas = {};
  const ctx = {};
  return new Game(canvas, ctx);
}

test('spawnObstacle sets velocity and rotation from Math.random for normal obstacle', async () => {
  const game = createGame();
  const originalRandom = Math.random;
  const seq = [0.5, 0.2, 0.3, 0.5, 0.75];
  let i = 0;
  Math.random = () => seq[i++];
  try {
    game.spawnObstacle();
  } finally {
    Math.random = originalRandom;
  }
  const obs = game.obstacles[0];
  assert.equal(obs.type, 'normal');
  assert.equal(obs.shape, 'triangle');
  assert.equal(obs.vx, 0.2 * 200 - 100);
  assert.equal(obs.rotationSpeed, 0.3 * 5 - 2.5);
  assert.equal(i, 5);
});

test('spawnObstacle spawns powerup when probability threshold met', async () => {
  const game = createGame();
  const originalRandom = Math.random;
  const seq = [0.4, 0.6, 0.7, 0.05];
  let i = 0;
  Math.random = () => seq[i++];
  try {
    game.spawnObstacle();
  } finally {
    Math.random = originalRandom;
  }
  const obs = game.obstacles[0];
  assert.equal(obs.type, 'powerup');
  assert.equal(obs.shape, 'star');
  assert.equal(obs.vx, 0.6 * 200 - 100);
  assert.equal(obs.rotationSpeed, 0.7 * 5 - 2.5);
  assert.equal(i, 4);
});
