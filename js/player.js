import { GAME_WIDTH, PLAYER_Y, MOVE_SPEED, DASH_SPEED, MORPH_SCALE_DECAY, DASH_DURATION, SHAPE_COLORS } from "./config.js";
import { drawShield, shapeOutline, blendOutlines, traceOutline, mixColor } from "./utils.js";

// How long the visible morph between shapes takes. Gameplay switches shape
// instantly; only the drawing blends.
const MORPH_TIME = 0.12;

export class Player {
  constructor(game) {
    this.game = game;
    this.x = GAME_WIDTH / 2;
    this.y = PLAYER_Y;
    this.size = 50;
    this.shape = 'circle';
    this.morphScale = 1;
    this.morphFrom = null;
    this.morphT = MORPH_TIME;
    this.isDashing = false;
    this.dashTime = 0;
    this.dashDirection = 0;
    this.lastDirection = 1;
  }
  
  // Switches shape now (for catching and collisions) and starts the visible
  // morph from whatever outline is on screen, even mid-morph.
  morphTo(shape) {
    this.morphFrom = this.outline();
    this.morphFromColor = this.color();
    this.shape = shape;
    this.morphT = 0;
    this.morphScale = 1.12;
  }

  // 0 at the start of a morph, 1 once it's finished (eased).
  morphProgress() {
    if (!this.morphFrom || this.morphT >= MORPH_TIME) return 1;
    return 1 - Math.pow(1 - this.morphT / MORPH_TIME, 3);
  }

  // The outline and colour to draw: the current shape's, or a blend while morphing.
  outline() {
    const target = shapeOutline(this.shape, this.size);
    const t = this.morphProgress();
    return t >= 1 ? target : blendOutlines(this.morphFrom, target, t);
  }

  color() {
    const t = this.morphProgress();
    return t >= 1 ? SHAPE_COLORS[this.shape] : mixColor(this.morphFromColor, SHAPE_COLORS[this.shape], t);
  }

  update(dt, keys) {
  this.morphT += dt;
  if (this.isDashing) {
    this.x += DASH_SPEED * this.dashDirection * dt;
    this.dashTime -= dt;
    if (this.dashTime <= 0) {
      this.isDashing = false;
    }
  } else {
    if (keys.left) this.x -= MOVE_SPEED * dt;
    if (keys.right) this.x += MOVE_SPEED * dt;
  }
  // Screen wrapping: add or subtract GAME_WIDTH if out of bounds.
  if (this.x < 0) {
    this.x += GAME_WIDTH;
  } else if (this.x > GAME_WIDTH) {
    this.x -= GAME_WIDTH;
  }
  // Morph scale decay.
  if (this.morphScale > 1) {
    this.morphScale -= MORPH_SCALE_DECAY * dt;
    if (this.morphScale < 1) this.morphScale = 1;
  }
}


  // Horizontal offsets the player occupies: just 0, plus a copy on the far
  // side while straddling a screen edge so wrapping looks and collides right.
  getWrapOffsets() {
    const reach = this.size;
    const offsets = [0];
    if (this.x < reach) offsets.push(GAME_WIDTH);
    if (this.x > GAME_WIDTH - reach) offsets.push(-GAME_WIDTH);
    return offsets;
  }

  // pulse: 0-1, peaks on each beat.
  draw(ctx, shieldActive, pulse = 0, glow = true) {
    for (const offset of this.getWrapOffsets()) {
      ctx.save();
      ctx.translate(this.x + offset, this.y);
      ctx.scale(this.morphScale, this.morphScale);
      const color = this.color();
      traceOutline(ctx, this.outline());
      if (glow) {
        ctx.lineWidth = 12 + 14 * pulse;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.22;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff';
      ctx.fill();
      ctx.stroke();
      if (shieldActive) {
        drawShield(ctx, this.shape, this.size, 6);
      }
      ctx.restore();
    }
  }
}
