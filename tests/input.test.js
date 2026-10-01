import { bindKeyboard } from '../js/input.js';
import { GameStateEnum, RESTART_LOCKOUT } from '../js/config.js';
import { GameMode } from '../js/game.js';
import { makeGame, advance } from './helpers.js';

function press(code, key = code, repeat = false) {
  document.dispatchEvent(new KeyboardEvent('keydown', { code, key, repeat }));
}

// One game with keyboard bound for the whole file: listeners stay on document.
const game = makeGame();
bindKeyboard(game);

beforeEach(() => {
  game.toMenu();
  game.gameOverTimer = RESTART_LOCKOUT;
  game.state = GameStateEnum.START;
});

test('Space starts a normal run and D starts the daily challenge', () => {
  press('Space', ' ');
  expect(game.state).toBe(GameStateEnum.PLAYING);
  expect(game.mode).toBe(GameMode.NORMAL);
  game.state = GameStateEnum.START;
  press('KeyD', 'd');
  expect(game.state).toBe(GameStateEnum.PLAYING);
  expect(game.mode).toBe(GameMode.DAILY);
});

test('existing controls are unchanged: arrows, 1/2/3, Space to dash, Esc to pause', () => {
  press('Space', ' ');
  press('ArrowLeft', 'ArrowLeft');
  expect(game.keys.left).toBe(true);
  document.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowLeft', key: 'ArrowLeft' }));
  expect(game.keys.left).toBe(false);
  press('Digit3', '3');
  expect(game.player.shape).toBe('triangle');
  press('Space', ' ');
  expect(game.player.isDashing).toBe(true);
  press('Escape');
  expect(game.state).toBe(GameStateEnum.PAUSED);
  press('Escape');
  expect(game.state).toBe(GameStateEnum.PLAYING);
});

test('held Space does not restart, and Space retries in the same mode after the lockout', () => {
  press('KeyD', 'd');
  game.endGame('Out of energy!');
  press('Space', ' ');
  expect(game.state).toBe(GameStateEnum.GAMEOVER);
  advance(game, RESTART_LOCKOUT + 0.1);
  press('Space', ' ', true);
  expect(game.state).toBe(GameStateEnum.GAMEOVER);
  press('Space', ' ');
  expect(game.state).toBe(GameStateEnum.PLAYING);
  expect(game.mode).toBe(GameMode.DAILY);
});

test('Esc on the game-over screen goes back to the menu', () => {
  press('Space', ' ');
  game.endGame('Out of energy!');
  advance(game, RESTART_LOCKOUT + 0.1);
  press('Escape');
  expect(game.state).toBe(GameStateEnum.START);
});
