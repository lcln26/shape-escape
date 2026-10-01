import { GAME_WIDTH } from "./config.js";

// Debug overlay (toggle with the ` key) showing how smoothly frames arrive.
// "worst" is the longest gap between frames in the last second, and "work"
// is the average time spent in update+draw; if work approaches the frame
// interval (8.3ms at 120Hz, 16.7ms at 60Hz) frames start getting dropped.
export class FrameMeter {
  constructor() {
    this.visible = false;
    this.windowStart = performance.now();
    this.frames = 0;
    this.worstGap = 0;
    this.workTotal = 0;
    this.text = '';
  }
  toggle() {
    this.visible = !this.visible;
  }
  record(now, gapMs, workMs) {
    this.frames++;
    this.worstGap = Math.max(this.worstGap, gapMs);
    this.workTotal += workMs;
    if (now - this.windowStart >= 1000) {
      const fps = this.frames * 1000 / (now - this.windowStart);
      const work = this.workTotal / this.frames;
      this.text = `${Math.round(fps)} fps · worst ${this.worstGap.toFixed(1)}ms · work ${work.toFixed(1)}ms`;
      this.windowStart = now;
      this.frames = 0;
      this.worstGap = 0;
      this.workTotal = 0;
    }
  }
  draw(ctx) {
    if (!this.visible || !this.text) return;
    // Top-right, under the shield timer.
    ctx.font = '14px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(GAME_WIDTH - 330, 36, 324, 20);
    ctx.fillStyle = '#0f0';
    ctx.fillText(this.text, GAME_WIDTH - 10, 39);
  }
}
