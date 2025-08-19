import { drawShape } from "./utils.js";

export class Obstacle {
  constructor(x, y, size, type, shape, vx = 0, rotationSpeed = 0) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.type = type; // 'normal' or 'powerup'
    this.shape = shape;
    // Horizontal velocity and rotation speed are optional and default to 0.
    this.vx = vx;
    this.rotationSpeed = rotationSpeed;
    this.rotation = 0;
  }
  update(dt, speed) {
    this.y += speed * dt;
    this.x += this.vx * dt;
    this.rotation += this.rotationSpeed * dt;
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
      ctx.rotate(this.rotation);
      drawShape(ctx, this.shape, this.size);
      ctx.restore();
    } else if (this.type === 'powerup') {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd700';
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.beginPath();
      let spikes = 5,
          outerRadius = this.size / 2,
          innerRadius = outerRadius / 2;
      let rot = Math.PI / 2 * 3;
      const step = Math.PI / spikes;
      ctx.moveTo(0, -outerRadius);
      for (let i = 0; i < spikes; i++) {
        let x = Math.cos(rot) * outerRadius;
        let y = Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;
        x = Math.cos(rot) * innerRadius;
        y = Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }
}
