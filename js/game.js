import { GAME_WIDTH, GAME_HEIGHT, MAX_DT, COMBO_RESET_TIME, SHIELD_DURATION, GameStateEnum, BASE_SPAWN_INTERVAL, DASH_DURATION } from "./config.js";
import { refinedCollisionDetection } from "./utils.js";
import { Player } from "./player.js";
import { Obstacle } from "./obstacle.js";
import { Particle } from "./particle.js";
import { Star } from "./star.js";


export class Game {
  constructor(canvas, ctx) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.state = GameStateEnum.START;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('highScore')) || 0;
    this.spawnTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.lastFrameTime = performance.now();
    this.keys = { left: false, right: false };

    this.player = new Player(this);
    this.obstacles = [];
    this.particles = [];
    this.stars = [];
    this.obstaclePool = [];
    this.particlePool = [];

    // Create starfield
    const starCount = 50;
    for (let i = 0; i < starCount; i++) {
      this.stars.push(new Star(
        Math.random() * GAME_WIDTH,
        Math.random() * GAME_HEIGHT,
        Math.random() * 2 + 1,
        Math.random() * 0.5 + 0.2
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
      if (e.code === 'Escape') {
        if (this.state === GameStateEnum.PLAYING) {
          this.state = GameStateEnum.PAUSED;
        } else if (this.state === GameStateEnum.PAUSED) {
          this.state = GameStateEnum.PLAYING;
          this.lastFrameTime = performance.now();
          requestAnimationFrame((time) => this.gameLoop(time));
        }
        return;
      }
      if (this.state === GameStateEnum.PAUSED && e.code === 'Space') {
        this.state = GameStateEnum.PLAYING;
        this.lastFrameTime = performance.now();
        requestAnimationFrame((time) => this.gameLoop(time));
        return;
      }
      if (this.state === GameStateEnum.START && e.code === 'Space') {
        this.state = GameStateEnum.PLAYING;
        this.lastFrameTime = performance.now();
        requestAnimationFrame((time) => this.gameLoop(time));
        return;
      }
      if (this.state === GameStateEnum.GAMEOVER && e.code === 'Space') {
        this.restart();
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
        if (e.code === 'Space') {
          if (!this.player.isDashing) {
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
          e.preventDefault();
        }
      }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft') this.keys.left = false;
      if (e.key === 'ArrowRight') this.keys.right = false;
    });
  }

  restart() {
    this.state = GameStateEnum.PLAYING;
    this.score = 0;
    this.spawnTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.shieldActive = false;
    this.shieldTimer = 0;
    // Return obstacles and particles to their pools.
    this.obstacles.forEach(obs => this.returnObstacle(obs));
    this.particles.forEach(p => this.returnParticle(p));
    this.obstacles = [];
    this.particles = [];
    this.player = new Player(this);
    this.lastFrameTime = performance.now();
    requestAnimationFrame((time) => this.gameLoop(time));
  }

  getObstacleSpeed() {
    if (this.score < 5000) {
      return 150 + (this.score / 5000) * 200;
    } else if (this.score < 15000) {
      return 350 + ((this.score - 5000) / 10000) * 150;
    } else {
      return 500 + ((this.score - 15000) / 10000) * 100;
    }
  }
  getSpawnInterval() {
    if (this.score < 5000) {
      return 1.0 - (this.score / 5000) * 0.1;
    } else if (this.score < 15000) {
      return 0.9 - ((this.score - 5000) / 10000) * 0.2;
    } else {
      return Math.max(0.5, 0.7 - ((this.score - 15000) / 10000) * 0.2);
    }
  }
  createParticles(x, y, color, amount = 15) {
    for (let i = 0; i < amount; i++) {
      let p = this.getParticle(
        x,
        y,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
        Math.random() * 3 + 2,
        color
      );
      this.particles.push(p);
    }
  }
  update(dt) {
    if (this.state !== GameStateEnum.PLAYING) return;
    this.player.update(dt, this.keys);
    const obstacleSpeed = this.getObstacleSpeed();
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      let obs = this.obstacles[i];
      obs.update(dt, obstacleSpeed);
      if (obs.y - obs.size / 2 > GAME_HEIGHT) {
        this.returnObstacle(obs);
        this.obstacles.splice(i, 1);
      }
    }
    this.obstacles.forEach((obs) => {
      if (refinedCollisionDetection(this.player, obs)) {
        if (obs.type === 'normal') {
          if (this.player.shape === obs.shape) {
            this.score += 10 * (1 + this.comboCount);
            this.comboCount++;
            this.comboTimer = 0;
            this.createParticles(obs.x, obs.y, '#00ff00', 10);
            obs.y = GAME_HEIGHT + 100;
          } else {
            if (this.shieldActive) {
              this.shieldActive = false;
              this.shieldTimer = 0;
              this.createParticles(obs.x, obs.y, '#ffff00', 10);
              obs.y = GAME_HEIGHT + 100;
            } else {
              this.state = GameStateEnum.GAMEOVER;
              if (this.score > this.highScore) {
                this.highScore = this.score;
                localStorage.setItem('highScore', this.highScore);
              }
            }
          }
        } else if (obs.type === 'powerup') {
          this.shieldActive = true;
          this.shieldTimer = SHIELD_DURATION;
          this.createParticles(obs.x, obs.y, '#00ffff', 15);
          obs.y = GAME_HEIGHT + 100;
        }
      }
    });
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
    this.stars.forEach(s => s.update());
  }
  spawnObstacle() {
    const size = 40;
    const x = Math.random() * (GAME_WIDTH - size) + size / 2;
    const y = -size / 2;
    if (Math.random() < 0.1) {
      this.obstacles.push(this.getObstacle(x, y, 30, 'powerup', 'star'));
    } else {
      const shapes = ['circle', 'square', 'triangle'];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      this.obstacles.push(this.getObstacle(x, y, size, 'normal', shape));
    }
  }
  draw() {
    if (this.state === GameStateEnum.START) {
      this.drawStartMenu();
      return;
    }
    // Draw background starfield.
    const grad = this.ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    grad.addColorStop(0, '#111');
    grad.addColorStop(1, '#222');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.stars.forEach(s => s.draw(this.ctx));
    this.obstacles.forEach(obs => obs.draw(this.ctx));
    this.player.draw(this.ctx, this.shieldActive);
    this.particles.forEach(p => p.draw(this.ctx));
    this.drawUI();
    if (this.state === GameStateEnum.GAMEOVER) this.drawGameOver();
    if (this.state === GameStateEnum.PAUSED) this.drawPause();
  }
  drawStartMenu() {
    const grad = this.ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    grad.addColorStop(0, '#111');
    grad.addColorStop(1, '#222');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = '40px sans-serif';
    this.ctx.fillText('Shape Escape', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 60);
    this.ctx.font = '20px sans-serif';
    this.ctx.fillText('Press Space to Start', GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }
  drawGameOver() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = '40px sans-serif';
    this.ctx.fillText('Game Over!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40);
    this.ctx.font = '20px sans-serif';
    let endMessage = this.score >= this.highScore ? "New High Score!" : "High Score: " + this.highScore;
    this.ctx.fillText(endMessage, GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.ctx.fillText('Press Space to Restart', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 40);
  }
  drawPause() {
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.ctx.fillStyle = '#fff';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.font = '40px sans-serif';
    this.ctx.fillText('Paused', GAME_WIDTH / 2, GAME_HEIGHT / 2);
  }
  drawUI() {
    this.ctx.shadowColor = "rgba(0,0,0,0.5)";
    this.ctx.shadowBlur = 4;
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '20px sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('Score: ' + this.score, 10, 10);
    this.ctx.fillText('High Score: ' + this.highScore, 10, 35);
    this.ctx.shadowBlur = 0;
    if (this.comboCount > 1) {
      this.ctx.fillText('Combo x' + (this.comboCount + 1), 10, 60);
    }
    if (this.shieldActive) {
      this.ctx.fillText('Shield: ' + Math.ceil(this.shieldTimer) + 's', GAME_WIDTH - 140, 10);
    }
  }
  gameLoop(currentTime) {
    let dt = (currentTime - this.lastFrameTime) / 1000;
    dt = Math.min(dt, MAX_DT);
    this.lastFrameTime = currentTime;
    this.update(dt);
    this.draw();
    if (this.state !== GameStateEnum.GAMEOVER) {
      requestAnimationFrame((time) => this.gameLoop(time));
    } else {
      this.draw();
    }
  }
}
