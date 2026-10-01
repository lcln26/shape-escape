import { GAME_WIDTH, GAME_HEIGHT, HUD_HEIGHT, ENERGY_LOW, SHAPE_COLORS, TOAST_DURATION, GameStateEnum } from "./config.js";
import { drawShape } from "./utils.js";
import { formatTime } from "./daily.js";

// Everything drawn on top of the playfield: the HUD strip, energy bar,
// achievement toasts and the start / pause / game-over screens.

const FONT_FAMILY = "Roboto, sans-serif";

function text(ctx, str, x, y, { size = 20, color = '#fff', align = 'center', baseline = 'middle', weight = 400 } = {}) {
  ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
}

function dim(ctx, alpha) {
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
}

export function drawHUD(ctx, game, pulse = 0) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(0, HUD_HEIGHT - 1, GAME_WIDTH, 1);

  const mid = HUD_HEIGHT / 2;
  text(ctx, `Score ${game.score}`, 12, mid, { align: 'left', weight: 500 });
  if (game.mode === 'daily') {
    text(ctx, `Daily best ${game.dailyBest}`, 180, mid, { align: 'left', color: '#F0E442' });
  } else {
    text(ctx, `Best ${game.highScore}`, 180, mid, { align: 'left', color: '#999' });
  }

  const multiplier = game.getComboMultiplier();
  if (multiplier > 1) {
    text(ctx, `x${multiplier}`, GAME_WIDTH / 2, mid, { size: 18 + multiplier * 2 + 6 * pulse, color: '#F0E442', weight: 700 });
  }

  const right = [];
  if (game.shieldActive) right.push({ str: `Shield ${Math.ceil(game.shieldTimer)}s`, color: '#00ffff' });
  if (game.sfx.muted) right.push({ str: 'Muted (M)', color: '#777' });
  let x = GAME_WIDTH - 12;
  ctx.font = `400 20px ${FONT_FAMILY}`;
  for (const item of right) {
    text(ctx, item.str, x, mid, { align: 'right', color: item.color });
    x -= ctx.measureText(item.str).width + 20;
  }

  drawEnergyBar(ctx, game);
  drawToasts(ctx, game);
  drawAttempt(ctx, game);
}

// "Attempt 12" across the middle as a run starts, fading out.
function drawAttempt(ctx, game) {
  if (!game.attempt || game.state !== GameStateEnum.PLAYING || game.runTime > 2) return;
  ctx.globalAlpha = Math.min(1, (2 - game.runTime) / 0.6);
  text(ctx, `Attempt ${game.attempt}`, GAME_WIDTH / 2, GAME_HEIGHT * 0.42, { size: 46, weight: 700 });
  ctx.globalAlpha = 1;
}

// Along the bottom edge, just under the player, where the eyes already are.
function drawEnergyBar(ctx, game) {
  const width = 300, height = 10;
  const x = (GAME_WIDTH - width) / 2, y = GAME_HEIGHT - 20;
  const low = game.energy < ENERGY_LOW;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(x, y, width, height);
  let color = '#2ecc71';
  if (game.energy < 0.5) color = '#f1c40f';
  if (low) color = '#e74c3c';
  ctx.fillStyle = color;
  // Pulse while low so it reads as a warning without looking away.
  if (low && game.state === GameStateEnum.PLAYING) {
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(performance.now() / 80);
  }
  ctx.fillRect(x, y, width * game.energy, height);
  ctx.globalAlpha = 1;
}

function drawToasts(ctx, game) {
  game.toasts.forEach((toast, i) => {
    const remaining = TOAST_DURATION - toast.age;
    ctx.globalAlpha = Math.min(1, remaining / 0.4, toast.age / 0.15);
    const y = HUD_HEIGHT + 34 + i * 52;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(GAME_WIDTH / 2 - 190, y - 22, 380, 46);
    ctx.fillStyle = '#F0E442';
    ctx.fillRect(GAME_WIDTH / 2 - 190, y - 22, 4, 46);
    text(ctx, `${toast.label}: ${toast.title}`, GAME_WIDTH / 2, y - 7, { size: 18, color: '#F0E442', weight: 500 });
    text(ctx, toast.description, GAME_WIDTH / 2, y + 12, { size: 14, color: '#ccc' });
  });
  ctx.globalAlpha = 1;
}

