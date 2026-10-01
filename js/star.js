import { GAME_HEIGHT, GAME_WIDTH } from "./config.js";

export class Star {
  constructor(x, y, size, speed) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.speed = speed;
  }
  update(dt, speedScale = 1) {
    this.y += this.speed * speedScale * dt;
    if (this.y > GAME_HEIGHT) {
      this.y = 0;
      this.x = Math.random() * GAME_WIDTH;
    }
  }
  draw(ctx, pulse = 0) {
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * (1 + 0.4 * pulse), 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
