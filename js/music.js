import { BEAT } from "./config.js";

// The soundtrack is a calm, warm bed; the player's catches are the melody.
// Every pitch in the game (chords, bass and catch notes) comes from one
// pentatonic scale, so any catch sounds right over any chord. Pure data and
// functions here; js/audio.js plays them.

export const STEP = BEAT / 4; // sixteenth note
export const STEPS_PER_BAR = 16;
export const BAR = STEP * STEPS_PER_BAR;

// A minor pentatonic (= C major pentatonic): A C D E G.
export const SCALE = [9, 0, 2, 4, 7]; // pitch classes

// Four-bar progression, all built from scale notes only. MIDI numbers:
// bass around A1-D2, pad voicings around A3.
const PROGRESSION = [
  { bass: 33, pad: [57, 60, 64, 67] }, // Am7      A C E G
  { bass: 36, pad: [55, 60, 64, 69] }, // C6       G C E A
  { bass: 38, pad: [57, 62, 67, 72] }, // D7sus4   A D G C
  { bass: 31, pad: [55, 62, 64, 69] }, // Gsus     G D E A
];

// Run time (s) when each layer joins, applied from the next bar line. The
// opening is just pads and a soft low pulse; it builds gently from there.
//   1 pads + bass on beats 1 and 3   2 soft kick on every beat
//   3 shaker on the off-beats         4 bass moves to eighth notes
export const LAYER_TIMES = [0, 20, 40, 70];

export function layerAt(t) {
  const barStart = Math.floor(t / BAR + 1e-9) * BAR;
  return LAYER_TIMES.filter(start => barStart >= start).length;
}

export function chordAt(t) {
  return PROGRESSION[Math.floor(t / BAR + 1e-9) % PROGRESSION.length];
}

// The catch melody: scale notes from A4 up to D6, so it never gets shrill.
export const MELODY = [69, 72, 74, 76, 79, 81, 84, 86];

// A streak climbs the scale one note per catch; a fresh catch starts on the
// scale note nearest the current chord's root, so phrases follow the chords.
export function catchNote(t, comboCount) {
  const rootClass = chordAt(t).bass % 12;
  const start = MELODY.findIndex(n => n % 12 === rootClass);
  return MELODY[Math.min(Math.max(start, 0) + comboCount, MELODY.length - 1)];
}

// The notes for sixteenth `step` with `layers` layers active, as
// { instrument, note } (note only for pitched instruments).
export function stepEvents(step, layers) {
  const s = step % STEPS_PER_BAR;
  const chord = PROGRESSION[Math.floor(step / STEPS_PER_BAR) % PROGRESSION.length];
  const events = [];
  if (s === 0) chord.pad.forEach(note => events.push({ instrument: 'pad', note }));
  const bassOnEighths = layers >= 4;
  if (s === 0 || s === 8 || (bassOnEighths && s % 2 === 0)) {
    events.push({ instrument: 'bass', note: chord.bass + (bassOnEighths && s % 4 === 2 ? 12 : 0) });
  }
  if (layers >= 2 && s % 4 === 0) events.push({ instrument: 'kick' });
  if (layers >= 3 && s % 4 === 2) events.push({ instrument: 'shaker' });
  return events;
}
