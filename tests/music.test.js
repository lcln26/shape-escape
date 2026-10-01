import { BAR, STEPS_PER_BAR, LAYER_TIMES, SCALE, MELODY, layerAt, stepEvents, catchNote } from '../js/music.js';

const inScale = (note) => SCALE.includes(((note % 12) + 12) % 12);

const instrumentsIn = (layers) => {
  const names = new Set();
  for (let step = 0; step < STEPS_PER_BAR * 4; step++) stepEvents(step, layers).forEach(e => names.add(e.instrument));
  return [...names].sort();
};

// The rule that keeps catches from clashing with the music.
test('every note in the soundtrack and every catch note is in the scale', () => {
  for (let layers = 1; layers <= LAYER_TIMES.length; layers++) {
    for (let step = 0; step < STEPS_PER_BAR * 8; step++) {
      for (const e of stepEvents(step, layers)) if (e.note !== undefined) expect(inScale(e.note)).toBe(true);
    }
  }
  for (let t = 0; t < BAR * 8; t += BAR / 2) {
    for (let combo = 0; combo < 12; combo++) expect(inScale(catchNote(t, combo))).toBe(true);
  }
});

test('catch notes stay in a comfortable range (A4 to D6)', () => {
  for (let t = 0; t < BAR * 4; t += BAR) {
    for (let combo = 0; combo < 20; combo++) {
      const note = catchNote(t, combo);
      expect(note).toBeGreaterThanOrEqual(69);
      expect(note).toBeLessThanOrEqual(86);
    }
  }
});

test('a streak climbs, then holds at the top', () => {
  const notes = Array.from({ length: 12 }, (_, combo) => catchNote(0, combo));
  for (let i = 1; i < notes.length; i++) expect(notes[i]).toBeGreaterThanOrEqual(notes[i - 1]);
  expect(notes[notes.length - 1]).toBe(MELODY[MELODY.length - 1]);
});

test('layers join on bar lines, never mid-bar', () => {
  expect(layerAt(0)).toBe(1);
  LAYER_TIMES.slice(1).forEach((start, i) => {
    const firstBar = Math.ceil(start / BAR - 1e-9) * BAR;
    expect(layerAt(firstBar - 0.01)).toBe(i + 1);
    expect(layerAt(firstBar + 0.01)).toBe(i + 2);
  });
});

test('the opening is calm and the layers build gently', () => {
  expect(instrumentsIn(1)).toEqual(['bass', 'pad']);
  expect(instrumentsIn(2)).toEqual(['bass', 'kick', 'pad']);
  expect(instrumentsIn(3)).toEqual(['bass', 'kick', 'pad', 'shaker']);
});
