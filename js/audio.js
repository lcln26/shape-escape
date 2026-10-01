import { GAME_WIDTH } from "./config.js";
import { STEP, stepEvents, layerAt, catchNote, MELODY } from "./music.js";

// Audio engine: a soft, warm soundtrack plus one voice per shape, all
// synthesised in code. Every sound is rendered once into a sample when audio
// is unlocked (one per note it needs), then each play is a single buffer
// source. A shared reverb and a gentle compressor glue everything together.
//
// Sound design rules, since this can't be judged by ear in development:
//   - only soft waveforms (sine, triangle, a plucked-string model); no
//     square or sawtooth waves and no bright noise
//   - every pitch comes from one pentatonic scale (js/music.js), and catch
//     melodies stay between A4 and D6
//   - the music sits under the catches in the mix
//
// Browsers only allow audio after a user gesture, so the context is created
// by unlock(), which input calls on the first key press or tap.

const SAMPLE_RATE = 44100;
const SCHEDULE_AHEAD = 0.12; // seconds of music queued ahead of the clock
const MAX_DRIFT = 0.03; // re-sync music to the game if they drift further apart
const MASTER_LEVEL = 0.6;
const OPEN_FILTER = 18000;

// Which voice each shape sings with.
export const SHAPE_VOICES = { circle: 'bell', square: 'marimba', triangle: 'pluck' };

// Level and reverb send for each bus.
const BUSES = {
  pad: { level: 0.14, send: 0.6, music: true },
  bass: { level: 0.4, send: 0.05, music: true },
  kick: { level: 0.45, send: 0, music: true },
  shaker: { level: 0.12, send: 0.15, music: true },
  voice: { level: 0.7, send: 0.35 },
  sfx: { level: 0.55, send: 0.25 },
};

const midiToFreq = (note) => 440 * Math.pow(2, (note - 69) / 12);

// ---- Sample recipes ----
// Offline recipes get (ctx, out) and build a node graph; direct recipes
// write samples straight into a Float32Array.

function envelope(ctx, { start = 0, attack = 0.005, peak = 1, hold = 0, decay }) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  if (hold) gain.gain.setValueAtTime(peak, start + attack + hold);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + hold + decay);
  return gain;
}

function partial(ctx, out, { type = 'sine', freq, endFreq = freq, glide, start = 0, attack, peak, hold, decay, detune = 0 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + (glide || decay));
  osc.connect(envelope(ctx, { start, attack, peak, hold, decay })).connect(out);
  osc.start(start);
  osc.stop(start + (attack || 0.005) + (hold || 0) + decay + 0.02);
}

function softNoise(ctx, out, { start = 0, freq, q = 0.7, attack, peak, decay }) {
  const seconds = (attack || 0.005) + decay + 0.02;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  src.connect(filter).connect(envelope(ctx, { start, attack, peak, decay })).connect(out);
  src.start(start);
}

function lowpass(ctx, out, freq) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  filter.connect(out);
  return filter;
}

// Karplus-Strong plucked string: a short burst of softened noise fed through
// a decaying delay line. Naturally harmonic and warm.
function pluckString(data, sampleRate, freq) {
  const period = Math.round(sampleRate / freq);
  const line = new Float32Array(period);
  let prev = 0;
  for (let i = 0; i < period; i++) {
    prev = prev * 0.6 + (Math.random() * 2 - 1) * 0.4; // softened excitation
    line[i] = prev;
  }
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const j = i % period;
    const value = line[j];
    line[j] = 0.996 * 0.5 * (value + last);
    last = value;
    data[i] = value;
  }
  // Short fade-in removes the click of the noise burst; fade-out at the end.
  const fadeIn = Math.floor(sampleRate * 0.003), fadeOut = Math.floor(sampleRate * 0.1);
  for (let i = 0; i < fadeIn; i++) data[i] *= i / fadeIn;
  for (let i = 0; i < fadeOut; i++) data[data.length - 1 - i] *= i / fadeOut;
  // Higher notes lose energy faster in the delay line; even out the level.
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < data.length; i++) data[i] *= 0.65 / peak;
}

