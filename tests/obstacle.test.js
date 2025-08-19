import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Obstacle update moves and rotates based on velocities', async () => {
  global.window = { devicePixelRatio: 1 };
  const { Obstacle } = await import('../js/obstacle.js');

  const vx = 3;
  const rotationSpeed = Math.PI / 4;
  const obs = new Obstacle(10, 20, 30, 'normal', 'square', vx, rotationSpeed);
  const dt = 0.5;
  const speed = 100;

  const initialX = obs.x;
  const initialY = obs.y;
  const initialRotation = obs.rotation;

  obs.update(dt, speed);

  assert.equal(obs.x, initialX + vx * dt);
  assert.ok(Math.abs(obs.rotation - (initialRotation + rotationSpeed * dt)) < 1e-10);
  assert.equal(obs.y, initialY + speed * dt);
});
