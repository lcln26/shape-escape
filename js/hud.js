import { GAME_WIDTH, GAME_HEIGHT, HUD_HEIGHT, ENERGY_LOW, SHAPE_COLORS, TOAST_DURATION, GameStateEnum } from "./config.js";
import { drawShape } from "./utils.js";

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

export function drawHUD(ctx, game) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, GAME_WIDTH, HUD_HEIGHT);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(0, HUD_HEIGHT - 1, GAME_WIDTH, 1);

  const mid = HUD_HEIGHT / 2;
  text(ctx, `Score ${game.score}`, 12, mid, { align: 'left', weight: 500 });
  text(ctx, `Best ${game.highScore}`, 180, mid, { align: 'left', color: '#999' });

  const multiplier = game.getComboMultiplier();
  if (multiplier > 1) {
    text(ctx, `x${multiplier}`, GAME_WIDTH / 2, mid, { size: 18 + multiplier * 2, color: '#F0E442', weight: 700 });
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
    text(ctx, `Achievement: ${toast.title}`, GAME_WIDTH / 2, y - 7, { size: 18, color: '#F0E442', weight: 500 });
    text(ctx, toast.description, GAME_WIDTH / 2, y + 12, { size: 14, color: '#ccc' });
  });
  ctx.globalAlpha = 1;
}

export function drawStartMenu(ctx) {
  const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
  text(ctx, 'Shape Escape', cx, cy - 120, { size: 48, weight: 500 });
  text(ctx, 'Catch shapes that match you. Dodge the rest.', cx, cy - 60, { size: 18, color: '#ccc' });
  text(ctx, 'Every catch refills your energy — run out and it\'s over.', cx, cy - 34, { size: 18, color: '#ccc' });

  ['circle', 'square', 'triangle'].forEach((shape, i) => {
    const x = cx + (i - 1) * 110, y = cy + 40;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = SHAPE_COLORS[shape];
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    drawShape(ctx, shape, 44);
    ctx.restore();
    text(ctx, `[${i + 1}]`, x, y + 48, { size: 16, color: '#999' });
  });

  const blink = Math.floor(performance.now() / 600) % 2 === 0;
  if (blink) text(ctx, 'Press Space to Start', cx, cy + 150, { size: 22, weight: 500 });
}

export function drawPause(ctx) {
  dim(ctx, 0.5);
  text(ctx, 'Paused', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, { size: 40, weight: 500 });
  text(ctx, 'Esc to resume · M to mute', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, { size: 16, color: '#ccc' });
}

export function drawGameOver(ctx, game) {
  dim(ctx, 0.7);
  const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2;
  text(ctx, game.deathReason, cx, cy - 100, { size: 40, weight: 500 });
  text(ctx, `Score ${game.score}`, cx, cy - 45, { size: 30, weight: 500 });
  if (game.isNewHighScore) {
    text(ctx, 'New High Score!', cx, cy - 10, { size: 20, color: '#F0E442', weight: 500 });
  } else {
    text(ctx, `Best ${game.highScore}`, cx, cy - 10, { size: 20, color: '#999' });
  }

  const unlocked = game.achievements.filter(a => game.achievementState[a.id]).length;
  let y = cy + 30;
  text(ctx, `Achievements ${unlocked}/${game.achievements.length}`, cx, y, { size: 16, color: '#999' });
  for (const a of game.newAchievements) {
    y += 24;
    text(ctx, `New: ${a.title}`, cx, y, { size: 16, color: '#F0E442' });
  }

  if (game.canRestart()) {
    text(ctx, 'Press Space to Restart', cx, Math.max(cy + 110, y + 40), { size: 20 });
  }
}
