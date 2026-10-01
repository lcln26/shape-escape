import { Game } from '../js/game.js';

// update() never draws, so a bare stub context is enough to drive the rules.
export function makeGame() {
  localStorage.clear();
  const game = new Game({}, {});
  game.state = 'playing';
  return game;
}

// Drops a shape (or the 'star' power-up) directly onto the player.
export function placeOnPlayer(game, shape, type = 'normal') {
  const obs = game.getObstacle(game.player.x, game.player.y, 40, type, shape);
  game.obstacles.push(obs);
  return obs;
}

export function advance(game, seconds, dt = 1 / 60) {
  for (let t = 0; t < seconds - 1e-9; t += dt) game.update(dt);
}
