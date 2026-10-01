import { GAME_WIDTH, GAME_HEIGHT } from "./config.js";
import { Game } from "./game.js";
import { bindKeyboard } from "./input.js";
import { isTouchDevice, setupTouch } from "./touch.js";

const stage = document.getElementById('stage');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Room left around the canvas for its outline ring.
const CANVAS_RING = 4;
// Never render more than 2x the logical resolution (1600x1200): beyond that
// the extra pixels cost frame time without looking noticeably sharper.
const MAX_RENDER_SCALE = 2;

// Scale the canvas to fill the stage at a fixed 4:3 aspect ratio. The game
// always draws in GAME_WIDTH x GAME_HEIGHT logical units; the backing store
// matches the on-screen size times devicePixelRatio (up to MAX_RENDER_SCALE)
// so it stays crisp.
function fitCanvas() {
  const style = getComputedStyle(stage);
  const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const availW = stage.clientWidth - padX - CANVAS_RING * 2;
  const availH = stage.clientHeight - padY - CANVAS_RING * 2;
  const scale = Math.max(0.1, Math.min(availW / GAME_WIDTH, availH / GAME_HEIGHT));
  const cssW = Math.floor(GAME_WIDTH * scale);
  const cssH = Math.floor(GAME_HEIGHT * scale);
  const renderScale = Math.min(scale * (window.devicePixelRatio || 1), MAX_RENDER_SCALE);
  canvas.style.width = cssW + "px";
  canvas.style.height = cssH + "px";
  canvas.width = Math.round(GAME_WIDTH * renderScale);
  canvas.height = Math.round(GAME_HEIGHT * renderScale);
  // Resizing the backing store resets the context, so reapply the transform.
  ctx.setTransform(canvas.width / GAME_WIDTH, 0, 0, canvas.height / GAME_HEIGHT, 0, 0);
}

const game = new Game(canvas, ctx);
bindKeyboard(game);
// Touch layout changes the page's grid, so set it up before the first fit.
if (isTouchDevice()) setupTouch(game);

fitCanvas();
new ResizeObserver(fitCanvas).observe(stage);
game.start();
