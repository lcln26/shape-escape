import { GameStateEnum, RESTART_LOCKOUT } from '../js/config.js';
import { GameMode } from '../js/game.js';
import { setupTouch } from '../js/touch.js';
import { makeGame, advance } from './helpers.js';

// jsdom has no PointerEvent; a MouseEvent with a pointerId is close enough.
class FakePointerEvent extends MouseEvent {
  constructor(type, init = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

document.body.innerHTML = `
  <canvas id="gameCanvas"></canvas>
  <div id="touch-actions"></div>
  <button data-move="-1"></button><button data-move="1"></button>
  <button data-shape="circle"></button><button data-shape="square"></button><button data-shape="triangle"></button>`;

// The contextual buttons refresh on animation frames; run them on demand.
let frameCallbacks = [];
window.requestAnimationFrame = (cb) => frameCallbacks.push(cb);
function frame() {
  const callbacks = frameCallbacks;
  frameCallbacks = [];
  callbacks.forEach(cb => cb(performance.now()));
}

const game = makeGame();
game.canvas = document.getElementById('gameCanvas');
game.state = GameStateEnum.START;
setupTouch(game);

const $ = (selector) => document.querySelector(selector);
const pointer = (el, type) => el.dispatchEvent(new FakePointerEvent(type, { bubbles: true }));
const actions = () => [...document.querySelectorAll('.touch-action')];
const action = (label) => actions().find(b => b.textContent === label);

test('menu offers Play and Daily challenge', () => {
  frame();
  expect(actions().map(b => b.textContent)).toEqual(['Play', 'Daily challenge']);
  action('Daily challenge').click();
  expect(game.state).toBe(GameStateEnum.PLAYING);
  expect(game.mode).toBe(GameMode.DAILY);
});

test('holding an arrow moves; releasing stops', () => {
  pointer($('[data-move="1"]'), 'pointerdown');
  expect(game.keys.right).toBe(true);
  pointer($('[data-move="1"]'), 'pointerup');
  expect(game.keys.right).toBe(false);
});

test('double-tapping an arrow dashes that way', () => {
  game.player.isDashing = false;
  const left = $('[data-move="-1"]');
  pointer(left, 'pointerdown');
  pointer(left, 'pointerup');
  expect(game.player.isDashing).toBe(false);
  pointer(left, 'pointerdown');
  pointer(left, 'pointerup');
  expect(game.player.isDashing).toBe(true);
  expect(game.player.dashDirection).toBe(-1);
});

test('shape buttons morph and show which shape is selected', () => {
  pointer($('[data-shape="triangle"]'), 'pointerdown');
  frame();
  expect(game.player.shape).toBe('triangle');
  expect($('[data-shape="triangle"]').classList.contains('selected')).toBe(true);
  expect($('[data-shape="circle"]').classList.contains('selected')).toBe(false);
});

test('pause, resume, and the game-over buttons (with Share for daily)', () => {
  frame();
  action('Pause').click();
  expect(game.state).toBe(GameStateEnum.PAUSED);
  frame();
  action('Resume').click();
  expect(game.state).toBe(GameStateEnum.PLAYING);
  game.endGame('Out of energy!');
  frame();
  expect(actions()).toHaveLength(0); // nothing to press during the restart lockout
  advance(game, RESTART_LOCKOUT + 0.1);
  frame();
  expect(actions().map(b => b.textContent)).toEqual(['Retry', 'Menu', 'Share']);
  action('Retry').click();
  expect(game.state).toBe(GameStateEnum.PLAYING);
  expect(game.mode).toBe(GameMode.DAILY);
});

test('tapping the game starts from the menu', () => {
  game.toMenu();
  game.state = GameStateEnum.START;
  pointer(game.canvas, 'pointerdown');
  expect(game.state).toBe(GameStateEnum.PLAYING);
  expect(game.mode).toBe(GameMode.NORMAL);
});
