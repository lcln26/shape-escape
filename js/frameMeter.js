import { GAME_WIDTH, HUD_HEIGHT } from "./config.js";

const HISTORY = 240; // frames shown in the graph (2s at 120Hz)

// Debug overlay (toggle with the ` key) for diagnosing stutter.
//   fps        frames per second over the last second
//   worst      longest gap between two frames in the last second
//   slow       frames in the last second that took 1.5x+ the usual interval,
//              i.e. at least one refresh was missed
//   max work   longest time this game's own code (update + draw) took in a
//              single frame
// If "worst" spikes while "max work" stays small, the delay is outside the
// game: the browser, the GPU, or the system. The graph shows recent frame
// gaps; red bars are slow frames.
export class FrameMeter {
  constructor() {
    this.visible = false;
    this.gaps = [];
    this.windowStart = performance.now();
    this.frames = 0;
    this.worstGap = 0;
    this.maxWork = 0;
    this.slow = 0;
    this.interval = 1000 / 60; // refined from the measured frame rate
    this.text = '';
  }
  toggle() {
    this.visible = !this.visible;
  }
  record(now, gapMs, workMs) {
    this.frames++;
    this.worstGap = Math.max(this.worstGap, gapMs);
    this.maxWork = Math.max(this.maxWork, workMs);
    if (gapMs > this.interval * 1.5) this.slow++;
    this.gaps.push(gapMs);
    if (this.gaps.length > HISTORY) this.gaps.shift();
    if (now - this.windowStart >= 1000) {
      const fps = this.frames * 1000 / (now - this.windowStart);
      // Snap to the nearest common refresh rate so a bad second doesn't
      // redefine "normal".
      const refresh = [60, 90, 120, 144, 165, 240].reduce((a, b) => Math.abs(b - fps) < Math.abs(a - fps) ? b : a);
      this.interval = 1000 / refresh;
      this.text = `${Math.round(fps)} fps · worst ${this.worstGap.toFixed(1)}ms · slow ${this.slow} · max work ${this.maxWork.toFixed(1)}ms`;
      this.windowStart = now;
      this.frames = 0;
      this.worstGap = 0;
      this.maxWork = 0;
      this.slow = 0;
    }
  }
  draw(ctx) {
    if (!this.visible || !this.text) return;
    // Top-right, just under the HUD strip.
    const width = 420, x = GAME_WIDTH - width - 6, y = HUD_HEIGHT + 4;
    const graphTop = y + 24, graphHeight = 40;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, width, 24 + graphHeight + 6);
    ctx.font = '13px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#0f0';
    ctx.fillText(this.text, GAME_WIDTH - 12, y + 6);
    // Bars scaled so 3 refresh intervals fill the graph; taller is worse.
    const barWidth = (width - 12) / HISTORY;
    const scale = graphHeight / (this.interval * 3);
    this.gaps.forEach((gap, i) => {
      const h = Math.min(graphHeight, gap * scale);
      ctx.fillStyle = gap > this.interval * 1.5 ? '#e74c3c' : '#2ecc71';
      ctx.fillRect(x + 6 + i * barWidth, graphTop + graphHeight - h, Math.max(1, barWidth - 0.5), h);
    });
    // Line marking one refresh interval.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillRect(x + 6, graphTop + graphHeight - this.interval * scale, width - 12, 1);
  }
}