const VOICE_RECIPES = {
  // Circle: a soft bell (harmonic partials, higher ones fading faster).
  bell: (note) => [1.8, (c, o) => {
    const f = midiToFreq(note);
    partial(c, o, { freq: f, attack: 0.004, peak: 0.6, decay: 1.7 });
    partial(c, o, { freq: f * 2, attack: 0.004, peak: 0.18, decay: 0.6 });
    partial(c, o, { freq: f * 3, attack: 0.004, peak: 0.06, decay: 0.25 });
  }],
  // Square: a wooden marimba (fundamental plus the bar's 4th-harmonic knock).
  marimba: (note) => [0.9, (c, o) => {
    const f = midiToFreq(note);
    partial(c, o, { freq: f, attack: 0.003, peak: 0.65, decay: 0.7 });
    partial(c, o, { freq: f * 4, attack: 0.002, peak: 0.12, decay: 0.07 });
  }],
  // Triangle: a plucked string.
  pluck: (note) => [1.4, (data, rate) => pluckString(data, rate, midiToFreq(note)), 'direct'],
};

const MUSIC_RECIPES = {
  pad: (note) => [2.6, (c, o) => {
    const f = midiToFreq(note);
    const lp = lowpass(c, o, 1400);
    partial(c, lp, { freq: f, attack: 0.6, peak: 0.5, hold: 0.9, decay: 1.0 });
    partial(c, lp, { type: 'triangle', freq: f, detune: -6, attack: 0.7, peak: 0.16, hold: 0.8, decay: 1.0 });
    partial(c, lp, { type: 'triangle', freq: f, detune: 6, attack: 0.7, peak: 0.16, hold: 0.8, decay: 1.0 });
  }],
  bass: (note) => [0.7, (c, o) => {
    const f = midiToFreq(note);
    const lp = lowpass(c, o, 500);
    partial(c, lp, { freq: f, attack: 0.01, peak: 0.8, decay: 0.6 });
    partial(c, lp, { type: 'triangle', freq: f, attack: 0.01, peak: 0.2, decay: 0.35 });
  }],
  kick: () => [0.4, (c, o) => partial(c, lowpass(c, o, 220), { freq: 110, endFreq: 46, glide: 0.12, attack: 0.003, peak: 0.9, decay: 0.32 })],
  shaker: () => [0.1, (c, o) => softNoise(c, o, { freq: 6000, q: 0.8, attack: 0.008, peak: 0.5, decay: 0.06 })],
};

const SFX_RECIPES = {
  // A small rising step (C5 to E5): soft, since it happens constantly.
  morph: [0.12, (c, o) => partial(c, o, { freq: 523, endFreq: 659, glide: 0.06, attack: 0.005, peak: 0.25, decay: 0.08 })],
  dash: [0.25, (c, o) => softNoise(c, o, { freq: 900, q: 0.6, attack: 0.03, peak: 0.6, decay: 0.16 })],
  wrongShape: [0.6, (c, o) => {
    partial(c, o, { freq: 160, endFreq: 55, glide: 0.35, attack: 0.004, peak: 0.8, decay: 0.45 });
    softNoise(c, lowpass(c, o, 400), { freq: 200, q: 0.5, attack: 0.002, peak: 0.6, decay: 0.15 });
  }],
  // A gentle falling phrase in key: A5 E5 C5 A4.
  outOfEnergy: [1.6, (c, o) => {
    [81, 76, 72, 69].forEach((note, i) => partial(c, o, { freq: midiToFreq(note), start: i * 0.16, attack: 0.004, peak: 0.4, decay: 0.8 }));
  }],
  // A quick rising arpeggio: A4 C5 E5 A5.
  shieldUp: [0.9, (c, o) => {
    [69, 72, 76, 81].forEach((note, i) => partial(c, o, { freq: midiToFreq(note), start: i * 0.05, attack: 0.003, peak: 0.3, decay: 0.5 }));
  }],
  shieldBreak: [0.8, (c, o) => {
    [76, 72, 69].forEach((note, i) => partial(c, o, { freq: midiToFreq(note), start: i * 0.04, attack: 0.002, peak: 0.3, decay: 0.35 }));
    softNoise(c, o, { freq: 3000, q: 0.5, attack: 0.002, peak: 0.25, decay: 0.2 });
  }],
  // Low energy: a soft heartbeat instead of a beep.
  lowEnergy: [0.5, (c, o) => {
    const lp = lowpass(c, o, 150);
    partial(c, lp, { freq: 60, endFreq: 45, attack: 0.005, peak: 0.9, decay: 0.12 });
    partial(c, lp, { freq: 55, endFreq: 42, start: 0.17, attack: 0.005, peak: 0.6, decay: 0.12 });
  }],
  // A slow C major arpeggio: C5 E5 G5 C6.
  achievement: [1.8, (c, o) => {
    [72, 76, 79, 84].forEach((note, i) => partial(c, o, { freq: midiToFreq(note), start: i * 0.09, attack: 0.004, peak: 0.3, decay: 1.0 }));
  }],
};

