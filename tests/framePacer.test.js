import { FramePacer } from '../js/framePacer.js';

const INTERVAL = 1 / 120;

test('steady frames pass straight through', () => {
  const pacer = new FramePacer(0.1);
  for (let i = 0; i < 10; i++) expect(pacer.step(INTERVAL, INTERVAL)).toBeCloseTo(INTERVAL);
});

test('a late frame is spread over the next few instead of jumping', () => {
  const pacer = new FramePacer(0.1);
  const steps = [pacer.step(3 * INTERVAL, INTERVAL)]; // a 25ms hitch at 120Hz
  for (let i = 0; i < 6; i++) steps.push(pacer.step(INTERVAL, INTERVAL));
  // No single step is more than 1.5 normal frames...
  steps.forEach(s => expect(s).toBeLessThanOrEqual(1.5 * INTERVAL + 1e-12));
  // ...and the game is fully caught up with real time a few frames later.
  const total = steps.reduce((a, b) => a + b, 0);
  expect(total).toBeCloseTo(9 * INTERVAL);
  expect(steps[steps.length - 1]).toBeCloseTo(INTERVAL);
});

test('long stalls (like switching tabs) are capped', () => {
  const pacer = new FramePacer(0.1);
  let total = 0;
  total += pacer.step(5, INTERVAL);
  for (let i = 0; i < 100; i++) total += pacer.step(0, INTERVAL);
  expect(total).toBeCloseTo(0.1);
});
