import { GAME_WIDTH, GAME_HEIGHT, MAX_DT, COMBO_RESET_TIME, SHIELD_DURATION, GameStateEnum, DASH_DURATION, RESTART_LOCKOUT, ENERGY_DRAIN, ENERGY_PER_CATCH, ENERGY_LOW, MAX_COMBO_MULTIPLIER, SPEED_CURVE, SPAWN_INTERVAL_CURVE, SHAPE_COLORS, HUD_HEIGHT, HIT_STOP, SHAKE_DEATH, SHAKE_SHIELD_BREAK, SHAKE_DECAY, TOAST_DURATION } from "./config.js";
import { refinedCollisionDetection, interpolate } from "./utils.js";
import { Player } from "./player.js";
import { Obstacle, ObstaclePreview } from "./obstacle.js";
import { Particle } from "./particle.js";
import { Star } from "./star.js";
import { achievements } from "./achievements.js";
import { FrameMeter } from "./frameMeter.js";
import { Sfx } from "./audio.js";
import { drawHUD, drawStartMenu, drawPause, drawGameOver } from "./hud.js";

const MORPH_KEYS = { '1': 'circle', '2': 'square', '3': 'triangle' };
const LOW_ENERGY_BEEP_INTERVAL = 0.5;
const CLOSE_CALL_ENERGY = 0.1;

export class Game {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.state = GameStateEnum.START;
    this.highScore = parseInt(localStorage.getItem('highScore')) || 0;
    this.lastFrameTime = performance.now();
    this.keys = { left: false, right: false };
    this.frameMeter = new FrameMeter();
    this.sfx = new Sfx();

    this.achievements = achievements;
    this.achievementState = JSON.parse(localStorage.getItem('achievements')) || {};
    this.toasts = [];
    this.shake = 0;

    this.obstacles = [];
    this.obstaclePreviews = [];
    this.particles = [];
    this.stars = [];
    this.obstaclePool = [];
    this.particlePool = [];
    this.resetRun();

