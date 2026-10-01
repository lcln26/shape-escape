import { GAME_WIDTH, GAME_HEIGHT, MAX_DT, COMBO_RESET_TIME, SHIELD_DURATION, GameStateEnum, DASH_DURATION, RESTART_LOCKOUT, ENERGY_DRAIN, ENERGY_PER_CATCH, ENERGY_LOW, MAX_COMBO_MULTIPLIER, SHAPE_COLORS, CATCH_POP, SHAKE_DEATH, SHAKE_SHIELD_BREAK, SHAKE_DECAY, TOAST_DURATION } from "./config.js";
import { refinedCollisionDetection } from "./utils.js";
import { Player } from "./player.js";
import { Obstacle, ObstaclePreview } from "./obstacle.js";
import { Particle } from "./particle.js";
import { Star } from "./star.js";
import { achievements } from "./achievements.js";
import { FrameMeter } from "./frameMeter.js";
import { FramePacer } from "./framePacer.js";
import { Sfx } from "./audio.js";
import { Spawner, SPAWN_Y, SHAPE_SIZE, STAR_SIZE, speedAt } from "./spawner.js";
import { createRng, randomSeed } from "./random.js";
import { todayKey, dailySeed, loadDailyBest, saveDailyBest, shareText } from "./daily.js";
import { drawHUD, drawStartMenu, drawPause, drawGameOver } from "./hud.js";

const LOW_ENERGY_BEEP_INTERVAL = 0.5;
const BACKGROUND_COLOR = '#191919'; // midpoint of the CSS gradient (#111 → #222)
const CLOSE_CALL_ENERGY = 0.1;

export const GameMode = {
  NORMAL: 'normal',
  DAILY: 'daily',
};

// Rules, state and drawing for a run. Input (keyboard in input.js, touch in
// touch.js) drives it through the action methods: setMove, morph, dash,
// confirm, startRun, togglePause, toMenu and copyResult.
export class Game {
  // opaque: the canvas was created with { alpha: false }, so draw a solid
  // background instead of clearing to transparent.
  constructor(canvas, ctx, { opaque = false } = {}) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.opaque = opaque;
    this.state = GameStateEnum.START;
    this.mode = GameMode.NORMAL;
    this.highScore = parseInt(localStorage.getItem('highScore')) || 0;
    this.dailyKey = todayKey();
    this.dailyBest = loadDailyBest(this.dailyKey);
    this.lastFrameTime = performance.now();
    this.keys = { left: false, right: false };
    this.frameMeter = new FrameMeter();
    this.framePacer = new FramePacer(MAX_DT);
    this.sfx = new Sfx();
    // Set by touch.js so screens show tap prompts instead of key prompts.
    this.touch = false;

    this.achievements = achievements;
    this.achievementState = JSON.parse(localStorage.getItem('achievements')) || {};
    this.toasts = [];
    this.shake = 0;

