import { GameStateEnum } from "./config.js";
import { GameMode } from "./game.js";

const MORPH_KEYS = { '1': 'circle', '2': 'square', '3': 'triangle' };

export function bindKeyboard(game) {
  document.addEventListener('keydown', (e) => {
    // Audio may only start after a user gesture.
    game.sfx.unlock();
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'Backquote') {
      game.frameMeter.toggle();
      return;
    }
    if (e.code === 'KeyM' && !e.repeat) {
      game.sfx.toggleMute();
      return;
    }
    if (e.code === 'Escape') {
      if (game.state === GameStateEnum.GAMEOVER) game.toMenu();
      else game.togglePause();
      return;
    }
    // Held keys auto-repeat; only a fresh press should start, resume, restart or dash.
    if (e.code === 'Space' && !e.repeat) {
      if (!game.confirm()) game.dash();
      return;
    }
    if (e.code === 'KeyD' && !e.repeat && game.state === GameStateEnum.START) {
      game.startRun(GameMode.DAILY);
      return;
    }
    if (e.code === 'KeyC' && !e.repeat) {
      game.copyResult();
      return;
    }
    if (e.key === 'ArrowLeft') game.setMove(-1, true);
    if (e.key === 'ArrowRight') game.setMove(1, true);
    const shape = MORPH_KEYS[e.key];
    if (shape) game.morph(shape);
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft') game.setMove(-1, false);
    if (e.key === 'ArrowRight') game.setMove(1, false);
  });
  // Key releases are lost while the page is unfocused, so drop held keys and pause.
  const onFocusLost = () => {
    game.setMove(-1, false);
    game.setMove(1, false);
    if (game.state === GameStateEnum.PLAYING) game.pause();
  };
  window.addEventListener('blur', onFocusLost);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onFocusLost();
  });
}
