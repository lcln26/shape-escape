import test from 'node:test';
import assert from 'node:assert';

// Stub window for modules that expect it (config.js)
global.window = { devicePixelRatio: 1 };
const { refinedCollisionDetection } = await import('../js/utils.js');

const degToRad = (deg) => (deg * Math.PI) / 180;

test('rotated square collides with axis-aligned square', () => {
  const base = { x: 0, y: 0, size: 20, shape: 'square', rotation: 0 };
  const rotated = { x: 21, y: 0, size: 20, shape: 'square', rotation: degToRad(45) };
  assert.ok(refinedCollisionDetection(base, rotated));
});

test('rotated square positioned away does not collide', () => {
  const base = { x: 0, y: 0, size: 20, shape: 'square', rotation: 0 };
  const rotated = { x: 40, y: 0, size: 20, shape: 'square', rotation: degToRad(45) };
  assert.ok(!refinedCollisionDetection(base, rotated));
});

test('rotated square collides with circle when overlapping', () => {
  const square = { x: 0, y: 0, size: 20, shape: 'square', rotation: degToRad(45) };
  const circle = { x: 5, y: 0, size: 20, shape: 'circle' };
  assert.ok(refinedCollisionDetection(square, circle));
});