    this.obstacles = [];
    this.obstaclePreviews = [];
    this.particles = [];
    this.stars = [];
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
  }

  // Per-run state, shared by the first run and every restart.
  resetRun() {
    this.score = 0;
    this.isNewHighScore = false;
    this.gameOverTimer = 0;
    this.deathReason = '';
    this.energy = 1;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.bestMultiplier = 1;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.runTime = 0;
    this.lowEnergyBeepTimer = 0;
    this.catches = 0;
    this.catchesByShape = { circle: 0, square: 0, triangle: 0 };
    this.closeCalls = 0;
    this.shieldsCollected = 0;
    this.newAchievements = [];
    this.keys.left = false;
    this.keys.right = false;
    // The daily challenge replays the same seed; normal runs get a fresh one.
    this.seed = this.mode === GameMode.DAILY ? dailySeed(this.dailyKey) : randomSeed();
    this.spawner = new Spawner(createRng(this.seed));
    // Return particles to their pool.
    this.particles.forEach(p => this.returnParticle(p));
    this.obstacles = [];
    this.obstaclePreviews = [];
    this.particles = [];
    this.player = new Player(this);
  }

  // Particle pooling: bursts of particles are created and discarded constantly.
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

  // ---- Actions (called by keyboard and touch input) ----

  setMove(direction, held) {
    if (direction < 0) this.keys.left = held;
    else this.keys.right = held;
    if (held && this.state === GameStateEnum.PLAYING) this.player.lastDirection = direction;
  }

  morph(shape) {
    if (this.state !== GameStateEnum.PLAYING || this.player.shape === shape) return;
    this.player.shape = shape;
    this.player.morphScale = 1.5;
    this.sfx.morph();
  }

  // Dashes in `direction` if given, else the held direction, else the last one.
  dash(direction) {
    if (this.state !== GameStateEnum.PLAYING || this.player.isDashing) return;
    if (direction) {
      this.player.dashDirection = direction;
    } else if (this.keys.left) {
      this.player.dashDirection = -1;
    } else if (this.keys.right) {
      this.player.dashDirection = 1;
    } else {
      this.player.dashDirection = this.player.lastDirection;
    }
    this.player.lastDirection = this.player.dashDirection;
    this.player.isDashing = true;
    this.player.dashTime = DASH_DURATION;
    this.createParticles(this.player.x, this.player.y, '#ffffff', 10);
    this.sfx.dash();
  }

  // The "go" button: start from the menu, resume, or retry after game over.
  // Returns true if it did something, so input can tell it apart from a dash.
  confirm() {
    if (this.state === GameStateEnum.START) {
      this.startRun(GameMode.NORMAL);
    } else if (this.state === GameStateEnum.PAUSED) {
      this.state = GameStateEnum.PLAYING;
    } else if (this.state === GameStateEnum.GAMEOVER) {
      if (this.canRestart()) this.startRun(this.mode);
    } else {
      return false;
    }
    return true;
  }

  startRun(mode) {
    this.mode = mode;
    this.dailyKey = todayKey();
    this.dailyBest = loadDailyBest(this.dailyKey);
    this.resetRun();
    this.state = GameStateEnum.PLAYING;
  }

  togglePause() {
    if (this.state === GameStateEnum.PLAYING) {
      this.pause();
    } else if (this.state === GameStateEnum.PAUSED) {
      this.state = GameStateEnum.PLAYING;
    }
  }

  pause() {
    this.state = GameStateEnum.PAUSED;
  }

  toMenu() {
    if (this.state === GameStateEnum.GAMEOVER && !this.canRestart()) return;
    this.resetRun();
    this.state = GameStateEnum.START;
  }

  // Copies the daily challenge result to the clipboard for sharing.
  async copyResult() {
    if (this.state !== GameStateEnum.GAMEOVER || this.mode !== GameMode.DAILY) return;
    const text = shareText({
      key: this.dailyKey,
      score: this.score,
      runTime: this.runTime,
      bestMultiplier: this.bestMultiplier,
      catchesByShape: this.catchesByShape,
    });
    try {
      await navigator.clipboard.writeText(text);
      this.toast('Result copied', 'Paste it anywhere to share', 'Daily');
    } catch {
      this.toast('Couldn\'t copy', 'Your browser blocked clipboard access', 'Daily');
    }
  }

  // ---- Rules ----

  canRestart() {
    return this.gameOverTimer >= RESTART_LOCKOUT;
  }

  endGame(reason) {
    this.state = GameStateEnum.GAMEOVER;
    this.deathReason = reason;
    this.gameOverTimer = 0;
    this.keys.left = false;
    this.keys.right = false;
    this.shake = SHAKE_DEATH;
    if (reason === 'Out of energy!') {
      this.sfx.outOfEnergy();
    } else {
      this.sfx.wrongShape();
      this.createParticles(this.player.x, this.player.y, SHAPE_COLORS[this.player.shape], 30);
    }
    if (this.mode === GameMode.DAILY) {
      this.isNewHighScore = this.score > this.dailyBest;
      if (this.isNewHighScore) {
        this.dailyBest = this.score;
        saveDailyBest(this.dailyKey, this.score);
      }
    } else {
      this.isNewHighScore = this.score > this.highScore;
      if (this.isNewHighScore) {
        this.highScore = this.score;
        localStorage.setItem('highScore', this.highScore);
      }
    }
  }

  getObstacleSpeed() {
    return speedAt(this.runTime);
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
    this.bestMultiplier = Math.max(this.bestMultiplier, this.getComboMultiplier());
    this.catches++;
    this.catchesByShape[obs.shape]++;
    // A quick pop instead of a freeze: freezing on every catch felt like lag
    // during fast streams.
    this.player.morphScale = Math.max(this.player.morphScale, CATCH_POP);
    this.createParticles(obs.x, obs.y, SHAPE_COLORS[obs.shape], 14);
  }

  // Shapes appear as a flashing preview just below the HUD, then fall.
  addPreview({ x, shape, type, lateBy = 0 }) {
    const size = type === 'powerup' ? STAR_SIZE : SHAPE_SIZE;
    this.obstaclePreviews.push(new ObstaclePreview(x, SPAWN_Y, size, type, shape, lateBy));
  }

  toast(title, description, label = 'Achievement') {
    this.toasts.push({ label, title, description, age: 0 });
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
    this.stars.forEach(s => s.update(dt));
  }

  update(dt) {
    if (this.state === GameStateEnum.PAUSED) return;
    this.updateEffects(dt);
    if (this.state === GameStateEnum.GAMEOVER) {
      this.gameOverTimer += dt;
      return;
    }
    if (this.state !== GameStateEnum.PLAYING) return;
    this.runTime += dt;
    this.player.update(dt, this.keys);
    // Falling shapes move, then finished previews are released, then new
    // previews spawn, so each accounts for this frame's time exactly once and
    // shapes reach the player on the beat.
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      let obs = this.obstacles[i];
      obs.update(dt);
      if (obs.y - obs.size / 2 > GAME_HEIGHT) this.obstacles.splice(i, 1);
    }
    for (let i = this.obstaclePreviews.length - 1; i >= 0; i--) {
      let prev = this.obstaclePreviews[i];
      if (prev.update(dt)) {
        const overshoot = prev.timer - prev.duration;
        const speed = speedAt(this.runTime - overshoot);
        this.obstacles.push(new Obstacle(prev.x, prev.y + overshoot * speed, prev.size, prev.type, prev.shape, speed));
        this.obstaclePreviews.splice(i, 1);
      }
    }
    this.spawner.update(this.runTime, (spawn) => this.addPreview(spawn));
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
        // Keeps the combo alive (without adding to it): going for a star
        // shouldn't cost you your streak.
        this.comboTimer = 0;
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
    this.toast(ach.title, ach.description);
    this.sfx.achievement();
  }

  // ---- Drawing ----

  // Transparent canvases show the CSS gradient behind them (styles.css);
  // opaque ones get a solid fill, which is about as cheap as a clear.
  drawBackground() {
    if (this.opaque) {
      this.ctx.fillStyle = BACKGROUND_COLOR;
      this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    } else {
      this.ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    this.stars.forEach(s => s.draw(this.ctx));
  }
  draw() {
    const ctx = this.ctx;
    this.drawBackground();
    if (this.state === GameStateEnum.START) {
      drawStartMenu(ctx, this);
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
    if (this.state === GameStateEnum.PAUSED) drawPause(ctx, this);
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
    // The meter tracks the display's refresh interval, which the pacer uses
    // to smooth over the occasional late frame.
    const dt = this.framePacer.step(gapMs / 1000, this.frameMeter.interval / 1000);
    this.lastFrameTime = currentTime;
    const workStart = performance.now();
    this.update(dt);
    this.draw();
    this.frameMeter.record(currentTime, gapMs, performance.now() - workStart);
    this.frameMeter.draw(this.ctx);
    requestAnimationFrame((time) => this.gameLoop(time));
  }
}
