import { GameStateEnum, SHAPE_COLORS } from "./config.js";
import { GameMode } from "./game.js";

// On-screen controls for phones and tablets: hold the arrows to move,
// double-tap one to dash that way, tap a shape to morph. A row of buttons
// above them changes with the screen (play / pause / retry / share).

const DOUBLE_TAP_MS = 300;

const ARROW_ICONS = {
  '-1': '<polygon points="28,6 8,20 28,34" fill="#fff"/>',
  '1': '<polygon points="12,6 32,20 12,34" fill="#fff"/>',
};

const SHAPE_ICONS = {
  circle: `<circle cx="20" cy="20" r="15" fill="${SHAPE_COLORS.circle}" stroke="#fff" stroke-width="3"/>`,
  square: `<rect x="6" y="6" width="28" height="28" fill="${SHAPE_COLORS.square}" stroke="#fff" stroke-width="3"/>`,
  triangle: `<polygon points="20,4 36,35 4,35" fill="${SHAPE_COLORS.triangle}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`,
};

// Contextual buttons for each screen: [label, action].
function actionsFor(game) {
  switch (game.state) {
    case GameStateEnum.START:
      return [['Play', () => game.startRun(GameMode.NORMAL)], ['Daily challenge', () => game.startRun(GameMode.DAILY)]];
    case GameStateEnum.PLAYING:
      return [['Pause', () => game.pause()]];
    case GameStateEnum.PAUSED:
      return [['Resume', () => game.togglePause()], ['Menu', () => game.toMenu()]];
    case GameStateEnum.GAMEOVER: {
      if (!game.canRestart()) return [];
      const buttons = [['Retry', () => game.confirm()], ['Menu', () => game.toMenu()]];
      if (game.mode === GameMode.DAILY) buttons.push(['Share', () => game.copyResult()]);
      return buttons;
    }
    default:
      return [];
  }
}

export function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
}

export function setupTouch(game) {
  document.body.classList.add('touch');
  game.touch = true;

  const actionsEl = document.getElementById('touch-actions');
  const shapeButtons = {};

  // Pointer events with capture, so each finger tracks its own button and a
  // finger sliding off a button still releases it.
  function holdable(el, onDown, onUp) {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      game.sfx.unlock();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Capture is a nicety (a finger sliding off still releases); never let it block the press.
      }
      el.classList.add('pressed');
      onDown();
    });
    const release = () => {
      if (!el.classList.contains('pressed')) return;
      el.classList.remove('pressed');
      onUp();
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }

  document.querySelectorAll('[data-move]').forEach((el) => {
    const direction = Number(el.dataset.move);
    el.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true">${ARROW_ICONS[el.dataset.move]}</svg>`;
    let lastTap = -Infinity;
    holdable(el, () => {
      const now = performance.now();
      game.setMove(direction, true);
      if (now - lastTap < DOUBLE_TAP_MS) game.dash(direction);
      lastTap = now;
    }, () => game.setMove(direction, false));
  });

  document.querySelectorAll('[data-shape]').forEach((el) => {
    const shape = el.dataset.shape;
    el.innerHTML = `<svg viewBox="0 0 40 40" aria-hidden="true">${SHAPE_ICONS[shape]}</svg>`;
    shapeButtons[shape] = el;
    holdable(el, () => game.morph(shape), () => {});
  });

  // Tapping the game itself starts a run or retries after game over.
  game.canvas.addEventListener('pointerdown', () => {
    game.sfx.unlock();
    if (game.state === GameStateEnum.START || game.state === GameStateEnum.GAMEOVER) game.confirm();
  });

  // Keep the contextual buttons and the selected shape in sync with the game.
  let renderedKey = '';
  function sync() {
    const key = `${game.state}|${game.mode}|${game.state === GameStateEnum.GAMEOVER && game.canRestart()}`;
    if (key !== renderedKey) {
      renderedKey = key;
      actionsEl.replaceChildren(...actionsFor(game).map(([label, action]) => {
        const button = document.createElement('button');
        button.className = 'touch-action';
        button.textContent = label;
        button.addEventListener('click', () => {
          game.sfx.unlock();
          action();
        });
        return button;
      }));
    }
    for (const [shape, el] of Object.entries(shapeButtons)) {
      el.classList.toggle('selected', game.player.shape === shape);
    }
    requestAnimationFrame(sync);
  }
  sync();
}
