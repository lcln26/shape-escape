import { BAR, STEPS_PER_BAR, LAYER_TIMES, layerAt, stepEvents, catchNote, chordAt } from '../js/music.js';

const instrumentsIn = (layers) => {
  const names = new Set();
  for (let step = 0; step < STEPS_PER_BAR * 4; step++) stepEvents(step, layers).forEach(e => names.add(e.instrument));
  return [...names].sort();
};

test('layers join on bar lines, never mid-bar', () => {
  expect(layerAt(0)).toBe(1);
  for (const start of LAYER_TIMES.slice(1)) {
    const firstBar = Math.ceil(start / BAR - 1e-9) * BAR;
    const index = LAYER_TIMES.indexOf(start) + 1;
    expect(layerAt(firstBar - 0.01)).toBe(index - 1);
    expect(layerAt(firstBar + 0.01)).toBe(index);
  }
});

test('each layer adds an instrument', () => {
  expect(instrumentsIn(1)).toEqual(['hat', 'kick']);
  expect(instrumentsIn(2)).toEqual(['bass', 'hat', 'kick']);
  expect(instrumentsIn(3)).toEqual(['bass', 'clap', 'hat', 'kick']);
  expect(instrumentsIn(4)).toEqual(['arp', 'bass', 'clap', 'hat', 'kick']);
  expect(instrumentsIn(5)).toEqual(['arp', 'bass', 'clap', 'hat', 'kick', 'pad']);
});

test('the kick lands on every beat', () => {
  for (let step = 0; step < STEPS_PER_BAR; step++) {
    const hasKick = stepEvents(step, 1).some(e => e.instrument === 'kick');
    expect(hasKick).toBe(step % 4 === 0);
  }
});

test('catch notes climb with the combo and stay in the current chord', () => {
  const t = 0;
  const notes = Array.from({ length: 9 }, (_, combo) => catchNote(t, combo));
  for (let i = 1; i < notes.length; i++) expect(notes[i]).toBeGreaterThan(notes[i - 1]);
  const pitchClasses = new Set(chordAt(t).tones.map(n => n % 12));
  notes.forEach(n => expect(pitchClasses.has(n % 12)).toBe(true));
});
