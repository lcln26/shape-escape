import { SHAPE_COLORS } from "./config.js";
import { drawShape } from "./utils.js";

export class Obstacle {
  constructor(x, y, size, type, shape) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.type = type; // 'normal' or 'powerup'
    this.shape = shape;
  }
  update(dt, speed) {
    this.y += speed * dt;
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
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
  constructor(x, y, size, type, shape) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.type = type;
    this.shape = shape;
    this.timer = 0;
    this.duration = 1.0;
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
