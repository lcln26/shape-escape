import { shapeOutline, blendOutlines, mixColor } from '../js/utils.js';
import { Player } from '../js/player.js';
import { SHAPE_COLORS } from '../js/config.js';

test('every shape outline has the same number of points, so any two can blend', () => {
  const lengths = ['circle', 'square', 'triangle'].map(s => shapeOutline(s, 50).length);
  expect(new Set(lengths).size).toBe(1);
});

test('outlines start at the top centre', () => {
  for (const shape of ['circle', 'square', 'triangle']) {
    const [first] = shapeOutline(shape, 50);
    expect(first.x).toBeCloseTo(0);
    expect(first.y).toBeLessThan(0);
  }
});

test('blending goes from one outline to the other', () => {
  const a = shapeOutline('circle', 50), b = shapeOutline('square', 50);
  expect(blendOutlines(a, b, 0)).toEqual(a);
  expect(blendOutlines(a, b, 1)).toEqual(b);
});

test('mixColor blends hex colours', () => {
  expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
});

test('the player switches shape instantly but the drawing morphs, then settles', () => {
  const player = new Player({});
  player.morphTo('triangle');
  expect(player.shape).toBe('triangle'); // gameplay changes immediately
  player.update(0.03, {});
  expect(player.outline()).not.toEqual(shapeOutline('triangle', player.size));
  expect(player.color()).not.toBe(SHAPE_COLORS.triangle);
  player.update(0.2, {});
  expect(player.outline()).toEqual(shapeOutline('triangle', player.size));
  expect(player.color()).toBe(SHAPE_COLORS.triangle);
});
