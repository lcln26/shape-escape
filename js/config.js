export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 600;
export const COMBO_RESET_TIME = 2.0;
export const SHIELD_DURATION = 5.0;
export const DASH_DURATION = 0.25;
export const MOVE_SPEED = 400;
export const DASH_SPEED = 1200;
export const MORPH_SCALE_DECAY = 3;
export const MAX_DT = 0.1;
// Ignore Space for this long after dying so a panic dash doesn't skip the score.
export const RESTART_LOCKOUT = 0.75;

// Energy: drains constantly and each catch tops it up; the run ends when it
// runs out, so dodging alone can't keep you alive. Values are fractions of a
// full bar.
export const ENERGY_DRAIN = 0.1; // per second, so a full bar lasts 10s untouched
export const ENERGY_PER_CATCH = 0.2;
export const ENERGY_LOW = 0.25;

// Catch score is 10 x multiplier, where the multiplier grows with the combo.
export const MAX_COMBO_MULTIPLIER = 8;

// Difficulty follows time survived, as [seconds, value] keyframes with linear
// interpolation in between; the last value holds after the final keyframe.
export const SPEED_CURVE = [[0, 150], [60, 300], [180, 450], [330, 600]]; // px/s
export const SPAWN_INTERVAL_CURVE = [[0, 1.0], [60, 0.85], [180, 0.65], [330, 0.5]]; // s

export const GameStateEnum = {
  START: "start",
  PLAYING: "playing",
  PAUSED: "paused",
  GAMEOVER: "gameover",
};
