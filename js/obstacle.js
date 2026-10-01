import { SHAPE_COLORS, PREVIEW_DURATION } from "./config.js";
import { drawShape, drawGlow } from "./utils.js";

// Each falling shape keeps the speed it was released with, so the spawner
// can time it to reach the player exactly on the beat.
export class Obstacle {
  constructor(x, y, size, type, shape, speed) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.type = type; // 'normal' or 'powerup'
    this.shape = shape;
    this.speed = speed;
  }
  update(dt) {
    this.y += this.speed * dt;
  }
  // pulse: 0-1, peaks on each beat.
  draw(ctx, pulse = 0, glow = true) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (glow) drawGlow(ctx, this.shape, this.size, SHAPE_COLORS[this.shape], 8 + 8 * pulse);
    applyShapeStyle(ctx, this.shape, this.type, '');
    drawShape(ctx, this.shape, this.size);
    ctx.restore();
  }
}

// Falling shapes: a tinted fill with a solid outline in the shape's colour, so
// they read as "the same kind of thing" as the solid-filled player without
// being mistaken for it. The power-up star is solid with a white outline.
function applyShapeStyle(ctx, shape, type, strokeOverride) {
  const color = SHAPE_COLORS[shape];
  ctx.lineWidth = 3;
  if (type === 'powerup') {
    ctx.fillStyle = color;
    ctx.strokeStyle = strokeOverride || '#fff';
  } else {
    ctx.fillStyle = color + '4D'; // ~30% alpha
    ctx.strokeStyle = strokeOverride || color;
  }
}

export class ObstaclePreview {
  // startTime: how far into the preview to begin (catching up a late frame).
  constructor(x, y, size, type, shape, startTime = 0) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.type = type;
    this.shape = shape;
    this.timer = startTime;
    this.duration = PREVIEW_DURATION;
    this.alpha = 0;
  }
  update(dt) {
    this.timer += dt;
    this.alpha = Math.min(1, this.timer / this.duration);
    return this.timer >= this.duration;
  }
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.5 * this.alpha;
    const flash = Math.floor(Date.now() / 200) % 2 === 0;
    // Flash the outline so a shape about to drop catches the eye.
    const flashColor = this.type === 'powerup' ? '#00ffff' : '#fff';
    applyShapeStyle(ctx, this.shape, this.type, flash ? flashColor : '');
    ctx.lineWidth = 5;
    ctx.translate(this.x, this.y);
    drawShape(ctx, this.shape, this.size * 1.1);
    ctx.restore();
  }
}
