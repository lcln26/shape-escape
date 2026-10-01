import { COMBO_RESET_TIME } from '../js/config.js';
import { makeGame, placeOnPlayer, advance } from './helpers.js';

test('catching a matching shape starts a combo', () => {
  const game = makeGame();
  placeOnPlayer(game, game.player.shape);
  advance(game, 0.1);
  expect(game.comboCount).toBe(1);
});

test('combo ends after COMBO_RESET_TIME without a catch', () => {
  const game = makeGame();
  placeOnPlayer(game, game.player.shape);
  advance(game, COMBO_RESET_TIME + 0.2);
  expect(game.comboCount).toBe(0);
});

// Going for a shield star takes time away from catching shapes, so picking
// one up has to keep the streak alive or stars are a trap for combo players.
test('picking up a shield star keeps the combo alive', () => {
  const game = makeGame();
  placeOnPlayer(game, game.player.shape);
  advance(game, 1.5);
  placeOnPlayer(game, 'star', 'powerup');
  advance(game, 1.0);
  expect(game.shieldActive).toBe(true);
  expect(game.comboCount).toBe(1);
});

// A per-catch freeze (hit-stop) read as lag during fast streams, so catches
// must never pause the game.
test('catching never freezes the game', () => {
  const game = makeGame();
  placeOnPlayer(game, game.player.shape);
  const dt = 1 / 60;
  for (let i = 0; i < 5; i++) {
    const before = game.runTime;
    game.update(dt);
    expect(game.runTime).toBeCloseTo(before + dt);
  }
  expect(game.catches).toBe(1);
});
