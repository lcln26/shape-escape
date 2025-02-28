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
    ctx.lineWidth = 3;
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 8;
    if (this.type === 'normal') {
      ctx.fillStyle = '#222';
      ctx.strokeStyle = '#fff';
      ctx.save();
      ctx.translate(this.x, this.y);
      drawShape(ctx, this.shape, this.size);
      ctx.restore();
    } else if (this.type === 'powerup') {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      let spikes = 5,
          outerRadius = this.size / 2,
          innerRadius = outerRadius / 2;
      let rot = Math.PI / 2 * 3;
      const cx = this.x, cy = this.y;
      const step = Math.PI / spikes;
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        let x = cx + Math.cos(rot) * outerRadius;
        let y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;
        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }
}
