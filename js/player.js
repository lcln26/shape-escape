import { GAME_WIDTH, GAME_HEIGHT, MOVE_SPEED, DASH_SPEED, MORPH_SCALE_DECAY, DASH_DURATION } from "./config.js";
import { drawShape, drawShield } from "./utils.js";

export class Player {
  constructor(game) {
    this.game = game;
    this.x = GAME_WIDTH / 2;
    this.y = GAME_HEIGHT - 70;
    this.size = 50;
    this.shape = 'circle';
    this.morphScale = 1;
    this.isDashing = false;
    this.dashTime = 0;
    this.dashDirection = 0;
    this.lastDirection = 1;
  }
  
  update(dt, keys) {
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


  draw(ctx, shieldActive) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.morphScale, this.morphScale);
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#2E86C1';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    drawShape(ctx, this.shape, this.size);
    if (shieldActive) {
      drawShield(ctx, this.shape, this.size, 6);
    }
    ctx.restore();
  }
}
