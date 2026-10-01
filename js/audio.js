// Sound effects synthesised with the Web Audio API, so there are no audio
// files to load. Browsers only allow audio after a user gesture, so the
// context is created lazily by unlock(), which the game calls on keydown.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
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
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // One second of white noise, reused for every noisy sound.
      this.noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem('muted', this.muted);
    } catch {
      // Storage can be unavailable (e.g. private mode); muting still works for this visit.
    }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  }

  // A pitched blip that slides from freq to endFreq with a quick fade out.
  tone({ freq, endFreq = freq, duration = 0.1, type = 'sine', volume = 0.2, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration);
  }

  // Filtered noise, for whooshes and crunches.
  noise({ duration = 0.2, volume = 0.2, filter = 'lowpass', freq = 1000, endFreq = freq }) {
    if (!this.ctx || this.muted) return;
    const start = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const biquad = this.ctx.createBiquadFilter();
    biquad.type = filter;
    biquad.frequency.setValueAtTime(freq, start);
    biquad.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    src.connect(biquad).connect(gain).connect(this.master);
    src.start(start);
    src.stop(start + duration);
  }

  // Rises a semitone per combo step so a long streak climbs audibly.
  catch(comboCount) {
    const freq = 440 * Math.pow(2, Math.min(comboCount, 16) / 12);
    this.tone({ freq, endFreq: freq * 1.5, duration: 0.12, type: 'triangle', volume: 0.25 });
    this.tone({ freq: freq * 2, duration: 0.08, type: 'sine', volume: 0.08 });
  }

  morph() {
    this.tone({ freq: 600, endFreq: 900, duration: 0.05, volume: 0.05 });
  }

  dash() {
    this.noise({ duration: 0.18, volume: 0.15, filter: 'bandpass', freq: 2500, endFreq: 400 });
  }

  wrongShape() {
    this.tone({ freq: 200, endFreq: 50, duration: 0.45, type: 'sawtooth', volume: 0.25 });
    this.noise({ duration: 0.35, volume: 0.3, freq: 800, endFreq: 100 });
  }

  outOfEnergy() {
    this.tone({ freq: 440, endFreq: 60, duration: 0.8, type: 'triangle', volume: 0.3 });
  }

  shieldUp() {
    [523, 659, 784].forEach((freq, i) =>
      this.tone({ freq, duration: 0.12, type: 'triangle', volume: 0.18, delay: i * 0.06 }));
  }

  shieldBreak() {
    this.noise({ duration: 0.25, volume: 0.25, filter: 'highpass', freq: 3000, endFreq: 800 });
    this.tone({ freq: 900, endFreq: 250, duration: 0.2, type: 'square', volume: 0.1 });
  }

  lowEnergy() {
    this.tone({ freq: 880, duration: 0.06, type: 'square', volume: 0.05 });
  }

  achievement() {
    this.tone({ freq: 784, duration: 0.12, type: 'triangle', volume: 0.2 });
    this.tone({ freq: 1047, duration: 0.25, type: 'triangle', volume: 0.2, delay: 0.1 });
  }
}