export function drawStartMenu(ctx, game, pulse = 0) {
  const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
  text(ctx, 'Shape Escape', cx, cy - 130, { size: 48 + 4 * pulse, weight: 700 });
  text(ctx, 'Catch shapes that match you. Dodge the rest.', cx, cy - 70, { size: 18, color: '#ccc' });
  text(ctx, 'Every catch refills your energy — run out and it\'s over.', cx, cy - 44, { size: 18, color: '#ccc' });

  ['circle', 'square', 'triangle'].forEach((shape, i) => {
    const x = cx + (i - 1) * 110, y = cy + 26;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = SHAPE_COLORS[shape];
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    drawShape(ctx, shape, 44);
    ctx.restore();
    if (!game.touch) text(ctx, `[${i + 1}]`, x, y + 48, { size: 16, color: '#999' });
  });

  const blink = Math.floor(performance.now() / 600) % 2 === 0;
  if (game.touch) {
    if (blink) text(ctx, 'Tap to Start', cx, cy + 130, { size: 22, weight: 500 });
  } else {
    if (blink) text(ctx, 'Press Space to Start', cx, cy + 130, { size: 22, weight: 500 });
    text(ctx, 'D: Daily challenge', cx, cy + 164, { size: 18, color: '#F0E442' });
  }
  const daily = game.dailyBest > 0 ? `Today's daily best: ${game.dailyBest}` : 'Same shapes for everyone, new every day';
  text(ctx, daily, cx, cy + 192, { size: 15, color: '#999' });
}

export function drawPause(ctx, game) {
  dim(ctx, 0.5);
  text(ctx, 'Paused', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, { size: 40, weight: 500 });
  if (!game.touch) {
    text(ctx, 'Esc to resume · M to mute', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, { size: 16, color: '#ccc' });
  }
}

export function drawGameOver(ctx, game) {
  dim(ctx, 0.7);
  const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
  const daily = game.mode === 'daily';
  if (daily) text(ctx, `Daily challenge · ${game.dailyKey}`, cx, cy - 145, { size: 16, color: '#F0E442' });
  text(ctx, game.deathReason, cx, cy - 100, { size: 40, weight: 500 });
  text(ctx, `Score ${game.score} · ${formatTime(game.runTime)}`, cx, cy - 45, { size: 30, weight: 500 });
  if (game.isNewHighScore) {
    text(ctx, daily ? 'New daily best!' : 'New High Score!', cx, cy - 10, { size: 20, color: '#F0E442', weight: 500 });
  } else {
    const best = daily ? `Today's best ${game.dailyBest}` : `Best ${game.highScore}`;
    text(ctx, best, cx, cy - 10, { size: 20, color: '#999' });
  }

  const unlocked = game.achievements.filter(a => game.achievementState[a.id]).length;
  let y = cy + 30;
  text(ctx, `Achievements ${unlocked}/${game.achievements.length}`, cx, y, { size: 16, color: '#999' });
  for (const a of game.newAchievements) {
    y += 24;
    text(ctx, `New: ${a.title}`, cx, y, { size: 16, color: '#F0E442' });
  }

  if (game.canRestart()) {
    const y2 = Math.max(cy + 110, y + 40);
    if (game.touch) {
      text(ctx, 'Tap to retry', cx, y2, { size: 20 });
    } else {
      text(ctx, 'Space to retry · Esc for menu', cx, y2, { size: 20 });
      if (daily) text(ctx, 'C to copy your result', cx, y2 + 30, { size: 16, color: '#F0E442' });
    }
  }
}
