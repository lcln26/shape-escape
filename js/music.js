import { BEAT } from "./config.js";

// The soundtrack: a 128 BPM loop in A minor (Am - F - C - G, one bar each)
// that adds a layer at each of LAYER_TIMES, so the music builds as the run
// gets harder. Pure data and functions here; js/audio.js plays it.

export const STEP = BEAT / 4; // sixteenth note
export const STEPS_PER_BAR = 16;
export const BAR = STEP * STEPS_PER_BAR;

// Run time (s) at which each layer joins, applied from the next bar line:
// 0 kick + hats, 1 bass, 2 claps, 3 arpeggio, 4 pads.
export const LAYER_TIMES = [0, 15, 30, 45, 75];

// MIDI note numbers. Chord tones sit around A3; bass roots around A1.
const CHORDS = [
  { root: 33, tones: [57, 60, 64] }, // Am
  { root: 29, tones: [53, 57, 60] }, // F
  { root: 36, tones: [48, 52, 55] }, // C
  { root: 31, tones: [55, 59, 62] }, // G
];

// Number of layers playing at run time t (changes only on bar lines).
export function layerAt(t) {
  const barStart = Math.floor(t / BAR + 1e-9) * BAR;
  return LAYER_TIMES.filter(start => barStart >= start).length;
}

export function chordAt(t) {
  return CHORDS[Math.floor(t / BAR + 1e-9) % CHORDS.length];
}

// Catch sounds climb through the current chord as the combo grows, so a
// streak plays an ascending arpeggio in key with the music.
export function catchNote(t, comboCount) {
  const { tones } = chordAt(t);
  const i = Math.min(comboCount, 8);
  return tones[i % 3] + 12 * (1 + Math.floor(i / 3));
}

// The notes to play on sixteenth `step` with `layers` layers active, as
// { instrument, note } (note only for pitched instruments).
export function stepEvents(step, layers) {
  const s = step % STEPS_PER_BAR;
  const { root, tones } = CHORDS[Math.floor(step / STEPS_PER_BAR) % CHORDS.length];
  const events = [];
  if (s % 4 === 0) events.push({ instrument: 'kick' });
  if (s % 4 === 2) events.push({ instrument: 'hat' });
  if (layers >= 2 && s % 4 === 2) events.push({ instrument: 'bass', note: s === 14 ? root + 12 : root });
  if (layers >= 3 && (s === 4 || s === 12)) events.push({ instrument: 'clap' });
  if (layers >= 4 && s % 2 === 0) {
    const order = [0, 1, 2, 1];
    events.push({ instrument: 'arp', note: tones[order[(s / 2) % 4]] + 12 * (s >= 8 ? 1 : 0) });
  }
  if (layers >= 5 && s === 0) tones.forEach(note => events.push({ instrument: 'pad', note }));
  return events;
}