    // Create starfield (speeds in px/s).
    const starCount = 50;
    for (let i = 0; i < starCount; i++) {
      this.stars.push(new Star(
        Math.random() * GAME_WIDTH,
        Math.random() * GAME_HEIGHT,
        Math.random() * 2 + 1,
        (Math.random() * 0.5 + 0.2) * 60
      ));
    }
    this.bindEvents();
  }

  // Per-run state, shared by the first run and every restart.
  resetRun() {
    this.score = 0;
    this.isNewHighScore = false;
    this.gameOverTimer = 0;
    this.deathReason = '';
    this.energy = 1;
    this.spawnTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.runTime = 0;
    this.hitStop = 0;
    this.lowEnergyBeepTimer = 0;
    this.catches = 0;
    this.closeCalls = 0;
    this.shieldsCollected = 0;
    this.newAchievements = [];
    // Return obstacles and particles to their pools.
    this.obstacles.forEach(obs => this.returnObstacle(obs));
    this.particles.forEach(p => this.returnParticle(p));
    this.obstacles = [];
    this.obstaclePreviews = [];
    this.particles = [];
    this.player = new Player(this);
  }

  // Object pooling methods
  getObstacle(x, y, size, type, shape) {
    if (this.obstaclePool.length > 0) {
      let obs = this.obstaclePool.pop();
      obs.x = x;
      obs.y = y;
      obs.size = size;
      obs.type = type;
      obs.shape = shape;
      return obs;
    } else {
      return new Obstacle(x, y, size, type, shape);
    }
  }
  returnObstacle(obs) {
    this.obstaclePool.push(obs);
  }
  getParticle(x, y, vx, vy, size, color) {
    if (this.particlePool.length > 0) {
      let p = this.particlePool.pop();
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.size = size;
      p.color = color;
      p.alpha = 1;
      return p;
    } else {
      return new Particle(x, y, vx, vy, size, color);
    }
  }
  returnParticle(p) {
    this.particlePool.push(p);
  }

  bindEvents() {
    document.addEventListener('keydown', (e) => {
      // Audio may only start after a user gesture.
      this.sfx.unlock();
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'Backquote') {
        this.frameMeter.toggle();
        return;
      }
      if (e.code === 'KeyM' && !e.repeat) {
        this.sfx.toggleMute();
        return;
      }
      if (e.code === 'Escape') {
        if (this.state === GameStateEnum.PLAYING) {
          this.pause();
        } else if (this.state === GameStateEnum.PAUSED) {
          this.state = GameStateEnum.PLAYING;
        }
        return;
      }
      // Held keys auto-repeat; only a fresh press should start, resume, restart or dash.
      const freshSpace = e.code === 'Space' && !e.repeat;
      if (this.state === GameStateEnum.PAUSED && freshSpace) {
        this.state = GameStateEnum.PLAYING;
        return;
      }
      if (this.state === GameStateEnum.START && freshSpace) {
        this.state = GameStateEnum.PLAYING;
        return;
      }
      if (this.state === GameStateEnum.GAMEOVER && freshSpace) {
        if (this.canRestart()) this.restart();
        return;
      }
      if (this.state === GameStateEnum.PLAYING) {
        if (e.key === 'ArrowLeft') {
          this.keys.left = true;
          this.player.lastDirection = -1;
        }
        if (e.key === 'ArrowRight') {
          this.keys.right = true;
          this.player.lastDirection = 1;
        }
        const shape = MORPH_KEYS[e.key];
        if (shape && this.player.shape !== shape) {
          this.player.shape = shape;
          this.player.morphScale = 1.5;
          this.sfx.morph();
        }
        if (freshSpace && !this.player.isDashing) {
          if (this.keys.left) {
            this.player.dashDirection = -1;
          } else if (this.keys.right) {
            this.player.dashDirection = 1;
          } else {
            this.player.dashDirection = this.player.lastDirection;
          }
          this.player.isDashing = true;
          this.player.dashTime = DASH_DURATION;
          this.createParticles(this.player.x, this.player.y, '#ffffff', 10);
          this.sfx.dash();
        }
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft') this.keys.left = false;
      if (e.key === 'ArrowRight') this.keys.right = false;
    });
    // Keyups are lost while the page is unfocused, so drop held keys and pause.
    const onFocusLost = () => {
      this.keys.left = false;
      this.keys.right = false;
      if (this.state === GameStateEnum.PLAYING) this.pause();
    };
    window.addEventListener('blur', onFocusLost);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) onFocusLost();
    });
  }

  pause() {
    this.state = GameStateEnum.PAUSED;
  }

  canRestart() {
    return this.gameOverTimer >= RESTART_LOCKOUT;
  }

  restart() {
    this.resetRun();
    this.state = GameStateEnum.PLAYING;
  }

  endGame(reason) {
    this.state = GameStateEnum.GAMEOVER;
    this.deathReason = reason;
    this.gameOverTimer = 0;
    this.shake = SHAKE_DEATH;
    if (reason === 'Out of energy!') {
      this.sfx.outOfEnergy();
    } else {
      this.sfx.wrongShape();
      this.createParticles(this.player.x, this.player.y, SHAPE_COLORS[this.player.shape], 30);
    }
    this.isNewHighScore = this.score > this.highScore;
    if (this.isNewHighScore) {
      this.highScore = this.score;
      localStorage.setItem('highScore', this.highScore);
    }
  }

  getObstacleSpeed() {
    return interpolate(SPEED_CURVE, this.runTime);
  }
  getSpawnInterval() {
    return interpolate(SPAWN_INTERVAL_CURVE, this.runTime);
  }
  getComboMultiplier() {
    return Math.min(1 + this.comboCount, MAX_COMBO_MULTIPLIER);
  }
  createParticles(x, y, color, amount = 15) {
    for (let i = 0; i < amount; i++) {
      let p = this.getParticle(
        x,
        y,
        (Math.random() - 0.5) * 180,
        (Math.random() - 0.5) * 180,
        Math.random() * 3 + 2,
        color
      );
      this.particles.push(p);
    }
  }
  playerHits(obs) {
    const { x, y, size, shape } = this.player;
    return this.player.getWrapOffsets().some(offset =>
      refinedCollisionDetection({ x: x + offset, y, size, shape }, obs)
    );
  }

  catchShape(obs) {
    if (this.energy < CLOSE_CALL_ENERGY) this.closeCalls++;
    this.score += 10 * this.getComboMultiplier();
    this.energy = Math.min(1, this.energy + ENERGY_PER_CATCH);
    this.sfx.catch(this.comboCount);
    this.comboCount++;
    this.comboTimer = 0;
    this.catches++;
    this.hitStop = HIT_STOP;
    this.createParticles(obs.x, obs.y, SHAPE_COLORS[obs.shape], 14);
  }

  // Effects that keep animating in every state (shake settling after death,
  // toasts fading out over the game-over screen, the menu starfield).
  updateEffects(dt) {
    this.shake *= Math.exp(-SHAKE_DECAY * dt);
    if (this.shake < 0.3) this.shake = 0;
    for (const toast of this.toasts) toast.age += dt;
    this.toasts = this.toasts.filter(t => t.age < TOAST_DURATION);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.update(dt);
      if (p.alpha <= 0) {
        this.returnParticle(p);
        this.particles.splice(i, 1);
      }
    }
    if (this.state !== GameStateEnum.PAUSED) this.stars.forEach(s => s.update(dt));
  }

  update(dt) {
    if (this.state === GameStateEnum.PAUSED) return;
    this.updateEffects(dt);
    if (this.state === GameStateEnum.GAMEOVER) {
      this.gameOverTimer += dt;
      return;
    }
    if (this.state !== GameStateEnum.PLAYING) return;
    // A brief freeze after each catch gives it weight.
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      return;
    }
    this.runTime += dt;
    this.player.update(dt, this.keys);
    const obstacleSpeed = this.getObstacleSpeed();
    for (let i = this.obstaclePreviews.length - 1; i >= 0; i--) {
      let prev = this.obstaclePreviews[i];
      if (prev.update(dt)) {
        this.obstacles.push(this.getObstacle(prev.x, prev.y, prev.size, prev.type, prev.shape));
        this.obstaclePreviews.splice(i, 1);
      }
    }
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      let obs = this.obstacles[i];
      obs.update(dt, obstacleSpeed);
      if (obs.y - obs.size / 2 > GAME_HEIGHT) {
        this.returnObstacle(obs);
        this.obstacles.splice(i, 1);
      }
    }
    for (const obs of this.obstacles) {
      if (!this.playerHits(obs)) continue;
      if (obs.type === 'normal') {
        if (this.player.shape === obs.shape) {
          this.catchShape(obs);
          obs.y = GAME_HEIGHT + 100;
        } else if (this.shieldActive) {
          this.shieldActive = false;
          this.shieldTimer = 0;
          this.shake = SHAKE_SHIELD_BREAK;
          this.sfx.shieldBreak();
          this.createParticles(obs.x, obs.y, '#00ffff', 16);
          obs.y = GAME_HEIGHT + 100;
        } else {
          this.endGame('Wrong shape!');
          return;
        }
      } else if (obs.type === 'powerup') {
        this.shieldsCollected++;
        this.shieldActive = true;
        this.shieldTimer = SHIELD_DURATION;
        this.sfx.shieldUp();
        this.createParticles(obs.x, obs.y, '#00ffff', 15);
        obs.y = GAME_HEIGHT + 100;
      }
    }
    this.energy -= ENERGY_DRAIN * dt;
    if (this.energy <= 0) {
      this.energy = 0;
      this.endGame('Out of energy!');
      return;
    }
    if (this.energy < ENERGY_LOW) {
      this.lowEnergyBeepTimer -= dt;
      if (this.lowEnergyBeepTimer <= 0) {
        this.sfx.lowEnergy();
        this.lowEnergyBeepTimer = LOW_ENERGY_BEEP_INTERVAL;
      }
    } else {
      this.lowEnergyBeepTimer = 0;
    }
    this.comboTimer += dt;
    if (this.comboTimer > COMBO_RESET_TIME) {
      this.comboCount = 0;
      this.comboTimer = 0;
    }
    if (this.shieldActive) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) this.shieldActive = false;
    }
    this.spawnTimer += dt;
    if (this.spawnTimer > this.getSpawnInterval()) {
      this.spawnObstacle();
      this.spawnTimer = 0;
    }
    this.checkAchievements();
  }

  checkAchievements() {
    this.achievements.forEach(ach => {
      if (this.achievementState[ach.id]) return;
      if (ach.condition(this)) {
        this.unlockAchievement(ach);
      }
    });
  }

  unlockAchievement(ach) {
    this.achievementState[ach.id] = true;
    localStorage.setItem('achievements', JSON.stringify(this.achievementState));
    this.newAchievements.push(ach);
    this.toasts.push({ title: ach.title, description: ach.description, age: 0 });
    this.sfx.achievement();
  }

  spawnObstacle() {
    const size = 40;
    const x = Math.random() * (GAME_WIDTH - size) + size / 2;
    // Below the HUD strip so new shapes never appear on top of the score.
    const y = HUD_HEIGHT + size / 2 + 6;
    if (Math.random() < 0.1) {
      this.obstaclePreviews.push(new ObstaclePreview(x, y, 30, 'powerup', 'star'));
    } else {
      const shapes = ['circle', 'square', 'triangle'];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      this.obstaclePreviews.push(new ObstaclePreview(x, y, size, 'normal', shape));
    }
  }
  // The gradient behind the stars is the canvas's CSS background (styles.css),
  // which is far cheaper than filling every pixel each frame.
  drawBackground() {
    this.ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.stars.forEach(s => s.draw(this.ctx));
  }
  draw() {
    const ctx = this.ctx;
    this.drawBackground();
    if (this.state === GameStateEnum.START) {
      drawStartMenu(ctx);
      return;
    }
    // The playfield shakes; the HUD and overlays stay put.
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 2 * this.shake, (Math.random() - 0.5) * 2 * this.shake);
    }
    this.obstaclePreviews.forEach(p => p.draw(ctx));
    this.obstacles.forEach(obs => obs.draw(ctx));
    if (this.state !== GameStateEnum.GAMEOVER || this.deathReason !== 'Wrong shape!') {
      this.player.draw(ctx, this.shieldActive);
    }
    this.particles.forEach(p => p.draw(ctx));
    ctx.restore();
    drawHUD(ctx, this);
    if (this.state === GameStateEnum.GAMEOVER) drawGameOver(ctx, this);
    if (this.state === GameStateEnum.PAUSED) drawPause(ctx);
  }
  // Starts the single animation loop. It runs for the life of the page and
  // every state (menu, playing, paused, game over) is handled inside it, so
  // state changes never need to start or stop loops themselves.
  start() {
    this.lastFrameTime = performance.now();
    requestAnimationFrame((time) => this.gameLoop(time));
  }
  gameLoop(currentTime) {
    const gapMs = currentTime - this.lastFrameTime;
    const dt = Math.min(Math.max(gapMs / 1000, 0), MAX_DT);
    this.lastFrameTime = currentTime;
    const workStart = performance.now();
    this.update(dt);
    this.draw();
    this.frameMeter.record(currentTime, gapMs, performance.now() - workStart);
    this.frameMeter.draw(this.ctx);
    requestAnimationFrame((time) => this.gameLoop(time));
  }
}
