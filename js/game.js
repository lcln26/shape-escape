import { GAME_WIDTH, GAME_HEIGHT, MAX_DT, COMBO_RESET_TIME, SHIELD_DURATION, GameStateEnum, DASH_DURATION, RESTART_LOCKOUT, ENERGY_DRAIN, ENERGY_PER_CATCH, ENERGY_LOW, MAX_COMBO_MULTIPLIER, SPEED_CURVE, SPAWN_INTERVAL_CURVE } from "./config.js";
import { refinedCollisionDetection, interpolate } from "./utils.js";
import { Player } from "./player.js";
import { Obstacle, ObstaclePreview } from "./obstacle.js";
import { Particle } from "./particle.js";
import { Star } from "./star.js";
import { achievements } from "./achievements.js";
import { FrameMeter } from "./frameMeter.js";

const FONT_FAMILY = "Roboto, sans-serif";

export class Game {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.state = GameStateEnum.START;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('highScore')) || 0;
    this.isNewHighScore = false;
    this.gameOverTimer = 0;
    this.deathReason = '';
    this.energy = 1;
    this.spawnTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.lastFrameTime = performance.now();
    this.keys = { left: false, right: false };
    this.frameMeter = new FrameMeter();

    this.runTime = 0;
    this.shieldsCollected = 0;
    this.achievements = achievements;
    this.achievementState = JSON.parse(localStorage.getItem('achievements')) || {};

    this.player = new Player(this);
    this.obstacles = [];
    this.obstaclePreviews = [];
    this.particles = [];
    this.stars = [];
    this.obstaclePool = [];
    this.particlePool = [];

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
      if (e.code === 'Space') e.preventDefault();
      if (e.code === 'Backquote') {
        this.frameMeter.toggle();
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
        if (e.key === '1' && this.player.shape !== 'circle') {
          this.player.shape = 'circle';
          this.player.morphScale = 1.5;
        }
        if (e.key === '2' && this.player.shape !== 'square') {
          this.player.shape = 'square';
          this.player.morphScale = 1.5;
        }
        if (e.key === '3' && this.player.shape !== 'triangle') {
          this.player.shape = 'triangle';
          this.player.morphScale = 1.5;
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
    this.state = GameStateEnum.PLAYING;
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
    this.shieldsCollected = 0;
    // Return obstacles and particles to their pools.
    this.obstacles.forEach(obs => this.returnObstacle(obs));
    this.particles.forEach(p => this.returnParticle(p));
    this.obstacles = [];
    this.obstaclePreviews = [];
    this.particles = [];
    this.player = new Player(this);
  }

  endGame(reason) {
    this.state = GameStateEnum.GAMEOVER;
    this.deathReason = reason;
    this.gameOverTimer = 0;
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
  update(dt) {
    if (this.state === GameStateEnum.GAMEOVER) {
      this.gameOverTimer += dt;
      return;
    }
    if (this.state === GameStateEnum.START) {
      this.stars.forEach(s => s.update(dt));
      return;
    }
    if (this.state !== GameStateEnum.PLAYING) return;
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
          this.score += 10 * this.getComboMultiplier();
          this.energy = Math.min(1, this.energy + ENERGY_PER_CATCH);
          this.comboCount++;
          this.comboTimer = 0;
          this.createParticles(obs.x, obs.y, '#00ff00', 10);
          obs.y = GAME_HEIGHT + 100;
        } else if (this.shieldActive) {
          this.shieldActive = false;
          this.shieldTimer = 0;
          this.createParticles(obs.x, obs.y, '#ffff00', 10);
          obs.y = GAME_HEIGHT + 100;
        } else {
          this.endGame('Wrong shape!');
          return;
        }
      } else if (obs.type === 'powerup') {
        this.shieldsCollected++;
        this.shieldActive = true;
        this.shieldTimer = SHIELD_DURATION;
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
    for (let i = this.particles.length - 1; i >= 0; i--) {
      let p = this.particles[i];
      p.update(dt);
      if (p.alpha <= 0) {
        this.returnParticle(p);
        this.particles.splice(i, 1);
      }
    }
    this.stars.forEach(s => s.update(dt));
    this.checkAchievements();
  }

  checkAchievements() {
    this.achievements.forEach(ach => {
      if (this.achievementState[ach.id]) return;
      if (ach.condition(this)) {
        this.unlockAchievement(ach.id);
      }
    });
  }

  unlockAchievement(id) {
    this.achievementState[id] = true;
    localStorage.setItem('achievements', JSON.stringify(this.achievementState));
  }

  spawnObstacle() {
    const size = 40;
    const x = Math.random() * (GAME_WIDTH - size) + size / 2;
    const y = size / 2;
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
    if (this.state === GameStateEnum.START) {
      this.drawStartMenu();
      return;
    }
    this.drawBackground();
    this.obstaclePreviews.forEach(p => p.draw(this.ctx));
    this.obstacles.forEach(obs => obs.draw(this.ctx));
    this.player.draw(this.ctx, this.shieldActive);
    this.particles.forEach(p => p.draw(this.ctx));
    this.drawUI();
    if (this.state === GameStateEnum.GAMEOVER) this.drawGameOver();
    if (this.state === GameStateEnum.PAUSED) this.drawPause();
  }
  drawStartMenu() {
    this.drawBackground();
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = `40px ${FONT_FAMILY}`;
    this.ctx.fillText('Shape Escape', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60);
    this.ctx.font = `20px ${FONT_FAMILY}`;
    this.ctx.fillText('Press Space to Start', GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }
  drawGameOver() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = `40px ${FONT_FAMILY}`;
    this.ctx.fillText(this.deathReason, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
    this.ctx.font = `20px ${FONT_FAMILY}`;
    let endMessage = this.isNewHighScore ? "New High Score!" : "High Score: " + this.highScore;
    this.ctx.fillText(endMessage, GAME_WIDTH / 2, GAME_HEIGHT / 2);
    if (this.canRestart()) {
      this.ctx.fillText('Press Space to Restart', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40);
    }
    const unlocked = this.achievements.filter(a => this.achievementState[a.id]);
    if (unlocked.length > 0) {
      this.ctx.fillText('Achievements:', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 80);
      unlocked.forEach((a, i) => {
        this.ctx.fillText(a.title, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 110 + i * 25);
      });
    }
  }
  drawPause() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = `40px ${FONT_FAMILY}`;
    this.ctx.fillText('Paused', GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }
  drawUI() {
    this.ctx.fillStyle = '#fff';
    this.ctx.font = `20px ${FONT_FAMILY}`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Score: ' + this.score, 10, 10);
    this.ctx.fillText('High Score: ' + this.highScore, 10, 35);
    if (this.comboCount > 1) {
      this.ctx.fillText('Combo x' + this.getComboMultiplier(), 10, 60);
    }
    if (this.shieldActive) {
      this.ctx.fillText('Shield: ' + Math.ceil(this.shieldTimer) + 's', GAME_WIDTH - 140, 10);
    }
    this.drawEnergyBar();
  }
  // Along the bottom edge, just under the player, where the eyes already are.
  drawEnergyBar() {
    const width = 300, height = 10;
    const x = (GAME_WIDTH - width) / 2, y = GAME_HEIGHT - 20;
    const low = this.energy < ENERGY_LOW;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    this.ctx.fillRect(x, y, width, height);
    let color = '#2ecc71';
    if (this.energy < 0.5) color = '#f1c40f';
    if (low) color = '#e74c3c';
    this.ctx.fillStyle = color;
    // Pulse while low so it reads as a warning without looking away.
    if (low && this.state === GameStateEnum.PLAYING) {
      this.ctx.globalAlpha = 0.55 + 0.45 * Math.sin(performance.now() / 80);
    }
    this.ctx.fillRect(x, y, width * this.energy, height);
    this.ctx.globalAlpha = 1;
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
