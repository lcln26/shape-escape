// Spreads a late frame's time over the next few frames instead of jumping.
//
// Browsers occasionally miss a screen refresh even on an empty page. Stepping
// the game by the full gap makes everything jump (at 650px/s, a 25ms hitch is
// a ~16px leap), which reads as stutter. Instead, each frame advances by at
// most MAX_CATCH_UP times the normal interval and carries the rest forward,
// so the game catches up within a few frames: it never falls behind real time
// for long, it just doesn't lurch.
const MAX_CATCH_UP = 1.5;

export class FramePacer {
  constructor(maxStep) {
    this.maxStep = maxStep; // cap for long stalls (e.g. switching tabs)
    this.debt = 0;
  }

  // gap: seconds since the last frame; interval: the display's normal frame
  // interval in seconds. Returns how far to advance the game this frame.
  step(gap, interval) {
    this.debt = Math.min(this.debt + Math.max(gap, 0), this.maxStep);
    const step = Math.min(this.debt, interval * MAX_CATCH_UP);
    this.debt -= step;
    return step;
  }
}
