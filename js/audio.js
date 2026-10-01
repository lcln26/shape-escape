import { STEP, stepEvents, layerAt, catchNote } from "./music.js";

// Audio engine: music and sound effects, all synthesised in code. Each sound
// is rendered once into a sample when audio is unlocked, then every play is
// a single buffer source (pitched with playbackRate). That keeps the work per
// note tiny, which matters for browsers whose audio garbage collection can
// stall the page when many short-lived nodes are created.
//
// Browsers only allow audio after a user gesture, so the context is created
// by unlock(), which input calls on the first key press or tap.

const SAMPLE_RATE = 44100;
const SCHEDULE_AHEAD = 0.12; // seconds of music queued ahead of the clock
const MAX_DRIFT = 0.03; // re-sync music to the game if they drift further apart

// Base pitch (MIDI) each pitched sample was rendered at.
const BASE_NOTE = { bass: 33, arp: 69, pad: 57, pluck: 69 };

// Mix levels.
const BUS_LEVELS = { kick: 0.9, hat: 0.22, clap: 0.4, bass: 0.5, arp: 0.2, pad: 0.16, sfx: 0.7 };

const midiToFreq = (note) => 440 * Math.pow(2, (note - 69) / 12);

// ---- Sample recipes (each runs in an OfflineAudioContext) ----

function noiseSource(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  return src;
}

function envelope(ctx, { start = 0, attack = 0.002, peak = 1, decay }) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  return gain;
}

function tone(ctx, out, { type = 'sine', freq, endFreq = freq, start = 0, attack, peak, decay, detune = 0 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, start);
  osc.frequency.exponentialRampToValueAtTime(endFreq, start + (attack || 0.002) + decay);
  osc.connect(envelope(ctx, { start, attack, peak, decay })).connect(out);
  osc.start(start);
  osc.stop(start + (attack || 0.002) + decay + 0.01);
}

function noise(ctx, out, { filter = 'lowpass', freq, endFreq = freq, q = 1, start = 0, attack, peak, decay }) {
  const src = noiseSource(ctx, (attack || 0.002) + decay + 0.01);
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.Q.value = q;
  biquad.frequency.setValueAtTime(freq, start);
  biquad.frequency.exponentialRampToValueAtTime(endFreq, start + (attack || 0.002) + decay);
  src.connect(biquad).connect(envelope(ctx, { start, attack, peak, decay })).connect(out);
  src.start(start);
}

const RECIPES = {
  kick: [0.45, (c, o) => {
    tone(c, o, { freq: 160, endFreq: 42, decay: 0.42, peak: 1 });
    noise(c, o, { filter: 'highpass', freq: 3000, decay: 0.01, peak: 0.3 });
  }],
  hat: [0.07, (c, o) => noise(c, o, { filter: 'highpass', freq: 8000, decay: 0.06, peak: 0.8 })],
  clap: [0.3, (c, o) => {
    [0, 0.012, 0.024].forEach(start => noise(c, o, { filter: 'bandpass', freq: 1500, q: 1.2, start, decay: start ? 0.012 : 0.25, peak: 0.9 }));
  }],
  bass: [0.32, (c, o) => {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(1100, 0);
    lp.frequency.exponentialRampToValueAtTime(180, 0.28);
    lp.connect(o);
    [-8, 8].forEach(detune => tone(c, lp, { type: 'sawtooth', freq: midiToFreq(BASE_NOTE.bass), detune, decay: 0.3, peak: 0.6 }));
  }],
  arp: [0.3, (c, o) => {
    tone(c, o, { type: 'square', freq: midiToFreq(BASE_NOTE.arp), decay: 0.25, peak: 0.35 });
    tone(c, o, { type: 'triangle', freq: midiToFreq(BASE_NOTE.arp) * 2, decay: 0.15, peak: 0.2 });
  }],
  pad: [2.0, (c, o) => {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1000;
    lp.connect(o);
    [-10, 0, 10].forEach(detune => tone(c, lp, { type: 'sawtooth', freq: midiToFreq(BASE_NOTE.pad), detune, attack: 0.25, decay: 1.7, peak: 0.35 }));
  }],
  pluck: [0.4, (c, o) => {
    tone(c, o, { type: 'triangle', freq: midiToFreq(BASE_NOTE.pluck), decay: 0.35, peak: 0.7 });
    tone(c, o, { type: 'sine', freq: midiToFreq(BASE_NOTE.pluck) * 2, decay: 0.2, peak: 0.25 });
  }],
  morph: [0.07, (c, o) => tone(c, o, { freq: 600, endFreq: 900, decay: 0.05, peak: 0.25 })],
  dash: [0.2, (c, o) => noise(c, o, { filter: 'bandpass', freq: 2500, endFreq: 400, decay: 0.18, peak: 0.5 })],
  wrongShape: [0.5, (c, o) => {
    tone(c, o, { type: 'sawtooth', freq: 200, endFreq: 50, decay: 0.45, peak: 0.5 });
    noise(c, o, { freq: 800, endFreq: 100, decay: 0.35, peak: 0.6 });
  }],
  outOfEnergy: [0.85, (c, o) => tone(c, o, { type: 'triangle', freq: 440, endFreq: 60, decay: 0.8, peak: 0.6 })],
  shieldUp: [0.3, (c, o) => {
    [523, 659, 784].forEach((freq, i) => tone(c, o, { type: 'triangle', freq, start: i * 0.06, decay: 0.12, peak: 0.4 }));
  }],
  shieldBreak: [0.3, (c, o) => {
    noise(c, o, { filter: 'highpass', freq: 3000, endFreq: 800, decay: 0.25, peak: 0.5 });
    tone(c, o, { type: 'square', freq: 900, endFreq: 250, decay: 0.2, peak: 0.2 });
  }],
  lowEnergy: [0.08, (c, o) => tone(c, o, { type: 'square', freq: 880, decay: 0.06, peak: 0.12 })],
  achievement: [0.4, (c, o) => {
    tone(c, o, { type: 'triangle', freq: 784, decay: 0.12, peak: 0.4 });
    tone(c, o, { type: 'triangle', freq: 1047, start: 0.1, decay: 0.25, peak: 0.4 });
  }],
};

