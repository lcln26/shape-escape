export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const dpr = window.devicePixelRatio || 1;
export const BASE_SPAWN_INTERVAL = 1.0;
export const COMBO_RESET_TIME = 2.0;
export const SHIELD_DURATION = 5.0;
export const DASH_DURATION = 0.25;
export const MOVE_SPEED = 400;
export const DASH_SPEED = 1200;
export const MORPH_SCALE_DECAY = 3;
export const MAX_DT = 0.1;

export const GameStateEnum = {
  START: "start",
  PLAYING: "playing",
  PAUSED: "paused",
  GAMEOVER: "gameover",
};
