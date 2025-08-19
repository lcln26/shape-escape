import { GAME_HEIGHT, GAME_WIDTH } from "./config.js";

// Star now supports parallax layers and optional shooting star behaviour.
export class Star {
  constructor(x, y, size, speed, depth = 1, speedMultiplier = 1, color = '#fff') {
    this.x = x;
    this.y = y;
    this.size = size;
    this.speed = speed; // base vertical speed
    this.depth = depth; // 0..1, affects size/alpha
    this.speedMultiplier = speedMultiplier;
    this.color = color;
    this.vx = 0; // horizontal velocity (used for shooting stars)
    this.isShooting = false;
  }
  update() {
    this.x += this.vx;
    this.y += this.speed * this.speedMultiplier;
    // Normal stars loop back to the top; shooting stars are removed externally
    if (!this.isShooting && this.y > GAME_HEIGHT) {
      this.y = 0;
      this.x = Math.random() * GAME_WIDTH;
    }
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.3 + 0.7 * this.depth; // deeper layers are dimmer
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size * this.depth, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Activate shooting star behaviour with given velocities and optional color.
  shoot(vx, vy, color) {
    this.isShooting = true;
    this.vx = vx;
    this.speed = vy;
    if (color) this.color = color;
  }
}