async function render([seconds, recipe]) {
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OfflineCtx(1, Math.ceil(SAMPLE_RATE * seconds), SAMPLE_RATE);
  recipe(ctx, ctx.destination);
  return ctx.startRendering();
}

export class Sfx {
  constructor() {
    this.ctx = null;
    this.samples = null; // filled once rendering finishes
    this.musicOn = false;
    try {
      this.muted = localStorage.getItem('muted') === 'true';
    } catch {
      this.muted = false;
    }
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.buses = {};
      for (const [name, level] of Object.entries(BUS_LEVELS)) {
        const bus = this.ctx.createGain();
        bus.gain.value = level;
        bus.connect(name === 'sfx' ? this.master : this.musicBus);
        this.buses[name] = bus;
      }
      Promise.all(Object.entries(RECIPES).map(async ([name, r]) => [name, await render(r)]))
        .then(entries => { this.samples = Object.fromEntries(entries); })
        .catch(() => { this.samples = null; });
    }
    if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('muted', this.muted);
    } catch {
      // Storage can be unavailable (e.g. private mode); muting still works for this visit.
    }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
  }

  // Plays sample `name` at audio time `when` (0 = now), pitched to `note`.
  play(name, { when = 0, note, bus = 'sfx' } = {}) {
    if (!this.samples || !this.samples[name]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.samples[name];
    if (note !== undefined) src.playbackRate.value = Math.pow(2, (note - BASE_NOTE[name]) / 12);
    src.connect(this.buses[bus]);
    src.start(when);
  }

  // ---- Music ----

  startMusic() {
    if (!this.ctx) return;
    this.musicOn = true;
    this.songStart = null; // set on the first update, once samples are ready
    this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicBus.gain.setValueAtTime(1, this.ctx.currentTime);
  }

  stopMusic() {
    if (!this.ctx || !this.musicOn) return;
    this.musicOn = false;
    // Quick fade so notes already queued don't ring on.
    this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
  }

  // Called every frame with the run time; queues the next notes. The game's
  // run time is the master clock: music follows it, re-syncing if a long
  // stall pulls them apart.
  updateMusic(runTime) {
    if (!this.musicOn || !this.samples || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const latency = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    const target = now - runTime - latency;
    if (this.songStart === null || Math.abs(this.songStart - target) > MAX_DRIFT) {
      this.songStart = target;
      this.nextStep = Math.ceil(runTime / STEP);
    }
    while (this.songStart + this.nextStep * STEP < now + SCHEDULE_AHEAD) {
      const songTime = this.nextStep * STEP;
      const when = this.songStart + songTime;
      // A note whose moment has already passed (just after a re-sync) is
      // skipped rather than played late and off the beat.
      if (when >= now) {
        for (const { instrument, note } of stepEvents(this.nextStep, layerAt(songTime))) {
          this.play(instrument, { when, note, bus: instrument });
        }
      }
      this.nextStep++;
    }
  }

  pause() {
    this.paused = true;
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    this.paused = false;
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ---- Sound effects ----

  // In key with the music, climbing as the combo grows.
  catch(comboCount, runTime) {
    this.play('pluck', { note: catchNote(runTime, comboCount) });
  }
  morph() { this.play('morph'); }
  dash() { this.play('dash'); }
  wrongShape() { this.play('wrongShape'); }
  outOfEnergy() { this.play('outOfEnergy'); }
  shieldUp() { this.play('shieldUp'); }
  shieldBreak() { this.play('shieldBreak'); }
  lowEnergy() { this.play('lowEnergy'); }
  achievement() { this.play('achievement'); }
}