// Every sample the engine needs, keyed "name" or "name:note".
export function sampleList() {
  const list = [];
  for (const [voice, recipe] of Object.entries(VOICE_RECIPES)) {
    for (const note of MELODY) list.push([`${voice}:${note}`, recipe(note)]);
  }
  const musicNotes = { pad: new Set(), bass: new Set() };
  for (let step = 0; step < 16 * 4; step++) {
    for (const e of stepEvents(step, 99)) if (musicNotes[e.instrument]) musicNotes[e.instrument].add(e.note);
    for (const e of stepEvents(step, 1)) if (musicNotes[e.instrument]) musicNotes[e.instrument].add(e.note);
  }
  for (const [name, notes] of Object.entries(musicNotes)) {
    for (const note of notes) list.push([`${name}:${note}`, MUSIC_RECIPES[name](note)]);
  }
  list.push(['kick', MUSIC_RECIPES.kick()], ['shaker', MUSIC_RECIPES.shaker()]);
  for (const [name, recipe] of Object.entries(SFX_RECIPES)) list.push([name, recipe]);
  return list;
}

export async function renderSample([seconds, recipe, kind]) {
  const length = Math.ceil(SAMPLE_RATE * seconds);
  if (kind === 'direct') {
    const buffer = new AudioBuffer({ length, sampleRate: SAMPLE_RATE, numberOfChannels: 1 });
    recipe(buffer.getChannelData(0), SAMPLE_RATE);
    return buffer;
  }
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OfflineCtx(1, length, SAMPLE_RATE);
  recipe(ctx, ctx.destination);
  return ctx.startRendering();
}

// A synthetic room: stereo noise with an exponential tail that darkens as
// it decays.
function reverbImpulse(ctx, seconds = 2.4) {
  const length = Math.ceil(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const t = i / ctx.sampleRate;
      const darkness = Math.min(0.9, 0.2 + t * 0.4);
      smooth = smooth * darkness + (Math.random() * 2 - 1) * (1 - darkness);
      data[i] = smooth * Math.exp(-t / 0.55);
    }
  }
  return impulse;
}

export class Sfx {
  constructor() {
    this.ctx = null;
    this.samples = null; // filled once rendering finishes
    this.musicOn = false;
    this.muted = this.load('muted');
    this.musicMuted = this.load('musicMuted');
  }

  load(key) {
    try {
      return localStorage.getItem(key) === 'true';
    } catch {
      return false;
    }
  }

