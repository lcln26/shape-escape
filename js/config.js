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
export const ENERGY_DRAIN = 0.12; // per second, so a full bar lasts ~8s untouched
export const ENERGY_PER_CATCH = 0.18;
export const ENERGY_LOW = 0.25;

// Catch score is 10 x multiplier, where the multiplier grows with the combo.
export const MAX_COMBO_MULTIPLIER = 8;

// Difficulty follows time survived, as [seconds, value] keyframes with linear
// interpolation in between; the last value holds after the final keyframe.
export const SPEED_CURVE = [[0, 180], [45, 320], [120, 470], [240, 650]]; // px/s
export const SPAWN_INTERVAL_CURVE = [[0, 0.9], [45, 0.75], [120, 0.6], [240, 0.45]]; // s

// Each shape has its own colour so it can be recognised without reading its
// outline (Okabe-Ito palette, distinguishable with common colour blindness).
export const SHAPE_COLORS = {
  circle: '#56B4E9',
  square: '#E69F00',
  triangle: '#CC79A7',
  star: '#F0E442',
};

// Height of the HUD strip along the top; shapes spawn below it.
export const HUD_HEIGHT = 40;

// Game feel.
export const HIT_STOP = 0.035; // brief freeze on each catch, in seconds
export const SHAKE_DEATH = 14; // screen shake strength in px
export const SHAKE_SHIELD_BREAK = 8;
export const SHAKE_DECAY = 10; // higher settles faster
export const TOAST_DURATION = 2.5; // seconds an achievement notice stays up

export const GameStateEnum = {
  START: "start",
  PLAYING: "playing",
  PAUSED: "paused",
  GAMEOVER: "gameover",
};