  save(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable (e.g. private mode); the setting still applies for this visit.
    }
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = this.ctx = new AudioCtx();
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 12;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.2;
      compressor.connect(ctx.destination);
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_LEVEL;
      this.master.connect(compressor);
      const reverb = ctx.createConvolver();
      reverb.buffer = reverbImpulse(ctx);
      const reverbReturn = ctx.createGain();
      reverbReturn.gain.value = 0.35;
      reverb.connect(reverbReturn).connect(this.master);
      // Music has a dry path and a reverb path. Both can be muted together
      // (the music toggle) and both pass through a filter so a run's end can
      // sweep the music closed.
      const musicPath = (destination) => {
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = OPEN_FILTER;
        gain.connect(filter).connect(destination);
        return { gain, filter };
      };
      this.musicDry = musicPath(this.master);
      this.musicWet = musicPath(reverb);
      this.setMusicLevel();
      this.buses = {};
      for (const [name, { level, send, music }] of Object.entries(BUSES)) {
        const bus = ctx.createGain();
        bus.gain.value = level;
        bus.connect(music ? this.musicDry.gain : this.master);
        if (send) {
          const sendGain = ctx.createGain();
          sendGain.gain.value = send;
          bus.connect(sendGain).connect(music ? this.musicWet.gain : reverb);
        }
        this.buses[name] = bus;
      }
      Promise.all(sampleList().map(async ([key, recipe]) => [key, await renderSample(recipe)]))
        .then(entries => { this.samples = Object.fromEntries(entries); })
        .catch(() => { this.samples = null; });
    }
    if (this.ctx.state === 'suspended' && !this.paused) this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    this.save('muted', this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_LEVEL;
  }

  toggleMusic() {
    this.musicMuted = !this.musicMuted;
    this.save('musicMuted', this.musicMuted);
    this.setMusicLevel();
  }

  setMusicLevel() {
    if (!this.musicDry) return;
    for (const path of [this.musicDry, this.musicWet]) path.gain.gain.value = this.musicMuted ? 0 : 1;
  }

  sweepMusicFilter(fn) {
    const now = this.ctx.currentTime;
    for (const { filter } of [this.musicDry, this.musicWet]) {
      filter.frequency.cancelScheduledValues(now);
      fn(filter.frequency, now);
    }
  }

  // Plays sample `key` at audio time `when` (0 = now), panned -1..1.
  play(key, { when = 0, bus = 'sfx', pan = 0 } = {}) {
    if (!this.samples || !this.samples[key]) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.samples[key];
    let out = this.buses[bus];
    if (pan && this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = pan;
      panner.connect(out);
      out = panner;
    }
    src.connect(out);
    src.start(when);
  }

  // ---- Music ----

  startMusic() {
    if (!this.ctx) return;
    this.musicOn = true;
    this.songStart = null; // set on the first update, once samples are ready
    this.sweepMusicFilter((freq, now) => freq.setValueAtTime(OPEN_FILTER, now));
  }

  // Ends the music by sweeping the filter closed, like the room going quiet.
  stopMusic() {
    if (!this.ctx || !this.musicOn) return;
    this.musicOn = false;
    this.sweepMusicFilter((freq, now) => {
      freq.setValueAtTime(freq.value, now);
      freq.exponentialRampToValueAtTime(120, now + 0.9);
    });
  }

  // Called every frame with the run time; queues the next notes. The game's
  // run time is the master clock: music follows it, re-syncing if a long
  // stall pulls them apart. There's deliberately no output-latency
  // compensation: catch sounds can't be played early, so music and catches
  // both play "now" and stay in time with each other.
  updateMusic(runTime) {
    if (!this.musicOn || !this.samples || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const target = now - runTime;
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
          this.play(note === undefined ? instrument : `${instrument}:${note}`, { when, bus: instrument });
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

  // Each shape sings with its own voice; a streak climbs the scale. Panned
  // by where on screen the catch happened.
  catch(comboCount, runTime, shape = 'circle', x = GAME_WIDTH / 2) {
    const note = catchNote(runTime, comboCount);
    this.play(`${SHAPE_VOICES[shape]}:${note}`, { bus: 'voice', pan: (x / GAME_WIDTH * 2 - 1) * 0.6 });
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
